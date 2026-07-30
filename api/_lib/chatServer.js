import { randomUUID } from 'node:crypto'

const PAGE_SIZE = 40
const MAX_TEXT_LENGTH = 12_000
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export function getChatRequestMeta(req) {
  const suppliedRequestId = String(req.headers['x-request-id'] || '')
  return {
    requestId: UUID_PATTERN.test(suppliedRequestId) ? suppliedRequestId : randomUUID(),
    sessionGeneration: boundedInteger(req.headers['x-chat-session-generation']),
    retryAttempt: boundedInteger(req.headers['x-chat-retry-attempt']),
  }
}

export function validateChatRequest(operation, body = {}, method = 'POST') {
  if (!['list_messages', 'save_message', 'clear_messages'].includes(operation)) {
    throwChatRequestError('Operasi chat tidak dikenal.')
  }
  if (method === 'GET' && operation !== 'list_messages') {
    throwChatRequestError('Operasi perubahan chat harus memakai POST.', 405)
  }
  if (operation === 'list_messages') {
    const hasCreatedAt = Boolean(body.cursorCreatedAt)
    const hasId = Boolean(body.cursorId)
    if (hasCreatedAt !== hasId) throwChatRequestError('Cursor riwayat tidak lengkap.')
    if (hasCreatedAt && (!Number.isFinite(Date.parse(body.cursorCreatedAt)) || !UUID_PATTERN.test(body.cursorId))) {
      throwChatRequestError('Cursor riwayat tidak valid.')
    }
  }
  if (operation === 'save_message') {
    if (!['user', 'bot'].includes(body.sender)) throwChatRequestError('Pengirim pesan tidak valid.')
    if (typeof body.text !== 'string' || body.text.trim().length === 0 || body.text.length > MAX_TEXT_LENGTH) {
      throwChatRequestError('Isi pesan tidak valid.')
    }
    if (body.metadata !== undefined && (!body.metadata || typeof body.metadata !== 'object' || Array.isArray(body.metadata))) {
      throwChatRequestError('Metadata pesan tidak valid.')
    }
  }
}

export async function runChatDatabaseOperation({ sql, userId, operation, body = {}, requestId }) {
  const claims = JSON.stringify({ sub: userId, role: 'authenticated' })
  const queries = [sql`
    select
      set_config('request.jwt.claim.sub', ${userId}, true),
      set_config('request.jwt.claims', ${claims}, true)
  `]

  if (operation === 'list_messages') {
    if (body.cursorCreatedAt) {
      queries.push(sql`
        select id, sender, text, metadata, created_at
        from public.chat_messages
        where user_id = ${userId}::uuid
          and (created_at, id) < (${body.cursorCreatedAt}::timestamptz, ${body.cursorId}::uuid)
        order by created_at desc, id desc
        limit ${PAGE_SIZE + 1}
      `)
    } else {
      queries.push(sql`
        select id, sender, text, metadata, created_at
        from public.chat_messages
        where user_id = ${userId}::uuid
        order by created_at desc, id desc
        limit ${PAGE_SIZE + 1}
      `)
    }
  } else if (operation === 'save_message') {
    queries.push(sql`
      with saved_message as (
        insert into public.chat_messages (user_id, sender, text, metadata)
        values (
          ${userId}::uuid,
          ${body.sender},
          ${body.text.trim()},
          ${JSON.stringify(body.metadata || {})}::jsonb
        )
        returning id, sender, text, metadata, created_at
      ), event_written as (
        insert into public.chat_conversation_events (user_id, message_id, request_id, event_type)
        select ${userId}::uuid, id, ${requestId}::uuid, 'message_created'
        from saved_message
      )
      select * from saved_message
    `)
  } else if (operation === 'clear_messages') {
    queries.push(sql`
      with deleted_messages as (
        delete from public.chat_messages
        where user_id = ${userId}::uuid
        returning metadata
      ), deleted_attachments as (
        delete from public.chat_attachments
        where user_id = ${userId}::uuid
          and id in (
            select split_part(metadata ->> 'imagePath', '/', 2)::uuid
            from deleted_messages
            where metadata ->> 'imagePath' is not null
          )
      )
      select coalesce(jsonb_agg(metadata ->> 'imagePath') filter (where metadata ->> 'imagePath' is not null), '[]'::jsonb) as attachment_paths
      from deleted_messages
    `)
  }

  const results = await sql.transaction(queries, { isolationLevel: 'ReadCommitted' })
  const result = results[1] || []
  if (operation === 'list_messages') {
    const hasMore = result.length > PAGE_SIZE
    return { messages: result.slice(0, PAGE_SIZE), hasMore }
  }
  if (operation === 'save_message') return result[0] || null
  return { attachmentPaths: result[0]?.attachment_paths || [] }
}

export function sendChatError(res, error, requestId) {
  const statusCode = Number(error?.statusCode || (error?.code === 'P0001' ? 409 : 500))
  const code = error?.code === 'P0001' ? 'CHAT_CONFLICT' : statusCode === 401 ? 'CHAT_AUTH_REQUIRED' : statusCode >= 500 ? 'CHAT_UNAVAILABLE' : 'CHAT_REQUEST_ERROR'
  const message = statusCode >= 500
    ? 'Riwayat percakapan sedang belum tersedia. Pesan yang sudah tampil tetap aman.'
    : String(error?.message || 'Permintaan chat tidak valid.')
  res.status(statusCode).json({ error: { code, message }, meta: { requestId } })
}

export function logChatTelemetry({ requestId, sessionGeneration, retryAttempt, operation, durationMs, statusCode, errorCode = null }) {
  // Deliberately contains no message, user, token, attachment, or financial data.
  console.info('chat_telemetry', JSON.stringify({
    requestId,
    sessionGeneration,
    retryAttempt,
    operation,
    durationMs: Math.round(durationMs),
    statusCode,
    outcome: statusCode < 400 ? 'success' : 'error',
    errorCode,
  }))
}

function boundedInteger(value) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 1_000_000 ? number : 0
}

function throwChatRequestError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  throw error
}
