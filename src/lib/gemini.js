const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Analyze user text using Gemini 2.5 Flash API to extract transaction data.
 * Falls back to local regex parsing if API key is not set or request fails.
 */
export async function analyzeTransaction(text, imageBase64 = null, walletNames = []) {
  // 1. If there's an attached image, MUST use Gemini Vision
  if (imageBase64) {
    return await callGeminiAPI(text, imageBase64, walletNames);
  }

  // 2. Fast Path: Use local Regex for simple text commands
  const regexResult = analyzeWithRegex(text || '', walletNames);
  
  // If regex successfully understood the intent, return instantly to save tokens/time
  if (regexResult.type !== 'unknown') {
    return regexResult;
  }

  // 3. Fallback: Regex failed (complex text). Try Gemini AI NLP.
  if (GEMINI_API_KEY) {
    try {
      return await callGeminiAPI(text, null, walletNames);
    } catch (err) {
      console.error('Gemini API Error:', err);
      return regexResult;
    }
  }

  return regexResult;
}

async function callGeminiAPI(text, imageBase64, walletNames) {
  const walletList = [...walletNames, 'Tunai'].join(', ')
  const prompt = `Kamu adalah AI asisten keuangan pencatat pengeluaran dan pemasukan.
Ekstrak informasi dari teks atau gambar struk berikut: "${text || 'Berkas Struk Terlampir'}"
Daftar dompet yang tersedia: ${walletList}. (pilih yang paling cocok, default: Tunai).

Kembalikan HANYA dalam format JSON valid tanpa markdown. Pilih 1 dari 3 tipe ini:

1. Transaksi Biasa:
{
  "type": "transaction",
  "transactionType": "expense",
  "amount": 50000,
  "desc": "Nama transaksi bersih",
  "category": "Kategori singkat (misal: Makan, Bensin, Gaji, Kopi, Belanja, Transport, Listrik, Bonus)",
  "wallet": "Nama dompet yang cocok",
  "reply": ""
}

2. Pembuatan Dompet Baru (jika user minta buat dompet/rekening):
{
  "type": "create_wallet",
  "name": "Nama dompet (misal: BCA, Gopay)",
  "initial_balance": 500000,
  "wallet_type": "bank",
  "reply": "Komentar ramah"
}

3. Lainnya (Sapaan/Belum Jelas/Informasi):
{
  "type": "greeting" atau "unknown" atau "help",
  "reply": "Balasan ramah singkat"
}`

  const parts = [{ text: prompt }];

  if (imageBase64) {
    const mimeTypeMatch = imageBase64.match(/data:(.*?);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
    const base64Data = imageBase64.split(',')[1];
    
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    }
  )

  const data = await response.json()
  return JSON.parse(data.candidates[0].content.parts[0].text)
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

  // Undo Transaction Intent
  if (/^(hapus|undo|batalkan|batal|delete)\s+(transaksi|pengeluaran|pemasukan|terakhir|tadi)/i.test(normalizedText) || normalizedText === 'undo') {
    return { type: 'undo_transaction' };
  }

  // Check Balance Intent
  if (/^(cek|berapa|lihat|tampilkan)\s+(saldo|sisa|uang|total)/i.test(normalizedText) || /saldo \w+ berapa/i.test(normalizedText)) {
    const walletMatch = walletNames.find(w => normalizedText.includes(w.toLowerCase()));
    return {
      type: 'check_balance',
      target: walletMatch || 'all'
    };
  }

  // Create Wallet Intent
  if (/^(buat|bikin|tambah|create)\s+(dompet|rekening|wallet)/i.test(normalizedText)) {
    const moneyMatch = normalizedText.match(/(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i);
    let initialBalance = 0;
    if (moneyMatch) {
      let temp = parseFloat(moneyMatch[1].replace(',', '.'));
      const multiplier = moneyMatch[2];
      if (['k', 'rb', 'ribu'].includes(multiplier)) temp *= 1000;
      else if (['jt', 'juta'].includes(multiplier)) temp *= 1000000;
      else if (temp > 0 && temp < 1000) temp *= 1000;
      initialBalance = temp;
    }

    const nameMatch = text.match(/(?:dompet|rekening|wallet)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:isi|saldo|dengan|sebesar)\s*|\s*$|\s+(?:rp\s*)?(?:\d+))/i);
    let name = 'Dompet Baru';
    if (nameMatch && nameMatch[1]) {
      name = nameMatch[1].replace(/^(isi|saldo|sebesar|rp|dengan)\s+/i, '').trim();
      name = name.replace(/\s+\d.*/, '').trim();
      name = name.charAt(0).toUpperCase() + name.slice(1);
    }

    return {
      type: 'create_wallet',
      name: name,
      initial_balance: initialBalance,
      wallet_type: 'bank',
      reply: `Siap, dompet ${name} akan segera dibuat dengan saldo awal.`
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
