import { normalizeIndonesianFinanceText } from './indonesianFinanceLanguage'

const TRAINING_CORPUS = {
  calculate_change: [
    'bayar 50rb kembali 36rb jadi habis berapa',
    'aku kasih uang 100 ribu kembali 25 ribu berapa belanjanya',
    'kembalian saya 40 dari uang 75 berarti harga barang berapa',
    'tadi bayar pakai 20k dapat kembalian 7k',
    'uang lima puluh ribu kembali tiga puluh ribu jadi jajan berapa',
    'di kasir bayar 100rb dan kembali 62rb hitung dong',
    'kalau uangku 50rb sisanya 36rb berarti kepakai berapa',
    'saya menyerahkan 200 ribu kembalian 45 ribu',
  ],
  commit_previous: [
    'oke catat pengeluaran tadi',
    'ya masukkan yang barusan',
    'sip simpan transaksi itu',
    'catet hasil hitung tadi ya',
    'boleh rekam yang sebelumnya ke pengeluaran',
    'iya tambahkan itu ke catatan',
    'lanjut masukkan belanja tadi',
    'benar catat saja yang itu',
  ],
  record_batch: [
    'beli bensin 20rb dan makan 10rb tolong catat',
    'catat kopi 15k sama parkir 5k',
    'hari ini bayar listrik 100rb lalu internet 250rb',
    'masukkan pengeluaran makan 30 dan minum 10',
    'rekam belanja sayur 25rb buah 20rb dan telur 30rb',
    'catet dua transaksi bensin 50k sama tol 15k',
    'gaji 5jt dan bonus 500rb masukkan sebagai pemasukan',
    'tadi beli obat 40rb terus vitamin 35rb',
    'aku tidak cuma beli kopi 20rb tapi juga makan 30rb tolong catat',
    'bayar bensin dua puluh ribu dan parkir lima ribu catat',
  ],
  record_single: [
    'catat beli makan 25rb',
    'saya bayar bensin 50 ribu',
    'masukkan kopi 18k ke pengeluaran',
    'tadi belanja sayur 35rb',
    'rekam gaji masuk 5 juta',
    'bayar tagihan listrik 200rb',
    'pengeluaran parkir 10 ribu',
    'dapat bonus 300rb catat pemasukan',
    'jangan lupa catat kopi ceban dari tunai',
    'tadi bayar makan dua puluh ribu tolong catat',
  ],
  advice_low_balance: [
    'uang tinggal 200rb untuk sebulan sebaiknya bagaimana',
    'saldo menipis bantu atur sampai akhir bulan',
    'dompet tinggal sedikit apa yang harus diprioritaskan',
    'gimana bertahan sampai gajian dengan uang segini',
    'sisa uang cuma 150 ribu cukup sampai akhir bulan tidak',
    'tolong buat strategi karena saldo saya kritis',
    'harus stop jajan tidak kalau uang tinggal sedikit',
    'atur kebutuhan penting saat uang hampir habis',
  ],
  cancel_previous: [
    'batal jangan catat yang tadi',
    'ga jadi masukkan transaksi itu',
    'lupakan hasil hitung barusan',
    'cancel draft sebelumnya',
    'jangan simpan belanja tadi',
    'tidak usah dicatat',
  ],
  other: [
    'halo apa kabar',
    'cuaca hari ini bagaimana',
    'ceritakan sesuatu',
    'saldo saya berapa',
    'pengeluaran bulan ini berapa',
    'transfer dari bca ke dana',
    'kalau bensin 20rb cukup tidak',
    'saya dapat kembalian 36rb',
    'jangan catat kopi 20rb',
    'tanggal 20 saya masuk kerja jam 8',
    'besok beli kopi 20rb tolong catat',
    'mungkin tadi beli kopi sekitar 20rb catat',
    'beli kopi atau makan 20rb catat',
    'cara catat beli kopi 20rb',
    'kata teman catat kopi 20rb',
    'kopi 20rb belum dibayar catat',
    'beli game usd 20 catat',
    'sisa gaji',
    'ini sisa gaji bulan lalu',
    'sisa bonus masih ada',
    'berapa sisa saldo dari gaji',
  ],
}

const NORMALIZATION_RULES = [
  [/\b(catet|catetin|catatkan|inputin|rekamkan)\b/giu, 'catat'],
  [/\b(masukin|masukkan|tambahkan)\b/giu, 'masuk'],
  [/\b(pake|pke|pk)\b/giu, 'pakai'],
  [/\b(kembaliannya|kembali|susuk)\b/giu, 'kembalian'],
  [/\b(gak|ga|nggak|enggak)\b/giu, 'tidak'],
  [/\b(oke+|okey|sip)\b/giu, 'ok'],
  [/\b(barusan|sebelumnya)\b/giu, 'tadi'],
]

function normalizeClassifierText(value = '') {
  let normalized = normalizeIndonesianFinanceText(value)

  for (const [pattern, replacement] of NORMALIZATION_RULES) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value = '') {
  const words = normalizeClassifierText(value).split(' ').filter(Boolean)
  const bigrams = words.slice(0, -1).map((word, index) => `${word}_${words[index + 1]}`)
  const characterTrigrams = words
    .filter((word) => word.length >= 5)
    .flatMap((word) => {
      const padded = `^${word}$`
      return Array.from({ length: padded.length - 2 }, (_, index) => `#${padded.slice(index, index + 3)}`)
    })

  return [...words, ...bigrams, ...characterTrigrams]
}

function trainClassifier(corpus) {
  const labels = Object.keys(corpus)
  const vocabulary = new Set()
  const classCounts = new Map()
  const tokenCounts = new Map()
  const totalTokens = new Map()
  let documentCount = 0

  for (const label of labels) {
    const examples = corpus[label]
    classCounts.set(label, examples.length)
    documentCount += examples.length
    const counts = new Map()
    let classTokenTotal = 0

    for (const example of examples) {
      for (const token of tokenize(example)) {
        vocabulary.add(token)
        counts.set(token, (counts.get(token) || 0) + 1)
        classTokenTotal += 1
      }
    }

    tokenCounts.set(label, counts)
    totalTokens.set(label, classTokenTotal)
  }

  return {
    labels,
    vocabulary,
    classCounts,
    tokenCounts,
    totalTokens,
    documentCount,
  }
}

const MODEL = trainClassifier(TRAINING_CORPUS)

/**
 * A tiny multinomial Naive Bayes model trained entirely in the browser bundle.
 * It is only a dialogue-act signal; deterministic validation still guards writes.
 */
export function classifyFinanceIntent(text = '') {
  const tokens = tokenize(text)
  if (tokens.length === 0) {
    return { label: 'other', confidence: 1, margin: 1, scores: { other: 1 } }
  }

  const vocabularySize = Math.max(MODEL.vocabulary.size, 1)
  const logScores = MODEL.labels.map((label) => {
    const prior = Math.log((MODEL.classCounts.get(label) + 1) / (MODEL.documentCount + MODEL.labels.length))
    const counts = MODEL.tokenCounts.get(label)
    const denominator = MODEL.totalTokens.get(label) + vocabularySize
    const tokenScore = tokens.reduce(
      (score, token) => score + Math.log(((counts.get(token) || 0) + 1) / denominator),
      0
    )

    return { label, logScore: prior + tokenScore }
  })

  const maxLogScore = Math.max(...logScores.map((entry) => entry.logScore))
  const exponentials = logScores.map((entry) => ({
    ...entry,
    value: Math.exp(entry.logScore - maxLogScore),
  }))
  const total = exponentials.reduce((sum, entry) => sum + entry.value, 0) || 1
  const ranked = exponentials
    .map((entry) => ({ label: entry.label, probability: entry.value / total }))
    .sort((left, right) => right.probability - left.probability)
  const [best, runnerUp] = ranked

  return {
    label: best.label,
    confidence: best.probability,
    margin: best.probability - (runnerUp?.probability || 0),
    scores: Object.fromEntries(ranked.map((entry) => [entry.label, entry.probability])),
  }
}

export function getFinanceTrainingCorpusStats() {
  return {
    labels: MODEL.labels.length,
    examples: MODEL.documentCount,
    vocabulary: MODEL.vocabulary.size,
  }
}
