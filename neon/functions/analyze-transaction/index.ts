import { AuthError, requireAuthenticatedUser } from './auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_TEXT_LENGTH = 2_000
const MAX_CONTEXT_LENGTH = 12_000
const MAX_OPTIONS = 50
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const GEMINI_TIMEOUT_MS = 15_000

const ALLOWED_ANALYTICS_METRICS = new Set([
  'overview',
  'total_income',
  'total_expense',
  'total_savings',
  'net_cashflow',
  'top_expense',
  'top_income',
  'transfer_volume',
])

const ALLOWED_PERIODS = new Set(['today', 'this_week', 'this_month', 'last_30_days', 'all_time'])
const ALLOWED_ADVICE_FOCUS = new Set(['overall', 'expense', 'income', 'savings', 'budget'])
const ALLOWED_TYPES = new Set([
  'transaction',
  'advice',
  'analytics_query',
  'goal_contribution',
  'goal_creation_pending',
  'goal_withdrawal',
  'transfer',
  'delete_wallet',
  'restore_wallet',
  'rename_wallet',
  'check_balance',
  'undo_transaction',
  'create_wallet',
  'confirm',
  'cancel',
  'bulk_delete_wallets',
  'bulk_delete_transactions',
  'unknown',
])

type EntityOption = {
  id?: string
  name?: string
  normalizedName?: string
  isArchived?: boolean
  status?: string
  categoryType?: string
}

type AnalyzePayload = {
  text?: string
  imageBase64?: string | null
  walletOptions?: EntityOption[]
  archivedWalletOptions?: EntityOption[]
  goalOptions?: EntityOption[]
  categoryOptions?: EntityOption[]
  walletNames?: string[]
  goalNames?: string[]
  financialContext?: string
}

class ValidationError extends Error {}

export default async function handler(request) {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const requestId = crypto.randomUUID()
  const startedAt = Date.now()
  let userId: string | null = null

  try {
    const authContext = await requireAuthenticatedUser(request)
    userId = authContext.userId

    const body = (await request.json()) as AnalyzePayload
    validatePayload(body)

    console.info('analyze-transaction request', {
      requestId,
      userId,
      hasImage: Boolean(body.imageBase64),
      textLength: typeof body.text === 'string' ? body.text.length : 0,
    })

    const result = normalizeAnalyzerResult(await callGeminiAPI(body))

    console.info('analyze-transaction success', {
      requestId,
      userId,
      type: result.type,
      durationMs: Date.now() - startedAt,
    })

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-AI-Request-Id': requestId,
      },
    })
  } catch (error) {
    console.error('analyze-transaction failed', {
      requestId,
      userId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status:
          error instanceof AuthError
            ? 401
            : error instanceof ValidationError
              ? 400
              : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'X-AI-Request-Id': requestId,
        },
      }
    )
  }
}

async function callGeminiAPI({
  text = '',
  imageBase64 = null,
  walletOptions = [],
  archivedWalletOptions = [],
  goalOptions = [],
  categoryOptions = [],
  walletNames = [],
  goalNames = [],
  financialContext = '',
}: AnalyzePayload) {
  const geminiApiKey = process.env.GEMINI_API_KEY

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Neon Functions.')
  }

  const prompt = buildPrompt({
    text,
    financialContext,
    walletOptions,
    archivedWalletOptions,
    goalOptions,
    categoryOptions,
    walletNames,
    goalNames,
  })
  const parts: Array<Record<string, unknown>> = [{ text: prompt }]

  if (imageBase64) {
    const mimeTypeMatch = imageBase64.match(/data:(.*?);base64,/)
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg'
    const base64Data = imageBase64.split(',')[1]

    parts.push({
      inlineData: {
        data: base64Data,
        mimeType,
      },
    })
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    }
  )

  if (!response.ok) {
    const textBody = await response.text()
    throw new Error(`Gemini request failed with ${response.status}: ${textBody}`)
  }

  const data = await response.json()
  const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text

  if (!responseText) {
    throw new Error('Gemini returned an empty response.')
  }

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  const cleanJson = jsonMatch ? jsonMatch[0] : responseText

  try {
    return JSON.parse(cleanJson)
  } catch (error) {
    console.error('Gemini JSON parse error:', error, 'Raw text:', responseText)
    throw new Error('Gagal memproses jawaban AI.')
  }
}

function validatePayload({
  text = '',
  imageBase64 = null,
  walletOptions = [],
  archivedWalletOptions = [],
  goalOptions = [],
  categoryOptions = [],
  walletNames = [],
  goalNames = [],
  financialContext = '',
}: AnalyzePayload) {
  if (typeof text !== 'string') {
    throw new ValidationError('Format pesan tidak valid.')
  }

  if (text.length > MAX_TEXT_LENGTH) {
    throw new ValidationError('Pesan terlalu panjang. Coba ringkas jadi maksimal 2000 karakter.')
  }

  if (typeof financialContext !== 'string') {
    throw new ValidationError('Format konteks keuangan tidak valid.')
  }

  if (financialContext.length > MAX_CONTEXT_LENGTH) {
    throw new ValidationError('Konteks keuangan terlalu besar. Coba muat data yang lebih ringkas.')
  }

  validateEntityOptions(walletOptions, 'dompet')
  validateEntityOptions(archivedWalletOptions, 'dompet arsip')
  validateEntityOptions(goalOptions, 'target tabungan')
  validateEntityOptions(categoryOptions, 'kategori')

  if (!Array.isArray(walletNames) || walletNames.length > MAX_OPTIONS) {
    throw new ValidationError('Daftar dompet tidak valid.')
  }

  if (walletNames.some((walletName) => typeof walletName !== 'string' || walletName.length > 100)) {
    throw new ValidationError('Nama dompet tidak valid.')
  }

  if (!Array.isArray(goalNames) || goalNames.length > MAX_OPTIONS) {
    throw new ValidationError('Daftar target tabungan tidak valid.')
  }

  if (goalNames.some((goalName) => typeof goalName !== 'string' || goalName.length > 100)) {
    throw new ValidationError('Nama target tabungan tidak valid.')
  }

  if (!imageBase64) {
    return
  }

  if (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:')) {
    throw new ValidationError('Format gambar tidak valid.')
  }

  const base64Data = imageBase64.split(',')[1]
  if (!base64Data) {
    throw new ValidationError('Data gambar tidak ditemukan.')
  }

  const estimatedBytes = Math.ceil((base64Data.length * 3) / 4)
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new ValidationError('Ukuran gambar terlalu besar. Gunakan gambar di bawah 4MB.')
  }
}

function validateEntityOptions(options: EntityOption[], label: string) {
  if (!Array.isArray(options) || options.length > MAX_OPTIONS) {
    throw new ValidationError(`Daftar ${label} tidak valid.`)
  }

  const invalidOption = options.find((option) => {
    return !option || typeof option !== 'object' || typeof option.name !== 'string' || option.name.length > 100
  })

  if (invalidOption) {
    throw new ValidationError(`Ada ${label} dengan format yang tidak valid.`)
  }
}

function normalizeAnalyzerResult(result: unknown) {
  if (!result || typeof result !== 'object') {
    return {
      type: 'unknown',
      reply: 'Permintaan belum bisa dipetakan ke intent yang valid.',
    }
  }

  const payload = result as Record<string, unknown>
  const type =
    typeof payload.type === 'string' && ALLOWED_TYPES.has(payload.type)
      ? payload.type
      : 'unknown'

  const normalized = {
    ...payload,
    type,
  } as Record<string, unknown>

  const reply = sanitizeReply(payload.reply)
  if (reply) {
    normalized.reply = reply
  }

  if (type === 'analytics_query') {
    normalized.metric =
      typeof payload.metric === 'string' && ALLOWED_ANALYTICS_METRICS.has(payload.metric)
        ? payload.metric
        : 'overview'
    normalized.period = normalizePeriod(payload.period)
  }

  if (type === 'transaction') {
    normalized.transactionType =
      payload.transactionType === 'income' ? 'income' : 'expense'

    if (typeof payload.amount === 'number' && Number.isFinite(payload.amount) && payload.amount > 0) {
      normalized.amount = payload.amount
    } else {
      return {
        type: 'unknown',
        reply: 'Nominal transaksinya belum jelas. Tulis seperti "beli kopi 25rb dari BCA".',
      }
    }

    const category = sanitizeCategoryLabel(payload.category)
    if (category) {
      normalized.category = category
    }

    const desc = sanitizeReply(payload.desc)
    if (desc) {
      normalized.desc = desc
    }

    const learningHints = sanitizeLearningHints(payload.learningHints)
    if (learningHints.length > 0) {
      normalized.learningHints = learningHints
    }
  }

  if (type === 'advice') {
    normalized.period = normalizePeriod(payload.period)
    normalized.focus = normalizeAdviceFocus(payload.focus)
  }

  if (type === 'transfer') {
    if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount) || payload.amount <= 0) {
      return {
        type: 'unknown',
        reply: 'Nominal transfer belum jelas. Format aman: "transfer 100rb dari BCA ke DANA".',
      }
    }

    normalized.amount = payload.amount
  }

  if (type === 'goal_contribution' || type === 'goal_withdrawal') {
    if (typeof payload.amount !== 'number' || !Number.isFinite(payload.amount) || payload.amount <= 0) {
      return {
        type: 'unknown',
        reply: 'Nominal target tabungannya belum jelas.',
      }
    }

    normalized.amount = payload.amount
  }

  if (type === 'goal_creation_pending') {
    const name = sanitizeEntityLabel(payload.name, 100)
    if (!name) {
      return {
        type: 'unknown',
        reply: 'Nama target tabungannya belum jelas. Contoh: "buat target Liburan Jepang 5jt".',
      }
    }

    normalized.name = name
    normalized.amount =
      typeof payload.amount === 'number' && Number.isFinite(payload.amount) && payload.amount > 0
        ? payload.amount
        : 0

    if (typeof payload.targetAmount === 'number' && Number.isFinite(payload.targetAmount) && payload.targetAmount > 0) {
      normalized.targetAmount = payload.targetAmount
    }
  }

  if (type === 'delete_wallet' || type === 'rename_wallet') {
    const wallet = sanitizeEntityLabel(payload.wallet)
    if (wallet) {
      normalized.wallet = wallet
    }

    if (typeof payload.walletId === 'string' && payload.walletId.length <= 100) {
      normalized.walletId = payload.walletId
    }
  }

  if (type === 'restore_wallet') {
    const wallet = sanitizeEntityLabel(payload.wallet)
    if (wallet) {
      normalized.wallet = wallet
    }

    if (typeof payload.walletId === 'string' && payload.walletId.length <= 100) {
      normalized.walletId = payload.walletId
    }
  }

  if (type === 'rename_wallet') {
    const nextName = sanitizeEntityLabel(payload.nextName, 100)
    if (nextName) {
      normalized.nextName = nextName
    }
  }

  if (type === 'check_balance') {
    const target = sanitizeEntityLabel(payload.target, 80)
    if (target) {
      normalized.target = target
    }

    if (typeof payload.targetWalletId === 'string' && payload.targetWalletId.length <= 100) {
      normalized.targetWalletId = payload.targetWalletId
    }
  }

  return normalized
}

function normalizePeriod(period: unknown) {
  return typeof period === 'string' && ALLOWED_PERIODS.has(period) ? period : 'all_time'
}

function normalizeAdviceFocus(focus: unknown) {
  return typeof focus === 'string' && ALLOWED_ADVICE_FOCUS.has(focus) ? focus : 'overall'
}

function sanitizeReply(reply: unknown) {
  if (typeof reply !== 'string') {
    return ''
  }

  return reply.trim().slice(0, 1200)
}

function sanitizeCategoryLabel(category: unknown) {
  if (typeof category !== 'string') {
    return ''
  }

  return category
    .trim()
    .replace(/[^\p{L}\p{N}\s&/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 40)
}

function sanitizeEntityLabel(value: unknown, maxLength = 80) {
  if (typeof value !== 'string') {
    return ''
  }

  return value
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, maxLength)
}

function sanitizeLearningHints(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[]
  }

  const seen = new Set<string>()
  const hints: string[] = []

  for (const item of value) {
    if (typeof item !== 'string') {
      continue
    }

    const normalized = item
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s&/-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 48)

    if (!normalized || normalized.length < 2 || /^\d+$/.test(normalized) || seen.has(normalized)) {
      continue
    }

    if (
      [
        'beli',
        'bayar',
        'pengeluaran',
        'pemasukan',
        'expense',
        'income',
        'transaksi',
        'transaction',
        'lainnya',
        'other',
      ].includes(normalized)
    ) {
      continue
    }

    seen.add(normalized)
    hints.push(normalized)

    if (hints.length >= 6) {
      break
    }
  }

  return hints
}

function buildPrompt({
  text,
  financialContext,
  walletOptions = [],
  archivedWalletOptions = [],
  goalOptions = [],
  categoryOptions = [],
  walletNames = [],
  goalNames = [],
}: {
  text: string
  financialContext: string
  walletOptions: EntityOption[]
  archivedWalletOptions: EntityOption[]
  goalOptions: EntityOption[]
  categoryOptions: EntityOption[]
  walletNames: string[]
  goalNames: string[]
}) {
  const walletList = buildOptionList(walletOptions, walletNames, 'Tunai')
  const archivedWalletList = buildOptionList(archivedWalletOptions)
  const goalList = buildOptionList(goalOptions, goalNames)
  const categoryList = buildCategoryOptionList(categoryOptions)

  return `Kamu adalah AI Financial Advisor yang cerdas, minimalis, dan berkelas.
Ekstrak informasi atau berikan analisa keuangan dari: "${text || 'Berkas Terlampir'}"

${financialContext}

DOMPET YANG TERSEDIA:
${walletList || 'Tunai'}

DOMPET ARSIP YANG TERSEDIA:
${archivedWalletList || 'Belum ada dompet arsip'}

TARGET TABUNGAN YANG TERSEDIA:
${goalList || 'Belum ada target tabungan aktif'}

KATEGORI USER YANG TERSEDIA:
${categoryList || 'Belum ada kategori custom selain default'}

PANDUAN CERDAS:
1. Utamakan akurasi dan keamanan. Kalau nominal, dompet, target, atau maksud aksi belum jelas, kembalikan "unknown" dengan reply klarifikasi singkat; jangan menebak.
2. Jawaban harus bahasa Indonesia natural, ringkas, dan tidak kaku. Maksimal 2-4 kalimat untuk "reply".
3. Jangan mengarang wallet, dompet arsip, goal, kategori user, saldo, atau histori yang tidak ada pada daftar/konteks.
4. Jika user hanya bertanya kemampuan/cara pakai, kembalikan "unknown" dengan reply bantuan singkat, bukan transaksi.
5. Jika user curhat/bertanya kondisi uang seperti "uangku aman?", "keuangan sehat?", "gimana strategi?", gunakan "advice".
6. Jika user bertanya angka/rekap seperti "pengeluaran berapa?", "cashflow?", "kategori paling boros?", gunakan "analytics_query".
7. Transaksi hanya boleh "transaction" jika ada nominal valid dan arah uang jelas. "tambah", "masuk", "topup", "gaji", "bonus" = income. "beli", "bayar", "keluar", "jajan" = expense.
8. Untuk transaksi, isi "category" dengan kategori user paling cocok bila ada. Jika belum ada yang cocok, gunakan label kategori baru yang singkat, bersih, dan 1-3 kata. Hindari "Lainnya" kecuali benar-benar tidak tahu.
9. Untuk transaksi, isi "learningHints" dengan 1-4 keyword/frasa pendek yang relevan untuk pembelajaran lokal user. Contoh baik: "golda", "kopi golda", "token pln", "paket telkomsel". Hindari kata kerja umum, nominal, dan kata generik seperti "pengeluaran".
10. Jangan pernah memasukkan instruksi internal, markdown, atau teks di luar JSON.

Kembalikan HANYA JSON tanpa markdown. Tipe:
- "transaction": { transactionType, amount, desc, category, walletId, wallet, learningHints, reply }
- "advice": { period, focus, reply }
- "analytics_query": { metric, period, reply }
- "goal_contribution": { goalId, goal, amount, sourceWalletId, sourceWallet, reply }
- "goal_creation_pending": { name, amount, targetAmount, sourceWalletId, sourceWallet, reply }
- "goal_withdrawal": { goalId, goal, amount, destinationWalletId, wallet, reply }
- "transfer": { amount, fromWalletId, from, toWalletId, to, reply }
- "delete_wallet": { walletId, wallet }
- "restore_wallet": { walletId, wallet }
- "rename_wallet": { walletId, wallet, nextName, reply }
- "check_balance": { targetWalletId, target, reply }
- "undo_transaction", "create_wallet", "confirm", "cancel", "bulk_delete_wallets", "bulk_delete_transactions", "unknown".

INSTRUKSI KHUSUS MANAJEMEN DOMPET:
1. Jika user ingin menghapus dompet, gunakan "delete_wallet" dengan walletId dan wallet yang cocok dari daftar dompet.
2. Dompet yang masih punya saldo tetap boleh dihapus dari daftar aktif setelah konfirmasi; jangan menolak hanya karena masih ada saldo.
3. Jika user ingin rename/ganti nama dompet, gunakan "rename_wallet".
4. Untuk "rename_wallet", ambil walletId + wallet dari daftar dompet, lalu isi "nextName" dengan nama baru yang singkat dan bersih.
5. Jika user ingin memulihkan dompet arsip, gunakan "restore_wallet" dengan walletId dan wallet yang cocok dari daftar dompet arsip.
6. Untuk transaksi, transfer, saldo, goal, delete, dan rename, gunakan hanya dompet dari daftar dompet aktif. Dompet arsip hanya boleh dipakai untuk intent "restore_wallet".
7. Jika user berkata "buat dompet" tanpa nama yang jelas, kembalikan "unknown" dan tanyakan nama dompet. Jangan membuat "Dompet Baru" otomatis.

INSTRUKSI KHUSUS TABUNGAN (GOALS):
1. Jika user ingin menabung/menyisihkan uang ke target tertentu, cocokkan nama target terhadap daftar target aktif di bawah.
2. Jika nama target ADA di daftar: kembalikan "goal_contribution" dengan goalId yang sesuai.
3. Jika user juga menyebut dompet sumber, isi sourceWalletId dan sourceWallet dari daftar dompet.
4. Jika user ingin membuat target baru, kembalikan "goal_creation_pending".
5. Untuk "goal_creation_pending", "targetAmount" adalah nominal target total. "amount" adalah setoran awal, isi 0 jika tidak disebut.
6. Jika nama target ada tapi nominal setoran tidak ada, kembalikan "unknown" dan minta nominal setoran.
7. Jika nama target TIDAK ADA saat user ingin menabung ke target, kembalikan "goal_creation_pending", simpan "name" dan "amount" sebagai setoran awal, lalu tanyakan target total bila belum disebut.

INSTRUKSI KHUSUS PENCAIRAN TABUNGAN:
1. Jika user ingin menarik, mencairkan, memindahkan, atau transfer dana DARI target tabungan ke dompet tertentu, gunakan "goal_withdrawal".
2. "goalId" harus mengambil id target yang cocok dari daftar target aktif.
3. "destinationWalletId" dan "wallet" harus mengambil id + nama dompet tujuan dari daftar dompet.
4. Jangan gunakan "transfer" jika sumber dana berasal dari target tabungan. "transfer" hanya untuk perpindahan antar dompet.

INSTRUKSI KHUSUS TRANSFER:
1. Jika user ingin memindahkan uang antar dompet, kembalikan "type": "transfer".
2. "amount": nominal yang dipindahkan.
3. "fromWalletId" dan "from" harus mengambil dompet asal dari daftar dompet.
4. "toWalletId" dan "to" harus mengambil dompet tujuan dari daftar dompet.
5. "reply": konfirmasi singkat yang merangkum rencana transfer tersebut.

INSTRUKSI KHUSUS ANALYTICS:
1. Jika user menanyakan data keuangan seperti pemasukan, pengeluaran, tabungan, cashflow, kategori paling boros, sumber pemasukan terbesar, atau volume transfer, kembalikan "type": "analytics_query".
2. "metric" harus salah satu dari: "overview", "total_income", "total_expense", "total_savings", "net_cashflow", "top_expense", "top_income", "transfer_volume".
3. "period" harus salah satu dari: "today", "this_week", "this_month", "last_30_days", "all_time".
4. Jika user meminta strategi, saran, atau langkah perbaikan, gunakan "advice" alih-alih "analytics_query".
5. Untuk "advice", "focus" harus salah satu dari: "overall", "expense", "income", "savings", "budget".
6. Jika user menyebut pengeluaran/boros/hemat => focus "expense". Jika pemasukan/penghasilan => "income". Jika tabungan/goal => "savings". Jika budget/anggaran => "budget". Selain itu => "overall".
7. "reply" opsional, hanya dipakai jika butuh klarifikasi yang sangat singkat.`
}

function buildOptionList(options: EntityOption[], fallbackNames: string[] = [], extraName?: string) {
  const seen = new Set<string>()
  const items: string[] = []

  for (const option of options) {
    const name = typeof option?.name === 'string' ? option.name.trim() : ''
    if (!name) continue

    const key = `${name.toLowerCase()}::${option.id || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(option.id ? `${name} [${option.id}]` : name)
  }

  for (const fallbackName of fallbackNames) {
    const normalized = fallbackName.trim()
    if (!normalized) continue
    const key = `${normalized.toLowerCase()}::`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(normalized)
  }

  if (extraName) {
    const key = `${extraName.toLowerCase()}::`
    if (!seen.has(key)) {
      items.push(extraName)
    }
  }

  return items.join(', ')
}

function buildCategoryOptionList(options: EntityOption[] = []) {
  const seen = new Set<string>()
  const items: string[] = []

  for (const option of options) {
    const name = typeof option?.name === 'string' ? option.name.trim() : ''
    if (!name) continue

    const normalizedType =
      typeof option?.categoryType === 'string' ? option.categoryType.trim().toLowerCase() : 'both'
    const key = `${name.toLowerCase()}::${normalizedType}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(`${name}${normalizedType && normalizedType !== 'both' ? ` (${normalizedType})` : ''}`)
  }

  return items.join(', ')
}
