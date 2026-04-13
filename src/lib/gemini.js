const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Analyze user text using Gemini 2.5 Flash API to extract transaction data.
 * Falls back to local regex parsing if API key is not set or request fails.
 */
export async function analyzeTransaction(text, walletNames = []) {
  // Try Gemini API first
  if (GEMINI_API_KEY) {
    try {
      const walletList = [...walletNames, 'Tunai'].join(', ')
      const prompt = `Kamu adalah AI asisten keuangan pencatat pengeluaran dan pemasukan.
Ekstrak informasi dari teks berikut: "${text}"
Daftar dompet yang tersedia: ${walletList}. (pilih yang paling cocok, default: Tunai).

Kembalikan HANYA dalam format JSON valid seperti ini tanpa markdown:
{
  "type": "transaction",
  "transactionType": "expense",
  "amount": 50000,
  "desc": "Nama transaksi bersih",
  "category": "Kategori singkat (misal: Makan, Bensin, Gaji, Kopi, Belanja, Transport, Listrik, Bonus)",
  "wallet": "Nama dompet yang cocok",
  "reply": ""
}

Jika teks bukan transaksi (sapaan, pertanyaan, dll), kembalikan:
{
  "type": "greeting" atau "unknown" atau "help",
  "reply": "Balasan ramah singkat"
}`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' },
          }),
        }
      )

      const data = await response.json()
      const result = JSON.parse(data.candidates[0].content.parts[0].text)
      return result
    } catch (error) {
      console.error('Gemini API Error:', error)
      // Fall through to regex fallback
    }
  }

  // Regex fallback
  return analyzeWithRegex(text, walletNames)
}

/**
 * Local regex-based transaction parser (fallback when Gemini is unavailable)
 */
function analyzeWithRegex(text, walletNames) {
  let normalizedText = text.toLowerCase().trim()

  // Greeting detection
  if (/^(halo|hai|hi|hey|pagi|siang|sore|malam)/.test(normalizedText) && !/\d/.test(normalizedText)) {
    return {
      type: 'greeting',
      reply: 'Sistem aktif. Silakan instruksikan pencatatan pengeluaran atau pemasukan Anda hari ini.',
    }
  }

  // Normalize thousands separators
  normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
  normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')

  const moneyRegex = /(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i
  const match = normalizedText.match(moneyRegex)

  if (!match) {
    return {
      type: 'unknown',
      reply: 'Sistem membutuhkan nominal spesifik untuk memproses ledger. Contoh: "Beli kopi 50k tunai"',
    }
  }

  let amount = parseFloat(match[1].replace(',', '.'))
  const multiplier = match[2]

  if (multiplier) {
    if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000
    else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000
  } else if (amount > 0 && amount < 1000) {
    amount *= 1000
  }

  // Wallet matching
  const allWallets = [...walletNames.map((w) => w.toLowerCase()), 'tunai', 'cash']
  const walletRegex = new RegExp(`\\b(${allWallets.join('|')})\\b`, 'i')
  let walletMatch = normalizedText.match(walletRegex)?.[1]?.toLowerCase()
  if (walletMatch === 'cash') walletMatch = 'tunai'

  const wallet = walletMatch || (walletNames.length > 0 ? walletNames[0].toLowerCase() : 'tunai')

  // Category matching
  const category =
    normalizedText.match(/\b(kopi|makan|minum|bensin|transport|belanja|gaji|bonus|jajan|listrik)\b/i)?.[1]?.toLowerCase() ||
    'lainnya'

  // Description extraction
  let desc = text.replace(match[0], '').trim()
  desc = desc.replace(new RegExp(`\\b${wallet}\\b`, 'i'), '')
  desc = desc.replace(new RegExp(`\\b${category}\\b`, 'i'), '')
  desc = desc.replace(/^(beli|bayar|buat|dari|terima|dapat|pake|pakai|-|\+)\s+/gi, '').trim()
  if (!desc) desc = category.charAt(0).toUpperCase() + category.slice(1)

  const isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|\+)/i.test(normalizedText)

  return {
    type: 'transaction',
    transactionType: isIncome ? 'income' : 'expense',
    amount,
    desc: desc.charAt(0).toUpperCase() + desc.slice(1),
    category,
    wallet,
  }
}
