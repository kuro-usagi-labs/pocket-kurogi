import { describe, expect, it } from 'vitest'
import { classifyFinanceIntent, getFinanceTrainingCorpusStats } from './financeIntentClassifier'

describe('local finance intent classifier', () => {
  it.each([
    ['bayar pakai 75rb terus kembaliannya 22rb, habis berapa?', 'calculate_change'],
    ['sip catetin hasil yang barusan ke pengeluaran', 'commit_previous'],
    ['tolong catat bensin 20rb, makan 12rb, sama parkir 3rb', 'record_batch'],
    ['uangku cuma 180rb sampai gajian, harus gimana', 'advice_low_balance'],
    ['ga jadi, jangan simpan yang tadi', 'cancel_previous'],
  ])('classifies %s as %s', (message, expectedLabel) => {
    const result = classifyFinanceIntent(message)

    expect(result.label).toBe(expectedLabel)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.margin).toBeGreaterThanOrEqual(0)
  })

  it('ships a non-empty embedded training corpus without an API key', () => {
    expect(getFinanceTrainingCorpusStats()).toMatchObject({ labels: 7 })
    expect(getFinanceTrainingCorpusStats().examples).toBeGreaterThanOrEqual(50)
  })

  it('does not classify a salary fragment as change arithmetic', () => {
    expect(classifyFinanceIntent('sisa gaji').label)
      .not.toBe('calculate_change')
  })
})
