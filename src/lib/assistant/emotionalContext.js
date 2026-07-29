const EMOTIONS = Object.freeze([
  {
    value: 'urgent',
    patterns: [/\b(?:darurat|mendesak|sekarang juga|hari ini harus|panik)\b/iu],
  },
  {
    value: 'stressed',
    patterns: [/\b(?:stres|stress|tertekan|pusing|capek mikirin|berat banget)\b/iu],
  },
  {
    value: 'worried',
    patterns: [/\b(?:khawatir|cemas|takut|was-was|uang menipis|saldo tinggal)\b/iu],
  },
  {
    value: 'regretful',
    patterns: [/\b(?:menyesal|nyesel|seharusnya tidak|boros banget)\b/iu],
  },
  {
    value: 'confused',
    patterns: [/\b(?:bingung|gimana ya|tidak tahu|ga tahu|nggak ngerti)\b/iu],
  },
  {
    value: 'proud',
    patterns: [/\b(?:bangga|berhasil hemat|akhirnya tercapai|senang banget)\b/iu],
  },
  {
    value: 'motivated',
    patterns: [/\b(?:semangat|mulai hemat|mau berubah|siap menabung)\b/iu],
  },
])

export function detectEmotionalContext(text = '', financialState = {}) {
  const normalized = String(text || '').toLowerCase()
  const matches = EMOTIONS
    .map((emotion) => {
      const count = emotion.patterns.filter((pattern) => pattern.test(normalized)).length
      const punctuationBoost = /!{2,}|\?{2,}/u.test(normalized) ? 0.08 : 0
      return {
        emotion: emotion.value,
        score: Math.min(count * 0.72 + punctuationBoost, 1),
      }
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)

  const lowBalance =
    Number(financialState.totalBalance || 0) > 0 &&
    Number(financialState.totalBalance || 0) < Number(financialState.lowBalanceThreshold || 500_000)

  if (lowBalance && /\b(?:tinggal|sisa|sampai gajian|akhir bulan)\b/iu.test(normalized)) {
    matches.push({ emotion: 'worried', score: 0.65 })
  }

  const best = matches.sort((left, right) => right.score - left.score)[0]
  return {
    emotion: best?.emotion || 'neutral',
    confidence: best?.score || 0.5,
    intensifiers: Array.from(normalized.matchAll(/\b(?:banget|sangat|sekali|terus|parah)\b/giu), (match) => match[0]),
    financialConcern: /\b(?:uang|saldo|gaji|pengeluaran|boros|utang|budget|tagihan)\b/iu.test(normalized),
  }
}
