const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_TEXT_LENGTH = 2_000
const MAX_CONTEXT_LENGTH = 12_000
const MAX_WALLET_NAMES = 50
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

type AnalyzePayload = {
  text?: string
  imageBase64?: string | null
  walletNames?: string[]
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
  walletNames = [],
  financialContext = '',
}: AnalyzePayload) {
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is not configured in Supabase Edge Functions.')
  }

  const prompt = buildPrompt(text, financialContext, walletNames)
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
  walletNames = [],
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

  if (!Array.isArray(walletNames) || walletNames.length > MAX_WALLET_NAMES) {
    throw new ValidationError('Daftar dompet tidak valid.')
  }

  if (walletNames.some((walletName) => typeof walletName !== 'string' || walletName.length > 100)) {
    throw new ValidationError('Nama dompet tidak valid.')
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

function buildPrompt(text: string, financialContext: string, walletNames: string[]) {
  const walletList = [...walletNames, 'Tunai'].join(', ')

  return `Kamu adalah AI Financial Advisor yang cerdas, minimalis, dan berkelas.
Ekstrak informasi atau berikan analisa keuangan dari: "${text || 'Berkas Terlampir'}"

${financialContext}

DOMPET YANG TERSEDIA:
${walletList || 'Tunai'}

PANDUAN:
1. Jika user meminta tips, motivasi, analisa, atau saham: gunakan data keuangan di atas untuk memberikan jawaban yang SANGAT SINGKAT, tajam, dan edukatif.
2. Transaksi: "tambah", "masuk", "topup" = INCOME. "beli", "bayar", "keluar" = EXPENSE.
3. Jika transaksi: ekstrak data seperti biasa.
4. Gunakan bahasa Indonesia yang profesional namun modern.
5. Hindari daftar contoh perintah.

Kembalikan HANYA JSON tanpa markdown. Tipe:
- "transaction": { transactionType, amount, desc, category, wallet, reply }
- "advice": { reply }
- "goal_contribution": { goalId, amount, reply }
- "goal_creation_pending": { name, amount, reply }
- "transfer": { amount, from, to, reply }
- "delete_wallet", "undo_transaction", "create_wallet", "confirm", "cancel", "bulk_delete_wallets", "bulk_delete_transactions", "check_balance", "unknown".

INSTRUKSI KHUSUS TABUNGAN (GOALS):
1. Jika user ingin menabung/menyisihkan uang ke target tertentu, periksa daftar "activeGoals" di konteks.
2. Jika nama target ADA di daftar: kembalikan "goal_contribution" dengan goalId yang sesuai.
3. Jika nama target TIDAK ADA: kembalikan "goal_creation_pending", simpan "name" dan "amount", lalu berikan "reply" yang menanyakan berapa target nominal tabungan tersebut.

INSTRUKSI KHUSUS TRANSFER:
1. Jika user ingin memindahkan uang antar dompet, kembalikan "type": "transfer".
2. "amount": nominal yang dipindahkan.
3. "from": nama dompet asal.
4. "to": nama dompet tujuan.
5. "reply": konfirmasi singkat yang merangkum rencana transfer tersebut.`
}
