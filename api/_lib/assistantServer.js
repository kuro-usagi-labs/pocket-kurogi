import { neon } from '@neondatabase/serverless'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { assessMemorySafety } from '../../src/lib/assistant/memoryLifecycle.js'

const MAX_BODY_BYTES = 65_536
const ASSISTANT_ACTION_TTL_MS = 15 * 60 * 1000
const ASSISTANT_DIALOGUE_TTL_MS = 30 * 60 * 1000
const PRODUCTION_ORIGINS = Object.freeze([
  'https://pocket.kurousagi.web.id',
])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu
const PAYLOAD_HASH_PATTERN = /^[0-9a-f]{32}$/iu
const WRITE_OPERATIONS = new Set([
  'save_dialogue',
  'stage_action',
  'confirm_action',
  'correct_action',
  'cancel_action',
  'remember',
])
const MEMORY_KEYS = new Set([
  'preferred_wallet',
  'preferred_communication_style',
  'salary_date',
  'common_merchant_category',
  'financial_priority',
  'saving_goal_preference',
  'frequent_transaction_description',
])
const MEMORY_SOURCES = new Set(['explicit', 'repeated', 'correction'])

let jwksCache = null
let jwksCacheUrl = null

export function applyAssistantCors(req, res) {
  const origin = String(req.headers.origin || '')
  const allowedOrigins = getAllowedOrigins()
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Max-Age', '600')

  if (origin && !allowedOrigins.has(origin)) {
    const error = new Error('Origin tidak diizinkan.')
    error.statusCode = 403
    throw error
  }
}

export async function authenticateAssistantRequest(req) {
  const authorization = String(req.headers.authorization || '')
  const match = authorization.match(/^Bearer\s+(.+)$/iu)
  if (!match) {
    const error = new Error('Sesi autentikasi tidak tersedia.')
    error.statusCode = 401
    throw error
  }

  const jwksUrl = process.env.NEON_AUTH_JWKS_URL
  if (!jwksUrl) {
    const error = new Error('NEON_AUTH_JWKS_URL belum dikonfigurasi.')
    error.statusCode = 500
    throw error
  }

  if (!jwksCache || jwksCacheUrl !== jwksUrl) {
    jwksCache = createRemoteJWKSet(new URL(jwksUrl))
    jwksCacheUrl = jwksUrl
  }

  const options = {
    algorithms: ['EdDSA', 'RS256', 'ES256'],
    ...(process.env.NEON_AUTH_ISSUER
      ? { issuer: process.env.NEON_AUTH_ISSUER }
      : {}),
    ...(process.env.NEON_AUTH_AUDIENCE
      ? { audience: process.env.NEON_AUTH_AUDIENCE }
      : {}),
  }
  const { payload } = await jwtVerify(match[1], jwksCache, options)
  const userId = String(payload.sub || '')
  if (!UUID_PATTERN.test(userId)) {
    const error = new Error('Subject token autentikasi tidak valid.')
    error.statusCode = 401
    throw error
  }

  return {
    userId,
    claims: payload,
    token: match[1],
  }
}

export function getAssistantSql() {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL
  if (!connectionString) {
    const error = new Error('DATABASE_URL belum dikonfigurasi untuk Vercel Function.')
    error.statusCode = 500
    throw error
  }
  return neon(connectionString)
}

export async function runAssistantDatabaseOperation({
  sql,
  userId,
  operation,
  body = {},
}) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
  // current_user_id() supports both Neon/PostgREST claim formats. Set both in
  // the same transaction because Vercel connects directly as the database
  // owner instead of going through the Data API JWT middleware.
  const queries = [sql`
    select
      set_config('request.jwt.claim.sub', ${userId}, true),
      set_config('request.jwt.claims', ${claims}, true)
  `]

  if (operation === 'get_state') {
    queries.push(sql`
      select state, expires_at, updated_at
      from public.assistant_dialogue_states
      where user_id = ${userId}::uuid
        and expires_at > now()
    `)
    queries.push(sql`
      select *
      from public.pending_finance_actions
      where user_id = ${userId}::uuid
        and status = 'pending'
        and expires_at > now()
      order by created_at desc
      limit 1
    `)
    queries.push(sql`
      select *
      from public.assistant_memories
      where user_id = ${userId}::uuid
      order by updated_at desc
    `)
  } else if (operation === 'financial_context') {
    queries.push(sql`
      select
        t.id,
        t.transaction_type as type,
        t.amount,
        t.merchant,
        t.notes,
        t.occurred_at,
        t.wallet_id,
        w.name as wallet,
        t.category_id,
        c.name as category
      from public.transactions t
      join public.wallets w
        on w.id = t.wallet_id
       and w.user_id = ${userId}::uuid
      left join public.categories c
        on c.id = t.category_id
       and c.user_id = ${userId}::uuid
      where t.user_id = ${userId}::uuid
        and t.occurred_at >= now() - interval '400 days'
      order by t.occurred_at desc
      limit 5000
    `)
    queries.push(sql`
      select b.*, c.name as category
      from public.budgets b
      join public.categories c
        on c.id = b.category_id
       and c.user_id = ${userId}::uuid
      where b.user_id = ${userId}::uuid
    `)
    queries.push(sql`
      select *
      from public.goals
      where user_id = ${userId}::uuid
      order by created_at
    `)
    queries.push(sql`
      select id, name, wallet_type, current_balance, is_archived
      from public.wallets
      where user_id = ${userId}::uuid
      order by created_at
    `)
  } else if (operation === 'save_dialogue') {
    queries.push(sql`
      select public.save_assistant_dialogue_state(
        ${JSON.stringify(body.state)}::jsonb,
        ${new Date(Date.now() + ASSISTANT_DIALOGUE_TTL_MS).toISOString()}::timestamptz
      ) as result
    `)
  } else if (operation === 'stage_action') {
    queries.push(sql`
      select public.create_pending_finance_action(
        ${body.idempotencyKey},
        ${body.actionType},
        ${JSON.stringify(body.payload)}::jsonb,
        ${new Date(Date.now() + ASSISTANT_ACTION_TTL_MS).toISOString()}::timestamptz
      ) as result
    `)
  } else if (operation === 'confirm_action') {
    queries.push(sql`
      select public.execute_assistant_pending_finance_action(
        ${body.actionId}::uuid,
        ${body.payloadHash}
      ) as result
    `)
  } else if (operation === 'correct_action') {
    queries.push(sql`
      select public.correct_pending_finance_action(
        ${body.actionId}::uuid,
        ${body.payloadHash},
        ${JSON.stringify(body.payload)}::jsonb
      ) as result
    `)
  } else if (operation === 'cancel_action') {
    queries.push(sql`
      select public.cancel_pending_finance_action(
        ${body.actionId}::uuid
      ) as result
    `)
  } else if (operation === 'remember') {
    queries.push(sql`
      select public.remember_assistant_preference(
        ${body.key},
        ${JSON.stringify(body.value)}::jsonb,
        ${body.confidence}::numeric,
        ${body.source}
      ) as result
    `)
  } else {
    const error = new Error('Operasi assistant API tidak dikenal.')
    error.statusCode = 400
    throw error
  }

  const results = await sql.transaction(queries, {
    isolationLevel: operation === 'confirm_action' ? 'Serializable' : 'ReadCommitted',
    readOnly: ['get_state', 'financial_context'].includes(operation),
  })

  return normalizeOperationResult(operation, results.slice(1))
}

export function parseAssistantBody(req) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const error = new Error('Body request harus berupa JSON object.')
    error.statusCode = 400
    throw error
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) {
    const error = new Error('Body request terlalu besar.')
    error.statusCode = 413
    throw error
  }
  return body
}

export function validateAssistantOperationRequest(operation, body = {}, method = 'POST') {
  const normalizedOperation = String(operation || '')
  const known = new Set([
    'get_state',
    'financial_context',
    ...WRITE_OPERATIONS,
  ])
  if (!known.has(normalizedOperation)) {
    throwRequestError('Operasi assistant API tidak dikenal.')
  }
  if (method === 'GET' && WRITE_OPERATIONS.has(normalizedOperation)) {
    throwRequestError('Operasi perubahan state harus memakai POST.', 405)
  }
  if (normalizedOperation === 'save_dialogue') {
    requirePlainObject(body.state, 'Dialogue state')
  }
  if (normalizedOperation === 'stage_action') {
    if (
      typeof body.idempotencyKey !== 'string' ||
      body.idempotencyKey.trim().length === 0 ||
      body.idempotencyKey.length > 200
    ) {
      throwRequestError('Idempotency key tidak valid.')
    }
    if (![
      'record_transactions',
      'transfer_money',
      'upsert_budget',
      'create_saving_goal',
      'update_saving_goal',
    ].includes(body.actionType)) {
      throwRequestError('Jenis pending action tidak didukung.')
    }
    requirePlainObject(body.payload, 'Payload pending action')
    validateActionPayload(body.actionType, body.payload)
  }
  if (['confirm_action', 'correct_action'].includes(normalizedOperation)) {
    requireUuid(body.actionId, 'Action ID')
    if (!PAYLOAD_HASH_PATTERN.test(String(body.payloadHash || ''))) {
      throwRequestError('Payload hash tidak valid.')
    }
  }
  if (normalizedOperation === 'correct_action') {
    requirePlainObject(body.payload, 'Payload koreksi')
  }
  if (normalizedOperation === 'cancel_action') {
    requireUuid(body.actionId, 'Action ID')
  }
  if (normalizedOperation === 'remember') {
    const memorySafety = assessMemorySafety({
      key: String(body.key || ''),
      value: body.value,
    })
    if (
      !MEMORY_KEYS.has(String(body.key || '')) ||
      !MEMORY_SOURCES.has(String(body.source || '')) ||
      !Number.isFinite(Number(body.confidence)) ||
      Number(body.confidence) < 0 ||
      Number(body.confidence) > 1 ||
      body.value === null ||
      body.value === undefined ||
      !memorySafety.safe
    ) {
      throwRequestError('Memory assistant tidak valid.')
    }
  }
}

export function sendAssistantError(res, error) {
  const isControlledDatabaseError = error?.code === 'P0001'
  const statusCode = Number(
    error?.statusCode ||
    (isControlledDatabaseError ? 409 : 500)
  )
  const safeMessage = statusCode >= 500
    ? 'Layanan assistant sedang bermasalah. Coba lagi sebentar.'
    : String(error?.message || 'Request tidak valid.')
  res.status(statusCode).json({
    error: {
      code: statusCode >= 500
        ? 'ASSISTANT_SERVER_ERROR'
        : isControlledDatabaseError
          ? 'ASSISTANT_ACTION_CONFLICT'
          : 'ASSISTANT_REQUEST_ERROR',
      message: safeMessage,
    },
  })
}

function getAllowedOrigins() {
  const configured = String(process.env.ASSISTANT_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  const origins = configured.length > 0 ? configured : PRODUCTION_ORIGINS
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://127.0.0.1:5173')
  }
  return new Set(origins)
}

function requirePlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwRequestError(`${label} harus berupa object.`)
  }
}

function requireUuid(value, label) {
  if (!UUID_PATTERN.test(String(value || ''))) {
    throwRequestError(`${label} tidak valid.`)
  }
}

function requirePositiveAmount(value, label) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount <= 0 || amount > 9_999_999_999_999.99) {
    throwRequestError(`${label} tidak valid.`)
  }
}

function validateActionPayload(actionType, payload) {
  if (actionType === 'record_transactions') {
    if (
      !Array.isArray(payload.items) ||
      payload.items.length === 0 ||
      payload.items.length > 20
    ) {
      throwRequestError('Rincian transaksi harus berisi 1 sampai 20 item.')
    }
    for (const [index, item] of payload.items.entries()) {
      requirePlainObject(item, `Transaksi ${index + 1}`)
      requireUuid(item.walletId, `Dompet transaksi ${index + 1}`)
      requirePositiveAmount(item.amount, `Nominal transaksi ${index + 1}`)
      if (!['income', 'expense'].includes(item.transactionType)) {
        throwRequestError(`Jenis transaksi ${index + 1} tidak valid.`)
      }
      if (item.categoryId) requireUuid(item.categoryId, `Kategori transaksi ${index + 1}`)
    }
    return
  }

  if (actionType === 'transfer_money') {
    requireUuid(payload.sourceWalletId, 'Dompet sumber')
    requireUuid(payload.destinationWalletId, 'Dompet tujuan')
    if (payload.sourceWalletId === payload.destinationWalletId) {
      throwRequestError('Dompet sumber dan tujuan harus berbeda.')
    }
    requirePositiveAmount(payload.amount, 'Nominal transfer')
    return
  }

  if (actionType === 'upsert_budget') {
    requireUuid(payload.categoryId, 'Kategori budget')
    requirePositiveAmount(payload.amount, 'Nominal budget')
    return
  }

  if (actionType === 'create_saving_goal') {
    if (
      typeof payload.description !== 'string' ||
      payload.description.trim().length === 0 ||
      payload.description.length > 120
    ) {
      throwRequestError('Nama target tabungan tidak valid.')
    }
    requirePositiveAmount(payload.amount, 'Nominal target tabungan')
    if (payload.sourceWalletId) requireUuid(payload.sourceWalletId, 'Dompet sumber target')
    if (payload.initialAmount !== null && payload.initialAmount !== undefined) {
      const initialAmount = Number(payload.initialAmount)
      if (!Number.isFinite(initialAmount) || initialAmount < 0) {
        throwRequestError('Setoran awal target tabungan tidak valid.')
      }
    }
    return
  }

  if (actionType === 'update_saving_goal') {
    requireUuid(payload.goalId, 'Target tabungan')
    requirePositiveAmount(payload.amount, 'Nominal target tabungan')
  }
}

function throwRequestError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  throw error
}

function normalizeOperationResult(operation, results) {
  if (operation === 'get_state') {
    return {
      dialogueState: results[0]?.[0] || null,
      pendingAction: results[1]?.[0] || null,
      memories: results[2] || [],
    }
  }
  if (operation === 'financial_context') {
    return {
      transactions: results[0] || [],
      budgets: results[1] || [],
      goals: results[2] || [],
      wallets: results[3] || [],
    }
  }
  return results[0]?.[0]?.result || null
}
