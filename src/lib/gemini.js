const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY

/**
 * Analyze user text using Gemini 2.5 Flash API to extract transaction data.
 * Falls back to local regex parsing if API key is not set or request fails.
 */
export async function analyzeTransaction(text, imageBase64 = null, walletNames = [], financialContext = '') {
  // 1. If there's an attached image, MUST use Gemini Vision
  if (imageBase64) {
    return await callGeminiAPI(text, imageBase64, walletNames, financialContext);
  }

  // 2. Fast Path: Use local Regex for simple text commands
  const regexResult = analyzeWithRegex(text || '', walletNames);
  
  // If regex successfully understood the intent, return instantly 
  if (regexResult.type !== 'unknown') {
    return regexResult;
  }

  // 3. Fallback: Complex text. Use Gemini Advisor.
  if (GEMINI_API_KEY) {
    try {
      return await callGeminiAPI(text, null, walletNames, financialContext);
    } catch (err) {
      console.error('Gemini API Error:', err);
      return regexResult;
    }
  }

  return regexResult;
}

async function callGeminiAPI(text, imageBase64, walletNames, financialContext = '') {
  const walletList = [...walletNames, 'Tunai'].join(', ')
  const prompt = `Kamu adalah AI Financial Advisor yang cerdas, minimalis, dan berkelas.
Ekstrak informasi atau berikan analisa keuangan dari: "${text || 'Berkas Terlampir'}"

${financialContext}

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
- "delete_wallet", "undo_transaction", "create_wallet", "confirm", "cancel", "bulk_delete_wallets", "bulk_delete_transactions", "check_balance", "unknown".`

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

  // Confirmation Intent
  if (/^(ya|iy|yes|ok|siap|betul|benar)$/i.test(normalizedText)) {
    return { type: 'confirm' };
  }
  if (/^(tidak|gak|no|batal|cancel|nggak)$/i.test(normalizedText)) {
    return { type: 'cancel' };
  }

  // Bulk Delete Intent
  if (/hapus semua (wallet|dompet|rekening)/i.test(normalizedText)) {
    return { type: 'bulk_delete_wallets' };
  }
  if (/hapus (semua )?riwayat/i.test(normalizedText)) {
    return { type: 'bulk_delete_transactions' };
  }

  // Delete Wallet Intent
  let delMatch = normalizedText.match(/^(?:hapus|buang|delete|hilangkan)\s+(?:dompet|rekening|wallet)\s+([a-z0-9]+)/i);
  if (delMatch) {
    return {
      type: 'delete_wallet',
      wallet: delMatch[1]
    };
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

  // If still no wallet match, try to find a word after "ke", "di", "pakai", or a trailing word
  if (!walletMatch) {
    const prepositionMatch = normalizedText.match(/(?:ke|di|dari|pakai|pake|bank)\s+([a-z0-9]+)/i);
    if (prepositionMatch) {
      walletMatch = prepositionMatch[1];
    } else {
      // Fallback: try to see if the last word is a potential wallet (but not a category)
      const words = normalizedText.split(/\s+/);
      const lastWord = words[words.length - 1];
      const categories = ['makan', 'minum', 'kopi', 'bensin', 'transport', 'belanja', 'gaji', 'bonus', 'jajan', 'listrik'];
      if (lastWord && lastWord.length > 2 && !categories.includes(lastWord) && !lastWord.match(/\d/)) {
        walletMatch = lastWord;
      }
    }
  }

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

  const isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|tambah|plus|add|\+)/i.test(normalizedText)

  return {
    type: 'transaction',
    transactionType: isIncome ? 'income' : 'expense',
    amount,
    desc: desc.charAt(0).toUpperCase() + desc.slice(1),
    category,
    wallet,
  }
}
