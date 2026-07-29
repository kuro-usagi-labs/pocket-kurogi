import { describe, expect, it } from 'vitest'
import { buildGoalOptions, buildWalletOptions } from './chatEntities'
import { buildCategoryOptions } from './categoryCatalog'
import { analyzeTransaction, analyzeWithRegex } from './localAssistant'

const walletOptions = buildWalletOptions([
  { id: 'wallet-bca', name: 'BCA', current_balance: 5000000 },
  { id: 'wallet-jago', name: 'Bank Jago Syariah', current_balance: 2000000 },
  { id: 'wallet-bisnis', name: 'BCA Bisnis', current_balance: 1000000 },
])

const goalOptions = buildGoalOptions([
  { id: 'goal-bibit', name: 'Tabungan Bibit', current_amount: 500000, target_amount: 1000000 },
  { id: 'goal-liburan', name: 'Liburan Jepang', current_amount: 250000, target_amount: 5000000 },
])

const categoryOptions = buildCategoryOptions([
  { id: 'cat-makan', name: 'Makan', category_type: 'expense' },
  { id: 'cat-kopi', name: 'Kopi', category_type: 'expense' },
  { id: 'cat-gaji', name: 'Gaji', category_type: 'income' },
  { id: 'cat-lainnya', name: 'Lainnya', category_type: 'both' },
])

describe('analyzeWithRegex', () => {
  it('responds naturally to small talk without falling back to a ledger error', () => {
    expect(analyzeWithRegex('makasih ya', walletOptions, goalOptions)).toEqual(
      expect.objectContaining({
        type: 'unknown',
        reply: expect.stringMatching(/sama-sama|senang hati/iu),
      })
    )
    expect(analyzeWithRegex('kamu siapa?', walletOptions, goalOptions).reply)
      .toContain('Kurogi')
    expect(analyzeWithRegex(
      'aku bingung mulai dari mana',
      walletOptions,
      goalOptions
    ).reply).toMatch(/mulai|satu hal|pelan-pelan/iu)
  })

  it('does not repeat the same greeting or help response when recent replies are supplied', () => {
    const firstGreeting = analyzeWithRegex(
      'halo',
      walletOptions,
      goalOptions
    )
    const secondGreeting = analyzeWithRegex(
      'halo',
      walletOptions,
      goalOptions,
      [],
      [],
      { recentAssistantMessages: [firstGreeting.reply] }
    )
    const firstHelp = analyzeWithRegex(
      'kamu bisa ngapain?',
      walletOptions,
      goalOptions
    )
    const secondHelp = analyzeWithRegex(
      'kamu bisa ngapain?',
      walletOptions,
      goalOptions,
      [],
      [],
      { recentAssistantMessages: [firstHelp.reply] }
    )

    expect(secondGreeting.reply).not.toBe(firstGreeting.reply)
    expect(secondHelp.reply).not.toBe(firstHelp.reply)
  })

  it('treats a standalone acknowledgment as conversation when no action is pending', () => {
    const result = analyzeWithRegex('oke', walletOptions, goalOptions)

    expect(result).toEqual(expect.objectContaining({
      type: 'unknown',
      reply: expect.stringMatching(/lanjut|siap|di sini/iu),
    }))
  })

  it('accepts explicit user teaching for categories and wallets', () => {
    const categoryLesson = analyzeWithRegex(
      'ajari Kurogi bahwa ngopi berarti kategori Kopi',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )
    const walletLesson = analyzeWithRegex(
      'kalau aku bilang kantor, pakai dompet BCA',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )

    expect(categoryLesson).toEqual({
      type: 'teach_category_rule',
      keyword: 'ngopi',
      categoryId: 'cat-kopi',
      targetName: 'Kopi',
    })
    expect(walletLesson).toEqual({
      type: 'teach_wallet_rule',
      keyword: 'kantor',
      walletId: 'wallet-bca',
      targetName: 'BCA',
    })
  })

  it('rejects lessons whose target does not exist or whose keyword is unsafe', () => {
    const missingTarget = analyzeWithRegex(
      'ajari bot bahwa ngemil berarti kategori Rahasia',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )
    const unsafeKeyword = analyzeWithRegex(
      'ajari bot bahwa transaksi berarti kategori Kopi',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )

    expect(missingTarget.reply).toContain('belum menemukan kategori')
    expect(unsafeKeyword.reply).toContain('belum menyimpan aturan')
  })

  it('parses requests to forget a personal learning rule', () => {
    expect(analyzeWithRegex(
      'lupakan aturan kategori untuk ngopi',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )).toEqual({
      type: 'forget_learning_rule',
      keyword: 'ngopi',
      ruleType: 'category',
    })
  })

  it('applies a learned wallet only when no explicit wallet was supplied', async () => {
    const learned = await analyzeTransaction(
      'catat makan kantor 20rb',
      null,
      walletOptions,
      goalOptions,
      categoryOptions,
      '',
      {
        walletRules: [{
          keyword: 'kantor',
          wallet_id: 'wallet-bca',
          usage_count: 3,
        }],
      }
    )
    const explicit = await analyzeTransaction(
      'catat makan kantor 20rb dari Bank Jago Syariah',
      null,
      walletOptions,
      goalOptions,
      categoryOptions,
      '',
      {
        walletRules: [{
          keyword: 'kantor',
          wallet_id: 'wallet-bca',
          usage_count: 3,
        }],
      }
    )

    expect(learned).toMatchObject({
      type: 'finance_draft',
      draft: {
        walletId: 'wallet-bca',
        wallet: 'BCA',
        learning: {
          source: 'learned_wallet_rule',
          keyword: 'kantor',
        },
      },
    })
    expect(explicit).toMatchObject({
      type: 'transaction_batch',
      walletId: 'wallet-jago',
      wallet: 'Bank Jago Syariah',
    })
  })

  it('routes multi-item natural language through the conversational batch parser', async () => {
    const result = await analyzeTransaction(
      'tadi beli bensin 20 dan makanan 10 pakai uang 50rb, tolong catat',
      null,
      walletOptions.slice(0, 1),
      goalOptions,
      categoryOptions
    )

    expect(result.type).toBe('transaction_batch')
    expect(result.items.map((item) => item.amount)).toEqual([20000, 10000])
    expect(result.arithmetic.tenderAmount).toBe(50000)
  })

  it('keeps change arithmetic as a draft instead of misclassifying it as income', async () => {
    const result = await analyzeTransaction(
      'di alfamart jajan pakai uang 50rb, dapat kembalian 36rb, berarti habis berapa?',
      null,
      walletOptions.slice(0, 1),
      goalOptions,
      categoryOptions
    )

    expect(result).toMatchObject({
      type: 'finance_calculation',
      draft: {
        arithmetic: { spentAmount: 14000 },
      },
    })
    expect(result.draft.items[0].transactionType).toBe('expense')
  })

  it('uses structured balance context for low-liquidity advice', async () => {
    const result = await analyzeTransaction(
      'dompet tinggal 200rb buat sebulan, sebaiknya gimana?',
      null,
      walletOptions,
      goalOptions,
      categoryOptions,
      '',
      {
        financialState: { totalBalance: 200000 },
        now: new Date('2026-07-29T08:00:00.000Z'),
      }
    )

    expect(result.type).toBe('liquidity_advice')
    expect(result.reply).toContain('30 hari')
    expect(result.reply).toContain('Jajan')
  })

  it('never proposes creating a generic wallet named uang', () => {
    const result = analyzeWithRegex('beli kopi 20rb pakai uang', walletOptions, goalOptions)

    expect(result.type).toBe('needs_confirmation')
    expect(result.walletName).not.toBe('uang')
    expect(result.action).not.toBe('create_wallet')
  })

  it('routes affordability questions to the local financial calculator', () => {
    const result = analyzeWithRegex(
      'saldo BCA cukup untuk beli sepatu 750rb?',
      walletOptions,
      goalOptions
    )

    expect(result).toMatchObject({
      type: 'affordability_query',
      amount: 750000,
      walletId: 'wallet-bca',
    })
  })

  it('keeps affordability routing ahead of the generic conversational question guard', async () => {
    const result = await analyzeTransaction(
      'saldo BCA cukup untuk beli sepatu 750rb?',
      null,
      walletOptions,
      goalOptions,
      categoryOptions
    )

    expect(result).toMatchObject({
      type: 'affordability_query',
      amount: 750000,
      walletId: 'wallet-bca',
    })
  })

  it('keeps goal projections ahead of hypothetical transaction guards', async () => {
    const result = await analyzeTransaction(
      'berapa lama target Tabungan Bibit tercapai kalau nabung 500rb per bulan?',
      null,
      walletOptions,
      goalOptions,
      categoryOptions
    )

    expect(result).toMatchObject({
      type: 'goal_projection_query',
      goalId: 'goal-bibit',
      monthlyContribution: 500000,
    })
  })

  it('keeps image-only input private and asks for typed details', async () => {
    const result = await analyzeTransaction('', 'data:image/png;base64,audit', walletOptions, goalOptions)

    expect(result).toMatchObject({ type: 'unknown' })
    expect(result.reply).toContain('tetap privat')
  })

  it('routes strategy questions to advice instead of ledger fallback', () => {
    const result = analyzeWithRegex(
      'Melihat data saya, apa strategi terbaik untuk mengoptimalkan pengeluaran bulan ini?',
      walletOptions,
      goalOptions
    )

    expect(result).toMatchObject({
      type: 'advice',
      period: 'this_month',
      focus: 'expense',
    })
  })

  it('keeps analytics queries separate from advice queries', () => {
    const result = analyzeWithRegex('pengeluaran bulan ini berapa?', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'analytics_query',
      metric: 'total_expense',
      period: 'this_month',
    })
  })

  it('parses goal withdrawals into goal_withdrawal intent', () => {
    const result = analyzeWithRegex(
      'transfer dari tabungan bibit ke bca 25.179',
      walletOptions,
      goalOptions
    )

    expect(result).toMatchObject({
      type: 'goal_withdrawal',
      goalId: 'goal-bibit',
      destinationWalletId: 'wallet-bca',
      amount: 25179,
    })
  })

  it('parses goal contributions with explicit source wallet', () => {
    const result = analyzeWithRegex('tabung 100rb dari BCA ke tabungan bibit', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'goal_contribution',
      goalId: 'goal-bibit',
      sourceWalletId: 'wallet-bca',
      amount: 100000,
    })
  })

  it('keeps multi-word wallet matching deterministic', () => {
    const result = analyzeWithRegex(
      'transfer dari bank jago syariah ke bca bisnis 250rb',
      walletOptions,
      goalOptions
    )

    expect(result).toMatchObject({
      type: 'transfer',
      fromWalletId: 'wallet-jago',
      toWalletId: 'wallet-bisnis',
      amount: 250000,
    })
  })

  it('asks for confirmation on typo wallet names instead of guessing', () => {
    const result = analyzeWithRegex('beli kopi 50rb dari bcaa', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'needs_confirmation',
      reason: 'ambiguous_wallet',
    })
    expect(result.prompt).toContain('typo')
    expect(result.candidates[0].name).toBe('BCA')
  })

  it('guides incomplete transfer commands with a safe format', () => {
    const result = analyzeWithRegex('trf dari bcaa ke dana', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'needs_confirmation',
      reason: 'missing_amount',
      intent: {
        type: 'transfer',
      },
    })
    expect(result.prompt).toContain('transfer 100rb dari BCA ke DANA')
  })

  it('normalizes transfer typos and parses complete transfers', () => {
    const result = analyzeWithRegex('tranfer 250rb dri bank jago syariah ke bca bisnis', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'transfer',
      fromWalletId: 'wallet-jago',
      toWalletId: 'wallet-bisnis',
      amount: 250000,
    })
  })

  it('parses wallet rename commands into rename_wallet intent', () => {
    const result = analyzeWithRegex(
      'ganti nama dompet BCA menjadi BCA Operasional',
      walletOptions,
      goalOptions
    )

    expect(result).toMatchObject({
      type: 'rename_wallet',
      walletId: 'wallet-bca',
      wallet: 'BCA',
      nextName: 'BCA Operasional',
    })
  })

  it('asks for wallet confirmation before deleting when the target is unclear', () => {
    const result = analyzeWithRegex('hapus dompet', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'needs_confirmation',
      reason: 'missing_wallet',
      intent: {
        type: 'delete_wallet',
      },
    })
  })

  it('uses semantic fallback categories for common expense intents locally', () => {
    const result = analyzeWithRegex('bayar token pln 100rb dari bca', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'transaction',
      transactionType: 'expense',
      category: 'tagihan',
      walletId: 'wallet-bca',
    })
  })

  it('uses a generic fallback for vague non-ledger questions without amount', () => {
    const result = analyzeWithRegex('tolong bantu saya dong', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'unknown',
    })
    expect(result.reply).toContain('analisis keuangan')
  })

  it('answers capability questions without trying to create a ledger action', () => {
    const result = analyzeWithRegex('kamu bisa bantu apa aja?', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'unknown',
    })
    expect(result.reply).toContain('catat transaksi')
  })

  it('detects health-check style finance questions as advice', () => {
    const result = analyzeWithRegex('uang saya masih aman tidak bulan ini?', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'advice',
      period: 'this_month',
      focus: 'overall',
    })
  })

  it('detects undo requests for the latest transaction', () => {
    const result = analyzeWithRegex('batalkan transaksi terakhir', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'undo_transaction',
    })
  })

  it('detects amount corrections for the latest transaction', () => {
    const result = analyzeWithRegex(
      'yang tadi harusnya 80rb',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )

    expect(result).toMatchObject({
      type: 'correct_last_transaction',
      amount: 80000,
    })
  })

  it('detects category corrections for the latest transaction', () => {
    const result = analyzeWithRegex(
      'yang terakhir ganti ke makan',
      walletOptions,
      goalOptions,
      [],
      categoryOptions
    )

    expect(result).toMatchObject({
      type: 'correct_last_transaction',
      category: 'Makan',
    })
  })

  it('does not create a generic wallet when the wallet name is missing', () => {
    const result = analyzeWithRegex('buat dompet', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'needs_confirmation',
      reason: 'missing_wallet_name',
      action: 'create_wallet',
    })
    expect(result.reply).toContain('Nama dompet')
  })

  it.each([
    ['tolong buat dompet yang bernama bca', 'BCA', 'bank', 0],
    ['tolong buatkan aku dompet GoPay', 'GoPay', 'e_wallet', 0],
    ['bikinin dompet belanja harian dong', 'Belanja Harian', 'cash', 0],
    ['tambahkan OVO sebagai dompet', 'OVO', 'e_wallet', 0],
    ['buka rekening BRI saldo 250rb', 'BRI', 'bank', 250000],
    ['mohon tambahkan dompet tunai kecil', 'Tunai Kecil', 'cash', 0],
  ])(
    'parses flexible Indonesian wallet creation: %s',
    (text, name, walletType, initialBalance) => {
      const result = analyzeWithRegex(text, walletOptions, goalOptions)

      expect(result).toMatchObject({
        type: 'create_wallet',
        name,
        wallet_type: walletType,
        initial_balance: initialBalance,
      })
    }
  )

  it('does not confuse a saving goal funded from a wallet with wallet creation', () => {
    const result = analyzeWithRegex(
      'buat target liburan 5jt dari dompet BCA',
      walletOptions,
      goalOptions
    )

    expect(result.type).toBe('goal_creation_pending')
  })

  it('understands a natural capability question and mentions wallet creation', () => {
    const result = analyzeWithRegex('apa dong yang kamu bisa?', walletOptions, goalOptions)

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('membuat dan mengelola dompet')
  })

  it('parses new goal creation with target amount', () => {
    const result = analyzeWithRegex('buat target liburan korea 5jt', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'goal_creation_pending',
      name: 'Liburan Korea',
      targetAmount: 5000000,
      amount: 0,
    })
  })
})
