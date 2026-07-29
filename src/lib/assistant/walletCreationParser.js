const DIRECT_CREATE_WALLET_PATTERN =
  /\b(?:(?:tolong|mohon)\s+)?(?:buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan)?|tambahkan|tambahin|buka(?:kan)?|create)\b(?:\s+(?:aku|saya|gue|gw|kami|kita))?(?:\s+(?:sebuah|satu))?\s+(dompet|rekening|wallet)\b/iu
const INVERTED_CREATE_WALLET_PATTERN =
  /\b(?:tambahkan|tambahin|jadikan|masukkan)\s+(.{1,64}?)\s+sebagai\s+(dompet|rekening|wallet)\b/iu
const BALANCE_SUFFIX_PATTERN =
  /\s+(?:(?:dengan|pakai|pake)\s+)?(?:saldo(?:\s+awal)?|isi(?:an)?|balance)\b[\s\S]*$/iu
const AMOUNT_SUFFIX_PATTERN =
  /\s+(?:sebesar\s+|senilai\s+)?(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rupiah|ribu|rb|k|juta|jt|miliar)?[\s\S]*$/iu
const TRAILING_POLITENESS_PATTERN =
  /\s+(?:dong|ya|yah|deh|please|pls|makasih|terima kasih)$/iu
const GENERIC_NAMES = new Set([
  'baru',
  'new',
  'dompet',
  'rekening',
  'wallet',
  'bank',
  'saya',
  'aku',
])

const BANK_BRANDS = new Map([
  ['bca', 'BCA'],
  ['bri', 'BRI'],
  ['bni', 'BNI'],
  ['btn', 'BTN'],
  ['cimb', 'CIMB'],
  ['cimb niaga', 'CIMB Niaga'],
  ['mandiri', 'Mandiri'],
  ['permata', 'Permata'],
  ['danamon', 'Danamon'],
  ['jago', 'Jago'],
  ['seabank', 'SeaBank'],
  ['sea bank', 'SeaBank'],
])

const EWALLET_BRANDS = new Map([
  ['dana', 'DANA'],
  ['ovo', 'OVO'],
  ['gopay', 'GoPay'],
  ['go pay', 'GoPay'],
  ['shopeepay', 'ShopeePay'],
  ['shopee pay', 'ShopeePay'],
  ['linkaja', 'LinkAja'],
  ['link aja', 'LinkAja'],
])

export function extractWalletCreationDetails(text = '') {
  const rawText = String(text || '').trim()
  const directMatch = rawText.match(DIRECT_CREATE_WALLET_PATTERN)
  const invertedMatch = directMatch ? null : rawText.match(INVERTED_CREATE_WALLET_PATTERN)

  if (!directMatch && !invertedMatch) {
    return {
      isCreationRequest: false,
      walletName: null,
      walletType: null,
    }
  }

  const walletNoun = directMatch?.[1] || invertedMatch?.[2] || 'dompet'
  const candidate = directMatch
    ? rawText.slice((directMatch.index || 0) + directMatch[0].length)
    : invertedMatch?.[1] || ''
  const walletName = sanitizeWalletName(candidate)

  return {
    isCreationRequest: true,
    walletName,
    walletType: inferWalletType({
      walletName,
      walletNoun,
      text: rawText,
    }),
  }
}

export function sanitizeWalletName(value = '') {
  let candidate = String(value || '')
    .replace(/^[\s:;,.-]+/u, '')
    .replace(
      /^(?:(?:baru|new)\s+)?(?:(?:yang\s+)?(?:bernama|namanya|nama)|dengan\s+nama)\s+/iu,
      ''
    )
    .replace(BALANCE_SUFFIX_PATTERN, '')
    .replace(AMOUNT_SUFFIX_PATTERN, '')
    .replace(/\s+untuk\s+(?:transaksi|mencatat|keuangan)(?:\s+.*)?$/iu, '')
    .replace(TRAILING_POLITENESS_PATTERN, '')
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’.,!?;:]+$/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()

  if (/^bank\s+/iu.test(candidate)) {
    const withoutBank = candidate.replace(/^bank\s+/iu, '').trim()
    if (BANK_BRANDS.has(withoutBank.toLowerCase())) candidate = withoutBank
  }

  if (
    !candidate ||
    candidate.length > 64 ||
    GENERIC_NAMES.has(candidate.toLowerCase()) ||
    !/[\p{L}\p{N}]/u.test(candidate)
  ) {
    return null
  }

  return formatWalletName(candidate)
}

export function parseWalletNameReply(text = '') {
  const normalized = String(text || '')
    .normalize('NFKC')
    .trim()

  if (
    !normalized ||
    normalized.split(/\s+/u).length > 8 ||
    /\b(?:dan|atau|besok|nanti|jangan|batal|tidak|bukan|saldo|isi|sebesar|rp\s*\d|\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta))\b/iu.test(
      normalized
    ) ||
    /\?\s*$/u.test(normalized)
  ) {
    return {
      walletName: null,
      walletType: null,
    }
  }

  const candidate = normalized
    .replace(/^(?:(?:nama(?:nya)?|beri nama)\s+)?(?:dompet|rekening|wallet)?\s*/iu, '')
    .replace(/\s+(?:aja|saja|ya|yah|dong|deh)$/iu, '')
    .trim()
  const walletName = sanitizeWalletName(candidate)

  return {
    walletName,
    walletType: inferWalletType({
      walletName,
      walletNoun: /\brekening\b/iu.test(normalized) ? 'rekening' : 'dompet',
      text: normalized,
    }),
  }
}

function inferWalletType({ walletName, walletNoun, text }) {
  const normalizedName = String(walletName || '').toLowerCase()
  const normalizedText = String(text || '').toLowerCase()

  if (
    walletNoun.toLowerCase() === 'rekening' ||
    BANK_BRANDS.has(normalizedName) ||
    /\b(?:rekening|bank)\b/iu.test(normalizedText)
  ) {
    return 'bank'
  }

  if (
    EWALLET_BRANDS.has(normalizedName) ||
    /\b(?:e[\s-]?wallet|dompet digital)\b/iu.test(normalizedText)
  ) {
    return 'e_wallet'
  }

  return 'cash'
}

function formatWalletName(value) {
  const normalized = value.toLowerCase()
  if (BANK_BRANDS.has(normalized)) return BANK_BRANDS.get(normalized)
  if (EWALLET_BRANDS.has(normalized)) return EWALLET_BRANDS.get(normalized)

  return value
    .split(/\s+/u)
    .map((word) => {
      if (/^[A-Z0-9]{2,}$/u.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}
