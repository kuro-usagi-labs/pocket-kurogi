import { describe, expect, it } from 'vitest'
import {
  assessIndonesianFinanceUtterance,
  normalizeIndonesianFinanceText,
} from './indonesianFinanceLanguage'

function codes(result) {
  return result.ambiguities.map((ambiguity) => ambiguity.code)
}

function assess(text, options = {}) {
  return assessIndonesianFinanceUtterance({ text, ...options })
}

describe('normalizeIndonesianFinanceText', () => {
  it('is idempotent for numeric juta and ribu amounts', () => {
    const once = normalizeIndonesianFinanceText('ubah target jadi 7 juta')
    expect(normalizeIndonesianFinanceText(once)).toBe(once)
  })
  it('normalizes common Indonesian finance slang and typos', () => {
    expect(normalizeIndonesianFinanceText('Gak jadi dicatetin, tadi dibayr pke cash'))
      .toBe('tidak jadi dicatat, tadi dibayar pakai cash')
    expect(normalizeIndonesianFinanceText('TF lalu catetin kembaliannya'))
      .toBe('transfer lalu catat kembalian')
  })

  it.each([
    ['dua puluh ribu', '20000 rupiah'],
    ['seratus lima puluh ribu', '150000 rupiah'],
    ['satu juta dua ratus ribu', '1200000 rupiah'],
    ['setengah juta', '500000 rupiah'],
    ['dua ratus tiga puluh empat ribu', '234000 rupiah'],
    ['sejuta', '1000000 rupiah'],
    ['seribu', '1000 rupiah'],
  ])('turns %s into an explicit integer rupiah amount', (input, expected) => {
    expect(normalizeIndonesianFinanceText(`bayar ${input}, catat`))
      .toBe(`bayar ${expected}, catat`)
  })

  it.each([
    ['cepek', 100],
    ['gopek', 500],
    ['seceng', 1000],
    ['goceng', 5000],
    ['ceban', 10000],
    ['gocap', 50000],
    ['goban', 50000],
  ])('normalizes stable money slang %s', (slang, amount) => {
    expect(normalizeIndonesianFinanceText(`jajan ${slang}, catat`))
      .toBe(`jajan ${amount} rupiah, catat`)
  })

  it('does not turn ordinary word counts into money', () => {
    expect(normalizeIndonesianFinanceText('beli dua roti dan tiga telur'))
      .toBe('beli dua roti dan tiga telur')
  })
})

describe('assessIndonesianFinanceUtterance golden pairs', () => {
  it('blocks hypothetical or future transactions even when they contain catat', () => {
    for (const text of [
      'kalau jadi beli kopi 20rb, tolong catat',
      'mungkin tadi beli kopi 20rb, tolong catat',
      'besok mau beli bensin 50rb, catat',
    ]) {
      const result = assess(text)
      expect(codes(result)).toContain('HYPOTHETICAL_OR_FUTURE')
      expect(result.blocksWrite).toBe(true)
    }

    const actual = assess('tadi beli kopi 20rb dari Tunai, tolong catat')
    expect(codes(actual)).not.toContain('HYPOTHETICAL_OR_FUTURE')
    expect(actual.blocksWrite).toBe(false)
  })

  it('distinguishes approximate amounts from final amounts', () => {
    expect(codes(assess('tadi makan sekitar 20rb, tolong catat')))
      .toContain('APPROXIMATE_AMOUNT')
    expect(codes(assess('tadi makan 20rb, tolong catat')))
      .not.toContain('APPROXIMATE_AMOUNT')
  })

  it('blocks alternatives and a single amount shared by coordinated items', () => {
    expect(codes(assess('beli kopi atau makan 20rb, tolong catat')))
      .toContain('ALTERNATIVE_INTERPRETATION')
    expect(codes(assess('beli kopi dan makan 20rb, tolong catat')))
      .toContain('SHARED_AMOUNT_SCOPE')

    const individuallyPriced = assess('beli kopi 20rb dan makan 30rb, tolong catat')
    expect(codes(individuallyPriced)).not.toContain('ALTERNATIVE_INTERPRETATION')
    expect(codes(individuallyPriced)).not.toContain('SHARED_AMOUNT_SCOPE')
  })

  it('blocks examples, how-to prompts, and permission questions but allows an imperative', () => {
    for (const text of [
      'contoh kalimat catat kopi 20rb',
      'bagaimana cara catat makan 20rb?',
      'boleh catat kopi 20rb?',
      'bisa tolong catat kopi 20rb?',
    ]) {
      expect(codes(assess(text))).toContain('META_OR_PERMISSION')
    }

    expect(codes(assess('tolong catat kopi 20rb dari Tunai')))
      .not.toContain('META_OR_PERMISSION')
  })

  it('distinguishes third-party ownership from a clear user-owned transaction', () => {
    for (const text of [
      'tadi ibu beli obat 50rb, tolong catat',
      'aku beli obat 50rb pakai uang teman, tolong catat',
      'kata teman dia bayar 20rb, catat',
    ]) {
      expect(codes(assess(text))).toContain('THIRD_PARTY_OWNERSHIP')
    }

    expect(codes(assess('aku beliin ibu obat 50rb, tolong catat')))
      .not.toContain('THIRD_PARTY_OWNERSHIP')
    expect(codes(assess('teman transfer 100rb ke saya, catat sebagai pemasukan')))
      .not.toContain('THIRD_PARTY_OWNERSHIP')
  })

  it('detects active, passive, and post-verbal non-occurrence', () => {
    for (const text of [
      'saya tidak beli kopi 20rb, catat',
      'kopi 20rb belum dibayar, tolong catat',
      'kopi 20rb dibeli tidak jadi, catat',
      'gaji 5jt masuk belum, tolong catat',
      'tidak usah catat kopi 20rb',
    ]) {
      expect(codes(assess(text))).toContain('NON_OCCURRENCE')
    }
  })

  it('does not mistake positive Indonesian negation idioms for cancellation', () => {
    for (const text of [
      'jangan lupa catat kopi 20rb dari Tunai',
      'aku tidak cuma beli kopi 20rb tapi juga makan 30rb, catat',
      'aku bukan cuma beli kopi 20rb tapi juga makan 30rb, catat',
    ]) {
      const result = assess(text)
      expect(codes(result)).not.toContain('NON_OCCURRENCE')
      expect(result.blocksWrite).toBe(false)
    }
  })

  it('allows supported dates and blocks unsupported relative or explicit dates', () => {
    expect(codes(assess('kemarin beli bensin 50rb, tolong catat')))
      .not.toContain('UNSUPPORTED_DATE')
    expect(codes(assess('hari ini beli bensin 50rb, tolong catat')))
      .not.toContain('UNSUPPORTED_DATE')

    for (const text of [
      'dua hari lalu beli bensin 50rb, tolong catat',
      'tanggal 20 beli bensin 50rb, tolong catat',
      '20/07/2026 beli bensin 50rb, tolong catat',
      'tadi malam beli bensin 50rb, tolong catat',
    ]) {
      expect(codes(assess(text))).toContain('UNSUPPORTED_DATE')
    }
  })

  it('blocks foreign currency but accepts explicit rupiah', () => {
    expect(codes(assess('terima 20 USD, tolong catat'))).toContain('FOREIGN_CURRENCY')
    expect(codes(assess('terima 20000 rupiah, tolong catat'))).not.toContain('FOREIGN_CURRENCY')
  })

  it('requires context for dangling references', () => {
    const withoutContext = assess('oke catat pengeluaran tadi')
    const withContext = assess('oke catat pengeluaran tadi', { hasContext: true })

    expect(codes(withoutContext)).toContain('DANGLING_REFERENCE')
    expect(codes(withContext)).not.toContain('DANGLING_REFERENCE')
    expect(withContext.speechAct).toBe('contextual_record_request')
  })

  it('does not treat temporal tadi in a self-contained transaction as dangling', () => {
    expect(codes(assess('tadi beli makan 20rb, tolong catat')))
      .not.toContain('DANGLING_REFERENCE')
  })

  it('blocks ambiguous subset or exclusion edits to a draft', () => {
    for (const text of [
      'catat bensinnya saja',
      'catat semua kecuali kopi',
      'yang pertama saja, catat',
      'yang makan jangan, sisanya catat',
    ]) {
      expect(codes(assess(text, { hasContext: true }))).toContain('DRAFT_SUBSET_AMBIGUITY')
    }

    expect(codes(assess('oke catat saja', { hasContext: true })))
      .not.toContain('DRAFT_SUBSET_AMBIGUITY')
  })

  it('blocks ambiguous top-up and loan directions while allowing explicit semantics', () => {
    expect(codes(assess('topup DANA 100rb dari Tunai, catat'))).toContain('TOPUP_DIRECTION')
    expect(codes(assess('bayar utang 100rb, tolong catat'))).toContain('LOAN_DIRECTION')

    expect(codes(assess('transfer 100rb dari Tunai ke DANA untuk topup')))
      .not.toContain('TOPUP_DIRECTION')
    expect(codes(assess('bayar utang 100rb sebagai pengeluaran, catat')))
      .not.toContain('LOAN_DIRECTION')
  })

  it('blocks inferred currency scale without an explicit anchor', () => {
    const inferred = [{ value: 20000, explicitUnit: false, inferredUnit: 'ribu' }]
    const anchored = [
      { value: 50000, explicitUnit: true, inferredUnit: null },
      { value: 20000, explicitUnit: false, inferredUnit: 'ribu' },
    ]

    expect(codes(assess('beli kopi 20, tolong catat', { mentions: inferred })))
      .toContain('IMPLICIT_CURRENCY_UNIT')
    expect(codes(assess('bayar 50rb, kopi 20, tolong catat', { mentions: anchored })))
      .not.toContain('IMPLICIT_CURRENCY_UNIT')
  })

  it('does not authorize a transactional statement without an explicit write request', () => {
    const result = assess('kopi 20rb')
    expect(codes(result)).toContain('NO_EXPLICIT_WRITE_REQUEST')
    expect(result.blocksWrite).toBe(true)
  })

  it('returns structured evidence and an executable assessment for an unambiguous request', () => {
    const result = assess('Tadi byr makan dua puluh ribu dari Tunai, catetin ya')

    expect(result).toMatchObject({
      normalizedText: 'tadi bayar makan 20000 rupiah dari tunai, catat ya',
      speechAct: 'record_request',
      blocksWrite: false,
      evidence: {
        recordRequested: true,
        explicitWriteRequested: true,
        hasContext: false,
        currencyMentionCount: 1,
      },
      ambiguities: [],
    })
    expect(result.evidence.recordCues[0]).toMatchObject({
      kind: 'record',
      value: 'catat',
    })
    expect(result.evidence.recordCues[0].start).toBeGreaterThanOrEqual(0)
  })
})
