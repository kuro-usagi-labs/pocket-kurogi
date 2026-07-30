/**
 * A compact, hand-reviewed regression corpus for Pocket Kurogi's Indonesian
 * finance assistant. The corpus intentionally favours difficult utterances
 * over happy-path paraphrases so it can be reused by deterministic parsers or
 * a future local model without changing the expected safety contract.
 */

export const EVALUATION_NOW = '2026-07-29T12:00:00+07:00'

export const EVALUATION_FIXTURES = Object.freeze({
  userId: 'evaluation-user',
  wallets: Object.freeze([
    {
      id: 'wallet-bca',
      name: 'BCA',
      wallet_type: 'bank',
      current_balance: 1_000_000,
    },
    {
      id: 'wallet-gopay',
      name: 'GoPay',
      wallet_type: 'ewallet',
      current_balance: 250_000,
    },
    {
      id: 'wallet-cash',
      name: 'Tunai',
      wallet_type: 'cash',
      current_balance: 400_000,
    },
  ]),
  categories: Object.freeze([
    { id: 'category-food', name: 'Makan', category_type: 'expense' },
    { id: 'category-coffee', name: 'Kopi', category_type: 'expense' },
    { id: 'category-transport', name: 'Transportasi', category_type: 'expense' },
    { id: 'category-snack', name: 'Jajan', category_type: 'expense' },
    { id: 'category-salary', name: 'Gaji', category_type: 'income' },
    { id: 'category-other', name: 'Lainnya', category_type: 'both' },
  ]),
  goals: Object.freeze([
    {
      id: 'goal-emergency',
      name: 'Dana Darurat',
      current_amount: 1_000_000,
      target_amount: 6_000_000,
      status: 'active',
    },
  ]),
})

export const INDONESIAN_SINGLE_TURN_CORPUS = Object.freeze([
  {
    id: 'slang-expense-ceban',
    tags: ['slang', 'normalization', 'expense', 'safe-write'],
    text: 'Tadi byr makan ceban dari BCA, catet',
    expected: {
      normalizedIncludes: ['bayar', '10000 rupiah', 'catat'],
      amountValues: [10_000],
      entityFlags: {
        hypothetical: false,
        thirdParty: false,
        negated: false,
      },
      intent: 'record_expense',
      status: 'pending_confirmation',
      pendingAction: true,
    },
  },
  {
    id: 'typo-transfer',
    tags: ['typo', 'normalization', 'transfer', 'safe-write'],
    text: 'Tolong trnasfer 50rb dari BCA ke GoPay',
    expected: {
      normalizedIncludes: ['transfer', '50rb'],
      amountValues: [50_000],
      intent: 'transfer_money',
      status: 'pending_confirmation',
      pendingAction: true,
    },
  },
  {
    id: 'negated-expense',
    tags: ['slang', 'negation', 'unsafe-write'],
    text: 'Jgn catet kopi gocap dari BCA',
    expected: {
      normalizedIncludes: ['jangan', 'catat', '50000 rupiah'],
      amountValues: [50_000],
      entityFlags: { negated: true },
      safetyCodes: ['NEGATED_ACTION'],
      status: 'blocked',
      pendingAction: false,
      writeBlocked: true,
    },
  },
  {
    id: 'negated-income-not-occurred',
    tags: ['negation', 'income', 'unsafe-write'],
    text: 'Gaji belum masuk 5 juta, catat',
    expected: {
      amountValues: [5_000_000],
      entityFlags: { negated: true },
      safetyCodes: ['NEGATED_ACTION'],
      status: 'blocked',
      pendingAction: false,
      writeBlocked: true,
    },
  },
  {
    id: 'hypothetical-future-expense',
    tags: ['hypothetical', 'future', 'unsafe-write'],
    text: 'Kalau besok aku beli sepatu 500rb dari BCA, catat',
    expected: {
      amountValues: [500_000],
      entityFlags: { hypothetical: true },
      safetyCodes: ['HYPOTHETICAL_OR_FUTURE'],
      status: 'blocked',
      pendingAction: false,
      writeBlocked: true,
    },
  },
  {
    id: 'third-party-expense',
    tags: ['third-party', 'ownership', 'unsafe-write'],
    text: 'Temanku beli sepatu 700rb dari BCA, catat',
    expected: {
      amountValues: [700_000],
      entityFlags: { thirdParty: true },
      safetyCodes: ['THIRD_PARTY_OWNERSHIP'],
      status: 'blocked',
      pendingAction: false,
      writeBlocked: true,
    },
  },
  {
    id: 'permission-question-is-not-command',
    tags: ['question', 'ambiguity', 'unsafe-write'],
    text: 'Bisa catat kopi 20rb dari BCA?',
    expected: {
      amountValues: [20_000],
      entityFlags: { question: true },
      safetyCodes: ['QUESTION_NOT_ACTION'],
      status: 'blocked',
      pendingAction: false,
      writeBlocked: true,
    },
  },
  {
    id: 'multi-transaction-shared-wallet',
    tags: ['multi-transaction', 'expense', 'safe-write'],
    text: 'Makan 25rb, kopi 18rb, parkir 5rb dari GoPay',
    expected: {
      amountValues: [25_000, 18_000, 5_000],
      intent: 'record_multiple_transactions',
      status: 'pending_confirmation',
      pendingAction: true,
      pendingItemAmounts: [25_000, 18_000, 5_000],
      pendingWalletIds: ['wallet-gopay', 'wallet-gopay', 'wallet-gopay'],
    },
  },
  {
    id: 'mixed-wallet-multi-transaction',
    tags: ['multi-transaction', 'reference', 'safe-write'],
    text: 'Makan 20rb BCA dan kopi 10rb GoPay',
    expected: {
      amountValues: [20_000, 10_000],
      intent: 'record_multiple_transactions',
      status: 'pending_confirmation',
      pendingAction: true,
      pendingItemAmounts: [20_000, 10_000],
      pendingWalletIds: ['wallet-bca', 'wallet-gopay'],
    },
  },
  {
    id: 'explicit-record-wish',
    tags: ['natural-language', 'expense', 'safe-write'],
    text: 'Aku ingin tolong catat makan 20rb dari BCA',
    expected: {
      amountValues: [20_000],
      entityFlags: { hypothetical: false },
      intent: 'record_expense',
      status: 'pending_confirmation',
      pendingAction: true,
    },
  },
])

export const INDONESIAN_UNSAFE_LOCAL_WRITE_CORPUS = Object.freeze([
  {
    id: 'local-negated-write',
    tags: ['negation', 'unsafe-write'],
    text: 'ngga usah catet kopi 20rb dari Tunai',
    expectedAmbiguity: 'NON_OCCURRENCE',
  },
  {
    id: 'local-hypothetical-write',
    tags: ['hypothetical', 'unsafe-write'],
    text: 'seandainya beli kopi 20rb dari BCA, tolong catat',
    expectedAmbiguity: 'HYPOTHETICAL_OR_FUTURE',
  },
  {
    id: 'local-third-party-write',
    tags: ['third-party', 'unsafe-write'],
    text: 'teman saya beli kopi 20rb, catat',
    expectedAmbiguity: 'THIRD_PARTY_OWNERSHIP',
  },
  {
    id: 'local-meta-example',
    tags: ['meta', 'unsafe-write'],
    text: 'contoh kalimat catat kopi 20rb dari BCA',
    expectedAmbiguity: 'META_OR_PERMISSION',
  },
  {
    id: 'local-foreign-currency',
    tags: ['foreign-currency', 'unsafe-write'],
    text: 'beli game USD 20 dari BCA, catat',
    expectedAmbiguity: 'FOREIGN_CURRENCY',
  },
  {
    id: 'local-already-recorded',
    tags: ['reference', 'duplicate-prevention', 'unsafe-write'],
    text: 'saya sudah catat kopi 20rb dari BCA',
    expectedAmbiguity: 'ALREADY_RECORDED_OR_HABITUAL',
  },
])

export const INDONESIAN_CONVERSATION_CORPUS = Object.freeze([
  {
    id: 'collect-wallet-then-confirm',
    tags: ['multi-turn', 'reference', 'confirmation', 'safe-write'],
    steps: [
      {
        text: 'Tadi makan 20rb',
        expected: {
          intent: 'record_expense',
          status: 'clarification',
          missingSlots: ['wallet'],
          pendingAction: false,
        },
      },
      {
        text: 'BCA saja',
        expected: {
          intent: 'record_expense',
          status: 'pending_confirmation',
          pendingAction: true,
          pendingItemAmounts: [20_000],
          pendingWalletIds: ['wallet-bca'],
        },
      },
      {
        text: 'Iya catat',
        expected: {
          intent: 'confirm_pending_action',
          commandType: 'confirm_pending_action',
          pendingAction: true,
        },
      },
    ],
  },
  {
    id: 'correct-referenced-pending-amount',
    tags: ['multi-turn', 'reference', 'correction', 'safe-write'],
    steps: [
      {
        text: 'Tolong catat makan 20rb pakai BCA',
        expected: {
          intent: 'record_expense',
          status: 'pending_confirmation',
          pendingAction: true,
        },
      },
      {
        text: 'Ubah rincian aksi ini',
        expected: {
          intent: 'correct_pending_action',
          status: 'correction_clarification',
          pendingAction: true,
        },
      },
      {
        text: 'Nominalnya 25rb',
        expected: {
          intent: 'correct_pending_action',
          commandType: 'correct_pending_action',
          commandItemAmounts: [25_000],
          pendingAction: true,
        },
      },
    ],
  },
])

export const INDONESIAN_TEACHING_CORPUS = Object.freeze([
  {
    id: 'teach-category-rule',
    tags: ['teaching', 'category', 'memory'],
    text: 'Ajari Kurogi bahwa ngopi berarti kategori Kopi',
    expected: {
      type: 'teach_category_rule',
      keyword: 'ngopi',
      categoryId: 'category-coffee',
      targetName: 'Kopi',
    },
  },
  {
    id: 'teach-wallet-rule',
    tags: ['teaching', 'wallet', 'memory'],
    text: 'Kalau aku bilang kantor, pakai dompet BCA',
    expected: {
      type: 'teach_wallet_rule',
      keyword: 'kantor',
      walletId: 'wallet-bca',
      targetName: 'BCA',
    },
  },
  {
    id: 'forget-category-rule',
    tags: ['teaching', 'forgetting', 'memory'],
    text: 'Lupakan aturan kategori untuk ngopi',
    expected: {
      type: 'forget_learning_rule',
      keyword: 'ngopi',
      ruleType: 'category',
    },
  },
  {
    id: 'reject-generic-learning-keyword',
    tags: ['teaching', 'validation', 'unsafe-learning'],
    text: 'Ajari Kurogi bahwa transaksi berarti kategori Kopi',
    expected: {
      type: 'unknown',
      replyIncludes: 'belum menyimpan',
    },
  },
])

export const REQUIRED_EVALUATION_TAGS = Object.freeze([
  'slang',
  'typo',
  'negation',
  'hypothetical',
  'third-party',
  'multi-turn',
  'reference',
  'multi-transaction',
  'teaching',
  'unsafe-write',
])

export const INDONESIAN_ASSISTANT_EVALUATION_CORPUS = Object.freeze({
  singleTurn: INDONESIAN_SINGLE_TURN_CORPUS,
  unsafeLocalWrites: INDONESIAN_UNSAFE_LOCAL_WRITE_CORPUS,
  conversations: INDONESIAN_CONVERSATION_CORPUS,
  teaching: INDONESIAN_TEACHING_CORPUS,
})
