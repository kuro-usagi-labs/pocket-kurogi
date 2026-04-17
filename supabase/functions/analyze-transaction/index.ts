const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_TEXT_LENGTH = 2_000
const MAX_CONTEXT_LENGTH = 12_000
const MAX_OPTIONS = 50
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

type EntityOption = {
  id?: string
  name?: string
  normalizedName?: string
  isArchived?: boolean
  status?: string
}

type AnalyzePayload = {
  text?: string
  imageBase64?: string | null
  walletOptions?: EntityOption[]
  goalOptions?: EntityOption[]
  walletNames?: string[]
  goalNames?: string[]
  financialContext?: string
}

class ValidationError extends Error {}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await request.json()) as AnalyzePayload
    validatePayload(body)
  const result = await callGeminiAPI(body)

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('analyze-transaction failed:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: error instanceof ValidationError ? 400 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
})

async function callGeminiAPI({
  text = '',
  imageBase64 = null,
  walletOptions = [],
  goalOptions = [],
  walletNames = [],
  goalNames = [],
  financialContext = '',
}: AnalyzePayload) {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase Edge Functions.')
  }

  const prompt = buildPrompt({
    text,
    financialContext,
    walletOptions,
    goalOptions,
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
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
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
  goalOptions = [],
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
  validateEntityOptions(goalOptions, 'target tabungan')

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

function buildPrompt({
  text,
  financialContext,
  walletOptions = [],
  goalOptions = [],
  walletNames = [],
  goalNames = [],
}: {
  text: string
  financialContext: string
  walletOptions: EntityOption[]
  goalOptions: EntityOption[]
  walletNames: string[]
  goalNames: string[]
}) {
  const walletList = buildOptionList(walletOptions, walletNames, 'Tunai')
  const goalList = buildOptionList(goalOptions, goalNames)

  return `Kamu adalah AI Financial Advisor yang cerdas, minimalis, dan berkelas.
Ekstrak informasi atau berikan analisa keuangan dari: "${text || 'Berkas Terlampir'}"

${financialContext}

DOMPET YANG TERSEDIA:
${walletList || 'Tunai'}

TARGET TABUNGAN YANG TERSEDIA:
${goalList || 'Belum ada target tabungan aktif'}

PANDUAN:
1. Jika user meminta tips, motivasi, analisa, atau saham: gunakan data keuangan di atas untuk memberikan jawaban yang SANGAT SINGKAT, tajam, dan edukatif.
2. Transaksi: "tambah", "masuk", "topup" = INCOME. "beli", "bayar", "keluar" = EXPENSE.
3. Jika transaksi: ekstrak data seperti biasa.
4. Gunakan bahasa Indonesia yang profesional namun modern.
5. Hindari daftar contoh perintah.

Kembalikan HANYA JSON tanpa markdown. Tipe:
- "transaction": { transactionType, amount, desc, category, walletId, wallet, reply }
- "advice": { reply }
- "analytics_query": { metric, period, reply }
- "goal_contribution": { goalId, goal, amount, sourceWalletId, sourceWallet, reply }
- "goal_creation_pending": { name, amount, sourceWalletId, sourceWallet, reply }
- "goal_withdrawal": { goalId, goal, amount, destinationWalletId, wallet, reply }
- "transfer": { amount, fromWalletId, from, toWalletId, to, reply }
- "delete_wallet": { walletId, wallet }
- "check_balance": { targetWalletId, target, reply }
- "undo_transaction", "create_wallet", "confirm", "cancel", "bulk_delete_wallets", "bulk_delete_transactions", "unknown".

INSTRUKSI KHUSUS TABUNGAN (GOALS):
1. Jika user ingin menabung/menyisihkan uang ke target tertentu, cocokkan nama target terhadap daftar target aktif di bawah.
2. Jika nama target ADA di daftar: kembalikan "goal_contribution" dengan goalId yang sesuai.
3. Jika user juga menyebut dompet sumber, isi sourceWalletId dan sourceWallet dari daftar dompet.
4. Jika nama target TIDAK ADA: kembalikan "goal_creation_pending", simpan "name" dan "amount", lalu berikan "reply" yang menanyakan berapa target nominal tabungan tersebut.

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
5. "reply" opsional, hanya dipakai jika butuh klarifikasi yang sangat singkat.`
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
