import { describe, expect, it } from 'vitest'
import { extractLearningRuleCandidate } from './learningRuleExtractor'

const wallets = [
  { id: 'wallet-bca', name: 'BCA' },
  { id: 'wallet-cash', name: 'Tunai' },
]

const categories = [
  { id: 'category-food', name: 'Makan', category_type: 'expense' },
  { id: 'category-transport', name: 'Transportasi', category_type: 'expense' },
]

describe('canonical learning rule extractor', () => {
  it('grounds an explicit category rule to an existing account category', () => {
    expect(extractLearningRuleCandidate({
      text: 'ajari Kurogi bahwa ngopi berarti kategori Makan',
      categories,
    })).toMatchObject({
      type: 'teach_category_rule',
      categoryId: 'category-food',
      keyword: 'ngopi',
      targetName: 'Makan',
      source: 'utterance',
      confidence: 0.99,
    })
  })

  it('grounds an explicit wallet rule to an existing account wallet', () => {
    expect(extractLearningRuleCandidate({
      text: 'kalau aku bilang kantor, pakai dompet BCA',
      wallets,
    })).toMatchObject({
      type: 'teach_wallet_rule',
      walletId: 'wallet-bca',
      keyword: 'kantor',
      targetName: 'BCA',
    })
  })

  it('extracts a scoped forget command without guessing a target', () => {
    expect(extractLearningRuleCandidate({
      text: 'lupakan aturan dompet untuk kantor',
    })).toMatchObject({
      type: 'forget_learning_rule',
      ruleType: 'wallet',
      keyword: 'kantor',
    })
  })

  it('rejects nonexistent targets and unsafe generic keywords', () => {
    expect(extractLearningRuleCandidate({
      text: 'ajari Kurogi bahwa ngopi berarti kategori Hiburan',
      categories,
    })).toMatchObject({
      type: 'unknown',
      reason: 'missing_learning_target',
    })
    expect(extractLearningRuleCandidate({
      text: 'ajari Kurogi bahwa uang berarti kategori Makan',
      categories,
    })).toMatchObject({
      type: 'unknown',
      reason: 'invalid_learning_keyword',
    })
  })
})
