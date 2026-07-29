const NORMALIZATION_RULES = [
  [/\b(?:jgn)\b/giu, 'jangan'],
  [/\b(?:gausa|gakusa|gak usah|ga usah|nggak usah|ngga usah)\b/giu, 'tidak usah'],
  [/\b(?:batalin|batalinlah)\b/giu, 'batal'],
  [/\b(?:gak|ga|nggak|ngga|enggak|engga|kagak|kaga|ndak|tak|ora|gk|tdk)\b/giu, 'tidak'],
  [/\b(?:urung(?:kan)?|ogah)\b/giu, 'batal'],
  [/\b(?:belom|blm)\b/giu, 'belum'],
  [/\b(?:kemaren)\b/giu, 'kemarin'],
  [/\b(?:bsk|esok)\b/giu, 'besok'],
  [/\b(?:nnti)\b/giu, 'nanti'],
  [/\b(?:kira2)\b/giu, 'kira-kira'],
  [/\b(?:kurleb)\b/giu, 'kurang lebih'],
  [/\b(?:masing2)\b/giu, 'masing-masing'],
  [/\b(?:dicatetin|dicatatin|dicatet)\b/giu, 'dicatat'],
  [/\b(?:catet|catetin|catatin|catatkan|inputin|masukin|masukkin|rekamin|rekamkan)\b/giu, 'catat'],
  [/\b(?:masukkan|inputkan|input)\b/giu, 'catat'],
  [/\b(?:pake|pke|pk)\b/giu, 'pakai'],
  [/\b(?:byr|bayr)\b/giu, 'bayar'],
  [/\b(?:dibyr|dibayr)\b/giu, 'dibayar'],
  [/\b(?:kembaliannya|susuk)\b/giu, 'kembalian'],
  [/\b(?:dapet)\b/giu, 'dapat'],
  [/\b(?:tranfer|trasfer|transfr|trnasfer|trf|tf)\b/giu, 'transfer'],
]

const MONEY_SLANG = new Map([
  ['cepek', 100],
  ['gopek', 500],
  ['seceng', 1000],
  ['goceng', 5000],
  ['ceban', 10000],
  ['gocap', 50000],
  ['goban', 50000],
])

const NUMBER_WORD_VALUES = new Map([
  ['nol', 0],
  ['kosong', 0],
  ['satu', 1],
  ['se', 1],
  ['dua', 2],
  ['tiga', 3],
  ['empat', 4],
  ['lima', 5],
  ['enam', 6],
  ['tujuh', 7],
  ['delapan', 8],
  ['sembilan', 9],
  ['setengah', 0.5],
])

const NUMBER_WORD_TOKEN = [
  'setengah',
  'seratus',
  'sepuluh',
  'sebelas',
  'seribu',
  'sejuta',
  'sembilan',
  'delapan',
  'tujuh',
  'empat',
  'enam',
  'lima',
  'tiga',
  'dua',
  'satu',
  'kosong',
  'nol',
  'ratus',
  'puluh',
  'belas',
  'ribu',
  'juta',
  'se',
].join('|')

const CURRENCY_WORD_PATTERN = new RegExp(
  `\\b(?:${NUMBER_WORD_TOKEN})(?:\\s+(?:${NUMBER_WORD_TOKEN}))*(?:\\s+rupiah)?\\b`,
  'giu'
)

const RECORD_PATTERN = /\b(?:(?:di|men)?catat|simpan|rekam|input|masukkan|tambahkan)\b/iu
const CREATION_ACTION_SOURCE = '(?:buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|create)'
const NORMALIZED_CREATION_ACTION_SOURCE = `(?:${CREATION_ACTION_SOURCE}|catat)`
const DIRECT_ACTION_PATTERN = new RegExp(
  [
    '^\\s*(?:(?:tolong|mohon|bantu)\\s+)?',
    '(?:',
    '(?:transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|sisih(?:kan)?|tarik|ambil|cair(?:kan)?|keluarkan)',
    `|(?:${CREATION_ACTION_SOURCE}|hapus|buang|delete|hilangkan|ubah|ganti|rename|koreksi|revisi|batal(?:kan)?|undo|revert|pulihkan|restore|kembalikan|aktifkan\\s+kembali)`,
    '|(?:(?:yang\\s+)?(?:tadi|terakhir|barusan)|transaksi\\s+terakhir|catatan\\s+terakhir|input\\s+terakhir)\\s+(?:harusnya|seharusnya|koreksi|revisi|ubah|ganti|jadi|pindah)',
    '|(?:[\\p{L}\\p{N}-]+\\s+){1,4}(?:tadi|barusan)\\s+(?:harusnya|seharusnya|koreksi|revisi|ubah|ganti|jadi|pindah)',
    '|(?:harusnya|seharusnya)\\s+(?:(?:yang\\s+)?(?:tadi|terakhir|barusan)|transaksi\\s+terakhir|catatan\\s+terakhir|input\\s+terakhir)',
    ')\\b',
  ].join(''),
  'iu'
)
const TRANSACTION_PATTERN = /\b(?:beli|dibeli|bayar|dibayar|belanja|jajan|makan|minum|terima|diterima|dapat|gaji|bonus|pemasukan|pengeluaran|top\s?up|isi saldo|transfer|setor|tarik|pinjam|utang|hutang)\b/iu
const OCCURRENCE_PATTERN = /\b(?:tadi|barusan|baru saja|kemarin|sudah|telah)\b/iu
const CONTEXT_REFERENCE_PATTERN = /\b(?:yang\s+)?(?:itu|tersebut|barusan|sebelumnya|hasilnya|draft|yang sama)\b/iu
const AFFIRMATIVE_RECORD_ONLY_PATTERN = /^(?:ok|oke|iya|ya|sip)?\s*(?:catat|simpan|rekam)(?:\s+(?:yang\s+)?(?:tadi|itu|tersebut|barusan))?(?:\s+(?:ya|saja|aja))?\s*$/iu

const THIRD_PARTY_WORD = '(?:(?:teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan)(?:ku|nya)?|dia|doi|mereka|bos|kantor|perusahaan|orang lain)'
const TRANSACTION_VERB_WORD = '(?:beli|membeli|bayar|membayar|belanja|jajan|terima|menerima|dapat|transfer|kirim|top\\s?up)'
const THIRD_PARTY_SUBJECT_PATTERN = new RegExp(
  `\\b${THIRD_PARTY_WORD}\\b(?:\\s+[\\p{L}\\p{N}]+){0,3}\\s+\\b${TRANSACTION_VERB_WORD}\\b`,
  'iu'
)
const THIRD_PARTY_MONEY_PATTERN = new RegExp(
  `(?:\\bpakai\\s+(?:uang|duit|dana)\\s+${THIRD_PARTY_WORD}\\b|\\b(?:uang|duit|dana)(?:nya)?\\s+(?:milik|punya)\\s+${THIRD_PARTY_WORD}\\b|\\b(?:yang\\s+)?bayar\\s+${THIRD_PARTY_WORD}\\b|\\b(?:dibayar(?:i|in)?|dibayarkan|ditanggung|ditraktir|dibeliin)\\s+(?:oleh\\s+)?${THIRD_PARTY_WORD}\\b)`,
  'iu'
)
const CLEAR_INCOMING_THIRD_PARTY_PATTERN = new RegExp(
  `\\b${THIRD_PARTY_WORD}\\b.{0,45}\\b(?:transfer|kirim)\\b.{0,35}\\bke\\s+(?:saya|aku|gue)\\b`,
  'iu'
)

const FOREIGN_CURRENCY_PATTERN = /(?:us\$|\$|\u20ac|\u00a5|\u00a3|\u20b9|\u20a9|\u0e3f|\u20b1|\u20bd|\u20ab|\u20ba)|\b(?:usd|dolar|dollar|eur|euro|sgd|yen|jpy|ringgit|myr|baht|won|krw|gbp|pound|yuan|cny|cad|aud|nzd|chf|hkd|twd|inr|rupee|rupee|peso|php|vnd|rub|try|btc|bitcoin|eth|ethereum|usdt|usdc)\b|\brm\s*(?=\d)/iu
const EXPLICIT_DATE_PATTERN = /\b(?:tanggal|tgl)\s+\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b(?:pukul|jam)\s+\d{1,2}(?::\d{2})?\b/iu
const MONTH_DATE_PATTERN = /\b\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/iu
const WORD_DATE_PATTERN = /\b(?:tanggal|tgl)\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|dua belas|tiga belas|empat belas|lima belas|enam belas|tujuh belas|delapan belas|sembilan belas|dua puluh(?:\s+(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan))?|tiga puluh(?:\s+satu)?)\b/iu
const WEEKDAY_PATTERN = /\b(?:senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu)\b/iu
const RELATIVE_DATE_PATTERN = /\b(?:(?:\d+|dua|tiga|empat|lima|enam|tujuh)\s+(?:hari|minggu|pekan|bulan|tahun)\s+(?:lalu|yang lalu)|(?:minggu|pekan|bulan|tahun)\s+(?:lalu|kemarin|depan)|(?:akhir\s+)?pekan\s+(?:lalu|depan)|tadi\s+(?:malam|pagi|siang|sore|subuh)|kemarin\s+(?:malam|pagi|siang|sore|subuh)|semalam|tempo hari)\b/iu

/**
 * Normalize Indonesian finance chat without external models or locale services.
 * Currency word phrases are made explicit so downstream money parsers do not
 * need to guess their scale.
 */
export function normalizeIndonesianFinanceText(value = '') {
  let normalized = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\brp\.(?=\s*\d)/giu, 'rp')

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    normalized = normalized.replace(pattern, replacement)
  }

  normalized = normalized.replace(
    /\b(?:cepek|gopek|seceng|goceng|ceban|gocap|goban)\b/giu,
    (slang) => `${MONEY_SLANG.get(slang.toLowerCase())} rupiah`
  )

  normalized = normalized.replace(CURRENCY_WORD_PATTERN, (phrase) => {
    const withoutCurrency = phrase.replace(/\s+rupiah$/iu, '').trim()
    const words = withoutCurrency.split(/\s+/u)
    if (words.length === 1 && ['ribu', 'juta'].includes(words[0])) {
      return phrase
    }
    const hasCurrencyScale = words.some((word) =>
      ['ribu', 'juta', 'seribu', 'sejuta'].includes(word)
    )

    if (!hasCurrencyScale) return phrase

    const amount = parseIndonesianCurrencyWords(words)
    return Number.isSafeInteger(amount) && amount > 0 ? `${amount} rupiah` : phrase
  })

  return normalized
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;!?])/gu, '$1')
    .trim()
}

/**
 * Assess whether an Indonesian finance utterance can safely trigger a write.
 * This deliberately prefers clarification over guessing. Classifier scores are
 * not accepted here: every blocker is backed by deterministic textual evidence.
 */
export function assessIndonesianFinanceUtterance({
  text = '',
  hasContext = false,
  mentions = [],
} = {}) {
  const normalizedText = normalizeIndonesianFinanceText(text)
  const safeMentions = Array.isArray(mentions) ? mentions : []
  const evidence = buildEvidence(normalizedText, safeMentions)
  const ambiguities = []
  const addAmbiguity = (code, message, cues = [], details = {}) => {
    if (ambiguities.some((ambiguity) => ambiguity.code === code)) return
    ambiguities.push({
      code,
      severity: 'blocking',
      message,
      evidence: cues.map(({ value, start, end }) => ({ value, start, end })),
      ...details,
    })
  }

  const idiomSafeText = maskPositiveNegationIdioms(normalizedText)
  const recordRequested = evidence.recordCues.length > 0
  const directActionRequested = evidence.directActionCues.length > 0
  const explicitWriteRequested = recordRequested || directActionRequested
  const transactionLike = TRANSACTION_PATTERN.test(normalizedText) ||
    evidence.currencyMentionCount > 0 ||
    safeMentions.length > 0

  if (evidence.hypotheticalCues.length > 0 || evidence.futureCues.length > 0) {
    addAmbiguity(
      'HYPOTHETICAL_OR_FUTURE',
      'Pesan menyatakan rencana, kemungkinan, atau waktu mendatang; belum aman dianggap sebagai transaksi yang sudah terjadi.',
      [...evidence.hypotheticalCues, ...evidence.futureCues]
    )
  }

  if (evidence.approximationCues.length > 0) {
    addAmbiguity(
      'APPROXIMATE_AMOUNT',
      'Nominal dinyatakan sebagai perkiraan atau rentang, bukan angka final.',
      evidence.approximationCues
    )
  }

  if (evidence.alternativeCues.length > 0) {
    addAmbiguity(
      'ALTERNATIVE_INTERPRETATION',
      'Pesan memuat pilihan alternatif sehingga item final belum tunggal.',
      evidence.alternativeCues
    )
  }

  if (evidence.exclusionCues.length > 0) {
    addAmbiguity(
      'EXCLUSION_SCOPE',
      'Pesan mengecualikan item, sumber, atau tujuan, tetapi parser belum memetakan pengecualian itu secara aman.',
      evidence.exclusionCues
    )
  }

  if (hasSharedAmountScope(normalizedText, safeMentions)) {
    addAmbiguity(
      'SHARED_AMOUNT_SCOPE',
      'Satu nominal dapat berarti total gabungan atau nominal salah satu item.',
      collectMatches(
        normalizedText,
        /(?:\b(?:dan|sama|serta|plus|beserta|berikut|sekaligus)\b|[&+/])/iu,
        'coordination'
      )
    )
  }

  if (hasMultipleActionArguments(normalizedText)) {
    addAmbiguity(
      'MULTIPLE_ACTION_ARGUMENTS',
      'Aksi menyebut lebih dari satu sumber atau tujuan, tetapi belum memetakan nominal untuk setiap perpindahan.',
      collectMatches(
        normalizedText,
        /(?:\b(?:dan|sama|serta|plus|beserta|sekaligus|lalu|kemudian)\b|[&+])/iu,
        'multiple_action_arguments'
      )
    )
  }

  if (hasUnsupportedMultipleMutationAmounts(normalizedText, safeMentions)) {
    addAmbiguity(
      'MULTIPLE_MUTATION_AMOUNTS',
      'Aksi mutasi memuat lebih dari satu nominal, tetapi parser belum memiliki pemetaan aman untuk semua nominal tersebut.',
      []
    )
  }

  if (hasUnmodeledInitialFunding(normalizedText, safeMentions)) {
    addAmbiguity(
      'UNMODELED_INITIAL_FUNDING',
      'Pembuatan dompet atau target menyebut sumber dana, tetapi nominal target, saldo awal, dan perpindahan dananya belum dipisahkan.',
      collectMatches(normalizedText, /\b(?:dari|pakai|via)\b/iu, 'initial_funding')
    )
  }

  const repeatedTransactionCues = collectMatches(
    normalizedText,
    /(?:\b(?:[2-9]|[1-9]\d+|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s*(?:kali|x)\b|\b(?:[2-9]|[1-9]\d+)\s*×)/iu,
    'transaction_multiplicity'
  )
  const hasExplicitTotal = /\btotal(?:nya)?\s+(?:rp\s*)?\d+(?:[.,]\d+)?\s*(?:rupiah|rb|ribu|k|jt|juta)?\b/iu.test(normalizedText)
  const unitPriceCues = hasExplicitTotal
    ? []
    : collectMatches(
        normalizedText,
        /\b(?:[2-9]|[1-9]\d+|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh)\s+[\p{L}]+(?:\s+[\p{L}]+){0,2}[^.!?]{0,60}(?:masing-masing|\bper\s+[\p{L}]+|@\s*(?:rp\s*)?\d)/iu,
        'transaction_multiplicity'
      )
  const multiplicityCues = [...repeatedTransactionCues, ...unitPriceCues]
  if (transactionLike && multiplicityCues.length > 0) {
    addAmbiguity(
      'TRANSACTION_MULTIPLICITY',
      'Pesan menyebut transaksi berulang, tetapi parser belum memetakan nominal dan jumlah kejadian secara aman.',
      multiplicityCues
    )
  }

  if (evidence.metaCues.length > 0 || evidence.permissionQuestionCues.length > 0) {
    addAmbiguity(
      'META_OR_PERMISSION',
      'Pesan adalah contoh, pertanyaan cara, simulasi, atau permintaan izin; bukan instruksi pencatatan final.',
      [...evidence.metaCues, ...evidence.permissionQuestionCues]
    )
  }

  if (evidence.alreadyRecordedCues.length > 0) {
    addAmbiguity(
      'ALREADY_RECORDED_OR_HABITUAL',
      'Pesan melaporkan aksi atau pencatatan yang sudah atau biasa dilakukan; menjalankannya lagi berisiko membuat data duplikat.',
      evidence.alreadyRecordedCues
    )
  }

  if (hasAmbiguousThirdPartyOwnership(normalizedText)) {
    addAmbiguity(
      'THIRD_PARTY_OWNERSHIP',
      'Belum jelas apakah transaksi dan uang tersebut milik pengguna atau pihak lain.',
      collectMatches(
        normalizedText,
        new RegExp(`\\b${THIRD_PARTY_WORD}\\b`, 'iu'),
        'third_party'
      )
    )
  }

  const nonOccurrenceCues = collectNonOccurrenceCues(idiomSafeText)
  if (nonOccurrenceCues.length > 0 || evidence.cancelCues.length > 0) {
    addAmbiguity(
      'NON_OCCURRENCE',
      'Pesan menyangkal, membatalkan, atau menyatakan transaksi belum terjadi.',
      [...nonOccurrenceCues, ...evidence.cancelCues]
    )
  }

  if (evidence.unsupportedDateCues.length > 0) {
    addAmbiguity(
      'UNSUPPORTED_DATE',
      'Tanggal atau waktu yang disebut belum didukung secara aman oleh pencatat otomatis.',
      evidence.unsupportedDateCues
    )
  }

  if (evidence.foreignCurrencyCues.length > 0) {
    addAmbiguity(
      'FOREIGN_CURRENCY',
      'Mata uang asing memerlukan kurs dan mata uang ledger yang eksplisit.',
      evidence.foreignCurrencyCues
    )
  }

  if (!hasContext && hasDanglingReference(normalizedText, recordRequested)) {
    addAmbiguity(
      'DANGLING_REFERENCE',
      'Pesan merujuk hasil atau transaksi sebelumnya, tetapi tidak ada konteks aktif.',
      evidence.contextReferenceCues
    )
  }

  if (hasContext && hasDraftSubsetAmbiguity(normalizedText)) {
    addAmbiguity(
      'DRAFT_SUBSET_AMBIGUITY',
      'Pesan hanya memilih atau mengecualikan sebagian draft tanpa pemetaan item yang pasti.',
      collectMatches(
        normalizedText,
        /\b(?:cuma|hanya|kecuali|selain|sisanya|sebagian|yang pertama|yang kedua|nomor satu|nomor dua|jangan yang)\b/iu,
        'draft_subset'
      )
    )
  }

  if (hasAmbiguousTopup(normalizedText)) {
    addAmbiguity(
      'TOPUP_DIRECTION',
      'Top up dapat berarti transfer antar dompet, pengeluaran, atau biaya layanan.',
      collectMatches(normalizedText, /\b(?:top\s?up|isi saldo)\b/iu, 'topup')
    )
  }

  if (hasAmbiguousLoan(normalizedText)) {
    addAmbiguity(
      'LOAN_DIRECTION',
      'Belum jelas apakah nominal utang atau pinjaman adalah dana masuk, pembayaran, atau perpindahan kewajiban.',
      collectMatches(normalizedText, /\b(?:utang|hutang|pinjam|pinjaman|kasbon|talang|cicilan)\b/iu, 'loan')
    )
  }

  const implicitUnitMentions = safeMentions.filter((mention) =>
    mention && mention.explicitUnit === false && Boolean(mention.inferredUnit)
  )
  const hasExplicitUnitAnchor = safeMentions.some((mention) => mention?.explicitUnit === true) ||
    /\b\d+(?:[.,]\d+)?\s*(?:rupiah|rb|ribu|k|jt|juta)\b/iu.test(normalizedText)
  if (implicitUnitMentions.length > 0 && !hasExplicitUnitAnchor) {
    addAmbiguity(
      'IMPLICIT_CURRENCY_UNIT',
      'Skala nominal disimpulkan tanpa penanda rupiah, ribu, atau juta.',
      [],
      { mentionIndexes: implicitUnitMentions.map((mention) => safeMentions.indexOf(mention)) }
    )
  }

  if (transactionLike && !explicitWriteRequested && evidence.cancelCues.length === 0) {
    addAmbiguity(
      'NO_EXPLICIT_WRITE_REQUEST',
      'Pesan menyebut transaksi, tetapi tidak memberi instruksi eksplisit untuk mencatat atau menjalankan aksi.',
      []
    )
  }

  const speechAct = inferSpeechAct({
    evidence,
    recordRequested,
    directActionRequested,
  })

  return {
    normalizedText,
    speechAct,
    evidence: {
      ...evidence,
      recordRequested,
      directActionRequested,
      explicitWriteRequested,
      hasContext: Boolean(hasContext),
    },
    ambiguities,
    blocksWrite: ambiguities.length > 0 || !explicitWriteRequested,
  }
}

function parseIndonesianCurrencyWords(inputWords) {
  const words = inputWords.flatMap((word) => {
    if (word === 'seribu') return ['satu', 'ribu']
    if (word === 'sejuta') return ['satu', 'juta']
    return [word]
  })
  let total = 0
  let group = []

  for (const word of words) {
    if (word === 'juta' || word === 'ribu') {
      const multiplier = word === 'juta' ? 1000000 : 1000
      const groupValue = group.length > 0 ? parseBelowThousand(group) : 1
      if (!Number.isFinite(groupValue)) return 0
      total += groupValue * multiplier
      group = []
    } else {
      group.push(word)
    }
  }

  const remainder = parseBelowThousand(group)
  if (!Number.isFinite(remainder)) return 0
  return total + remainder
}

function parseBelowThousand(words) {
  if (words.length === 0) return 0
  if (words[0] === 'seratus') return 100 + parseBelowHundred(words.slice(1))

  const hundredIndex = words.indexOf('ratus')
  if (hundredIndex >= 0) {
    const hundreds = parseBelowHundred(words.slice(0, hundredIndex))
    if (!Number.isFinite(hundreds) || hundreds <= 0) return Number.NaN
    return hundreds * 100 + parseBelowHundred(words.slice(hundredIndex + 1))
  }

  return parseBelowHundred(words)
}

function parseBelowHundred(words) {
  if (words.length === 0) return 0
  if (words[0] === 'sepuluh') return 10 + parseSimpleUnits(words.slice(1))
  if (words[0] === 'sebelas') return 11 + parseSimpleUnits(words.slice(1))

  const tensIndex = words.indexOf('puluh')
  if (tensIndex >= 0) {
    const tens = parseSimpleUnits(words.slice(0, tensIndex))
    if (!Number.isFinite(tens) || tens <= 0) return Number.NaN
    return tens * 10 + parseSimpleUnits(words.slice(tensIndex + 1))
  }

  const teensIndex = words.indexOf('belas')
  if (teensIndex >= 0) {
    const teens = parseSimpleUnits(words.slice(0, teensIndex))
    if (!Number.isFinite(teens) || teens <= 0) return Number.NaN
    return 10 + teens + parseSimpleUnits(words.slice(teensIndex + 1))
  }

  return parseSimpleUnits(words)
}

function parseSimpleUnits(words) {
  return words.reduce((sum, word) => {
    const value = NUMBER_WORD_VALUES.get(word)
    return value === undefined || !Number.isFinite(sum) ? Number.NaN : sum + value
  }, 0)
}

function buildEvidence(normalizedText, mentions) {
  return {
    recordCues: collectMatches(normalizedText, RECORD_PATTERN, 'record'),
    directActionCues: collectMatches(normalizedText, DIRECT_ACTION_PATTERN, 'direct_action'),
    occurrenceCues: collectMatches(normalizedText, OCCURRENCE_PATTERN, 'occurrence'),
    hypotheticalCues: collectMatches(
      normalizedText,
      /\b(?:kalau|jika|misal(?:kan|nya)?|seandainya|andaikan|andaikata|anggap(?:lah)?(?:\s+saja)?|umpama(?:nya)?|seumpama|rencana|berencana|mungkin|kayaknya|sepertinya)\b/iu,
      'hypothetical'
    ),
    futureCues: collectMatches(
      normalizedText,
      /\b(?:nanti|besok|lusa|minggu depan|pekan depan|bulan depan|tahun depan)\b|\b(?:akan|mau|ingin|hendak)\s+(?!catat\b|simpan\b|rekam\b)(?:[\p{L}]+\s+){0,2}(?:beli|bayar|belanja|jajan|terima|top\s?up|transfer)\b/iu,
      'future'
    ),
    approximationCues: collectMatches(
      normalizedText,
      /(?:±|\+\/-?)|\b(?:sekitar(?:an)?|kisaran|kira-kira|kurang lebih|lebih kurang|hampir|nyaris|perkiraan|estimasi|maks(?:imal)?|minimum|minimal|mentok|setidaknya|paling banyak|paling sedikit)\b|\b(?:kurang|lebih|di bawah|di atas|bawah|atas)\s+(?:dari\s+)?(?:rp\s*)?\d|\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta)?\s+lebih\b|\b\d+(?:[.,]\d+)?\s*(?:rb|ribu|k|jt|juta)?-an\b/iu,
      'approximation'
    ),
    alternativeCues: collectMatches(normalizedText, /\b(?:atau|ataukah|dan\/atau)\b/iu, 'alternative'),
    exclusionCues: collectMatches(normalizedText, /\b(?:kecuali|selain|tanpa)\b/iu, 'exclusion'),
    metaCues: collectMatches(
      normalizedText,
      /\b(?:contoh(?: kalimat)?|sekadar contoh|sekedar ngetes|cuma contoh|cuma mengetes|simulasi|tutorial|demo|uji coba|menguji|mengetes|tes parser|test parser|format perintah|terjemahkan|apa artinya|artinya apa|maksud kalimat|harga(?:nya)?|biaya normal|biaya standar|tarif normal|nilai(?:nya|\s+\w+nya)?|(?:cara|bagaimana cara|gimana cara)\s+(?:catat|mencatat|transfer|pindah(?:kan|in)?|nabung|menabung|setor|tarik|buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|hapus|ubah|ganti|koreksi|batalkan|pulihkan))\b/iu,
      'meta'
    ),
    permissionQuestionCues: collectMatches(
      normalizedText,
      /\b(?:bolehkah|bisakah|bisa tidak|dapatkah|apa(?:kah)?\s+bisa)\b|\b(?:bisa|boleh)\s+(?:tolong\s+)?(?:catat|simpan|rekam|transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|tarik|ambil|cair(?:kan)?|buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|hapus|ubah|ganti|koreksi|revisi|batal(?:kan)?|pulihkan|restore)\b|\b(?:untuk apa|buat apa|kenapa|mengapa|gimana|bagaimana)\b|\b(?:bisa|boleh)\s*[.!?]*$|\?\s*$/iu,
      'permission_question'
    ),
    alreadyRecordedCues: collectMatches(
      normalizedText,
      /\b(?:sudah|telah|pernah|biasanya|selalu|rutin)\s+(?:(?:di|men)?catat|simpan|rekam|input)\b|\b(?:tadi|kemarin|barusan)\b[^.!?]{0,35}\b(?:saya|aku|gue|kami)\s+(?:men)?catat\b|\b(?:saya|aku|gue|kami)\s+(?:men)?catat\b|\b(?:transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|tarik|ambil|cair(?:kan)?|buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|hapus|ubah|ganti|koreksi)\b[^.!?]{0,100}\b(?:tadi|kemarin|barusan|sudah dilakukan|telah dilakukan|sudah selesai|telah selesai|sudah berhasil|telah berhasil)\b/iu,
      'already_recorded'
    ),
    cancelCues: collectMatches(
      maskPositiveNegationIdioms(normalizedText),
      /\b(?:batal|tidak jadi|tidak usah|tidak perlu|jangan)\s+(?:(?:di|men)?catat|simpan|rekam|transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|tarik|ambil|cair(?:kan)?|buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|hapus|ubah|ganti|koreksi|revisi|pulihkan|restore)\b|\b(?:tapi\s+)?jangan\s+(?:sekarang|dulu)\b|\bbelum\s+sekarang\b/iu,
      'cancel'
    ),
    contextReferenceCues: collectContextReferenceCues(normalizedText),
    unsupportedDateCues: [
      ...collectMatches(normalizedText, EXPLICIT_DATE_PATTERN, 'unsupported_date'),
      ...collectMatches(normalizedText, MONTH_DATE_PATTERN, 'unsupported_date'),
      ...collectMatches(normalizedText, WORD_DATE_PATTERN, 'unsupported_date'),
      ...collectMatches(normalizedText, WEEKDAY_PATTERN, 'unsupported_date'),
      ...collectMatches(normalizedText, RELATIVE_DATE_PATTERN, 'unsupported_date'),
    ],
    foreignCurrencyCues: collectMatches(normalizedText, FOREIGN_CURRENCY_PATTERN, 'foreign_currency'),
    currencyMentionCount: countCurrencyMentions(normalizedText, mentions),
    mentionCount: mentions.length,
  }
}

function inferSpeechAct({ evidence, recordRequested, directActionRequested }) {
  if (evidence.cancelCues.length > 0) return 'cancel'
  if (evidence.metaCues.length > 0) return 'meta'
  if (evidence.hypotheticalCues.length > 0 || evidence.futureCues.length > 0) return 'hypothetical'
  if (evidence.permissionQuestionCues.length > 0) return 'question'
  if (recordRequested && evidence.contextReferenceCues.length > 0) return 'contextual_record_request'
  if (recordRequested) return 'record_request'
  if (directActionRequested) return 'action_request'
  return 'statement'
}

function collectMatches(text, pattern, kind) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const matcher = new RegExp(pattern.source, flags)
  return [...String(text || '').matchAll(matcher)].map((match) => ({
    kind,
    value: match[0],
    start: match.index || 0,
    end: (match.index || 0) + match[0].length,
  }))
}

function maskPositiveNegationIdioms(text) {
  return String(text || '')
    .replace(/\bjangan lupa(?=\s+(?:catat|simpan|rekam))\b/giu, 'ingat untuk')
    .replace(/\b(?:tidak|bukan) cuma\b(?=[^.!?]{0,140}\btapi juga\b)/giu, 'selain')
}

function collectNonOccurrenceCues(text) {
  const patterns = [
    /\b(?:tidak|belum|jangan)\s+(?:jadi\s+)?(?:pernah\s+)?(?:di)?(?:beli|bayar|belanja|jajan|terima|dapat|masuk|keluar|top\s?up|transfer)\b/iu,
    /\b(?:hampir|nyaris)\s+(?:beli|bayar|belanja|jajan|terima|transfer)\b/iu,
    /\b(?:beli|dibeli|bayar|dibayar|belanja|jajan|terima|diterima|masuk|transfer)(?:\s+[\p{L}\p{N}.,]+){0,8}\s+(?:tidak|belum)(?:\s+jadi)?\b/iu,
    /\b(?:tidak jadi|batal)\s+(?:di)?(?:beli|bayar|belanja|jajan|terima|transfer)?\b/iu,
    /\b(?:harusnya|seharusnya|koreksi|revisi|ubah|ganti)\b[^.!?]{0,80}\b(?:bukan|tidak|jangan)\s+(?:rp\s*)?\d/iu,
    /\b(?:(?:yang\s+)?(?:tadi|terakhir|barusan)|transaksi terakhir|catatan terakhir|input terakhir)\b[^.!?]{0,80}\b(?:bukan|tidak|jangan)\s+(?:rp\s*)?\d/iu,
    /\b(?:transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|sisih(?:kan)?|tarik|ambil|cair(?:kan)?|keluarkan|buat(?:kan)?|buatin|membuat(?:kan)?|bikin(?:kan)?|bikinin|tambah(?:kan|in)?|buka(?:kan)?|create|hapus|buang|delete|hilangkan|ubah|ganti|rename|koreksi|revisi|batal(?:kan)?|undo|revert|pulihkan|restore|kembalikan)\b[^.!?]{0,120}\b(?:bukan|tidak|jangan)\b/iu,
    /\b(?:gaji|refund|pengembalian dana|transfer|pembayaran|tagihan)\b[^.!?]{0,60}\b(?:masih\s+)?(?:pending|diproses|dalam proses|tertunda|menunggu|belum cair|belum masuk|belum diterima)\b/iu,
    /\b(?:gratis|cuma lihat|hanya lihat|tidak pakai (?:uang|duit|dana)(?:ku|saya)?)\b/iu,
    /\bbukan\b[^.!?]{0,100}\b(?:tapi|melainkan)\b/iu,
  ]

  return patterns.flatMap((pattern) => collectMatches(text, pattern, 'non_occurrence'))
}

function collectContextReferenceCues(text) {
  const patterns = [
    /\b(?:catat|simpan|rekam|ubah|ganti|batal|hapus)\s+(?:(?:ke\s+)?(?:pemasukan|pengeluaran)\s+)?(?:ya\s+)?(?:yang\s+)?(?:tadi|itu|tersebut|barusan|sebelumnya|hasilnya|draft)\b/iu,
    /\b(?:yang\s+)?(?:itu|tersebut|barusan|sebelumnya|hasilnya|draft)\s+(?:tolong\s+)?(?:catat|simpan|rekam|ubah|ganti|batal|hapus)\b/iu,
    CONTEXT_REFERENCE_PATTERN,
  ]
  const matches = patterns.flatMap((pattern) => collectMatches(text, pattern, 'context_reference'))
  return matches.filter((match, index) =>
    matches.findIndex((candidate) => candidate.start === match.start && candidate.end === match.end) === index
  )
}

function countCurrencyMentions(text, mentions) {
  if (mentions.length > 0) return mentions.length
  return collectMatches(
    text,
    /(?:\brp\s*\d+(?:[.,]\d+)?|\b\d+(?:[.,]\d+)?\s*(?:rupiah|rb|ribu|k|jt|juta)\b)/iu,
    'currency'
  ).length
}

function hasSharedAmountScope(text, mentions) {
  const conjunctionPattern = '(?:\\b(?:dan|sama|serta|plus|beserta|berikut|sekaligus)\\b|[&+/])'
  const conjunction = new RegExp(conjunctionPattern, 'iu').test(text)
  if (!conjunction || countCurrencyMentions(text, mentions) !== 1) return false

  const actionOrItem = '(?:beli|bayar|belanja|jajan|makan|minum|terima|gaji|bonus|bensin|kopi|roti|makanan|parkir|obat|tagihan|pulsa|token)'
  const amount = '(?:rp\\s*)?\\d+(?:[.,]\\d+)?\\s*(?:rupiah|rb|ribu|k|jt|juta)?'
  const coordinatedItems = new RegExp(
    `\\b${actionOrItem}\\b[^,;.!?]{0,55}${conjunctionPattern}[^,;.!?]{0,55}\\b${actionOrItem}\\b`,
    'iu'
  )
  const actionWithSharedAmount = new RegExp(
    `\\b(?:beli|bayar|belanja|jajan|makan|minum|terima)\\b[^,;.!?]{0,55}${conjunctionPattern}[^,;.!?]{0,55}\\b${amount}\\b`,
    'iu'
  )

  return coordinatedItems.test(text) || actionWithSharedAmount.test(text)
}

function hasMultipleActionArguments(text) {
  const coordinationPattern = '(?:\\b(?:dan|sama|serta|plus|beserta|sekaligus|lalu|kemudian)\\b|[&+])'
  const creationActionPattern = new RegExp(
    `^(?:(?:tolong|mohon|bantu)\\s+)?${NORMALIZED_CREATION_ACTION_SOURCE}\\s+(?:\\S+\\s+){0,3}?(?:dompet|rekening|wallet|target|goal|tabungan|milestone)\\b`,
    'iu'
  )
  if (
    creationActionPattern.test(text) &&
    new RegExp(coordinationPattern, 'iu').test(text)
  ) {
    return true
  }

  if (!/\b(?:transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|tarik|ambil|cair(?:kan)?|keluarkan)\b/iu.test(text)) {
    return false
  }

  return new RegExp(
    `\\b(?:dari|ke)\\b[^.!?]{1,80}${coordinationPattern}(?!\\s*(?:catat|simpan|rekam)\\b)`,
    'iu'
  ).test(text)
}

function hasUnsupportedMultipleMutationAmounts(text, mentions) {
  if (!Array.isArray(mentions) || mentions.length <= 1) return false

  return new RegExp(
    `^(?:(?:tolong|mohon|bantu)\\s+)?(?:transfer|pindah(?:kan|in)?|geser|kirim(?:kan)?|tabung|nabung|setor|sisih(?:kan)?|tarik|ambil|cair(?:kan)?|keluarkan|${NORMALIZED_CREATION_ACTION_SOURCE}|ubah|ganti|rename|koreksi|revisi)\\b`,
    'iu'
  ).test(text) ||
    /^(?:[\p{L}\p{N}-]+\s+){0,4}(?:(?:yang\s+)?(?:tadi|terakhir|barusan)|transaksi terakhir|catatan terakhir|input terakhir)\b[^.!?]{0,50}\b(?:harusnya|seharusnya|koreksi|revisi|ubah|ganti|jadi|pindah)\b/iu.test(text)
}

function hasUnmodeledInitialFunding(text, mentions) {
  const creationWithFundingPattern = new RegExp(
    `^(?:(?:tolong|mohon|bantu)\\s+)?${NORMALIZED_CREATION_ACTION_SOURCE}\\s+(?:\\S+\\s+){0,3}?(?:dompet|rekening|wallet|target|goal|tabungan|milestone)\\b[^.!?]{0,140}\\b(?:dari|pakai|via)\\b`,
    'iu'
  )
  return Array.isArray(mentions) &&
    mentions.length > 0 &&
    creationWithFundingPattern.test(text)
}

function hasAmbiguousThirdPartyOwnership(text) {
  const reportedSpeech = new RegExp(
    `(?:\\b(?:kata|menurut)\\s+${THIRD_PARTY_WORD}\\b|\\b${THIRD_PARTY_WORD}\\b.{0,20}\\b(?:bilang|cerita)\\b)`,
    'iu'
  ).test(text)
  if (reportedSpeech || THIRD_PARTY_MONEY_PATTERN.test(text)) return true
  if (!THIRD_PARTY_SUBJECT_PATTERN.test(text)) return false
  return !CLEAR_INCOMING_THIRD_PARTY_PATTERN.test(text)
}

function hasDanglingReference(text, recordRequested) {
  if (AFFIRMATIVE_RECORD_ONLY_PATTERN.test(text)) return true
  if (!recordRequested) return false

  return collectContextReferenceCues(text).length > 0 &&
    countCurrencyMentions(text, []) === 0 &&
    !/\b(?:beli|bayar|belanja|jajan|makan|minum|gaji|bonus)\b/iu.test(text)
}

function hasDraftSubsetAmbiguity(text) {
  if (AFFIRMATIVE_RECORD_ONLY_PATTERN.test(text)) return false
  if (/\b(?:tidak|bukan) cuma\b[^.!?]{0,140}\btapi juga\b/iu.test(text)) return false

  return /\b(?:cuma|hanya|kecuali|selain|tanpa|minus|sisanya|sebagian|yang pertama|yang kedua|nomor(?:\s+|-\s*)?(?:satu|dua|1|2)|jangan yang|skip|coret|hapus|buang|hilangkan)\b/iu.test(text) ||
    /\byang\s+[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,3}\s+(?:aja|saja|doang)\b/iu.test(text) ||
    /\b(?:catat|simpan|rekam)\b[^.!?]{0,80}\b(?:item|transaksi)\s+[\p{L}\p{N}]+\b/iu.test(text) ||
    /\b(?:catat|simpan|rekam)\b[^.!?]{0,80}\b(?:tidak usah|jangan)\s+[\p{L}\p{N}]+\b/iu.test(text) ||
    /\b(?:catat|simpan|rekam)\b[^.!?]{0,80}\b[\p{L}\p{N}]+\s+tidak\b/iu.test(text) ||
    /\b(?:catat|simpan|rekam)\s+(?:yang\s+)?(?:bensin(?:nya)?|kopi(?:nya)?|makan(?:an|nya)?|jajan(?:nya)?|parkir(?:nya)?|tagihan(?:nya)?|gaji(?:nya)?|bonus(?:nya)?|obat(?:nya)?)\b/iu.test(text) ||
    /\b(?:catat|simpan|rekam)\s+(?!saja\b|aja\b|yang\s+(?:tadi|itu)\b)[^.!?]{1,60}\s+(?:saja|aja)\b/iu.test(text)
}

function hasAmbiguousTopup(text) {
  if (!/\b(?:top\s?up|isi saldo)\b/iu.test(text)) return false
  if (/\bbiaya(?:\s+admin)?\s+(?:top\s?up|isi saldo)\b[^.!?]{0,80}\b(?:sebagai\s+)?pengeluaran\b/iu.test(text)) {
    return false
  }
  if (/\btransfer\b[^.!?]{0,100}\bdari\b[^.!?]{1,50}\bke\b/iu.test(text)) return false
  return true
}

function hasAmbiguousLoan(text) {
  if (!/\b(?:utang|hutang|pinjam|pinjaman|kasbon|talang|cicilan)\b/iu.test(text)) return false
  return !/\b(?:bayar|lunasi|terima pembayaran|menerima pembayaran)\b[^.!?]{0,100}\b(?:sebagai\s+)?(?:pengeluaran|pemasukan)\b/iu.test(text)
}
