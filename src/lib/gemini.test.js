import { describe, expect, it } from 'vitest'
import { buildGoalOptions, buildWalletOptions } from './chatEntities'
import { analyzeWithRegex } from './gemini'

const walletOptions = buildWalletOptions([
  { id: 'wallet-bca', name: 'BCA', current_balance: 5000000 },
  { id: 'wallet-jago', name: 'Bank Jago Syariah', current_balance: 2000000 },
  { id: 'wallet-bisnis', name: 'BCA Bisnis', current_balance: 1000000 },
])

const goalOptions = buildGoalOptions([
  { id: 'goal-bibit', name: 'Tabungan Bibit', current_amount: 500000, target_amount: 1000000 },
  { id: 'goal-liburan', name: 'Liburan Jepang', current_amount: 250000, target_amount: 5000000 },
])

describe('analyzeWithRegex', () => {
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

  it('uses semantic fallback categories for common expense intents before AI kicks in', () => {
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

  it('does not create a generic wallet when the wallet name is missing', () => {
    const result = analyzeWithRegex('buat dompet', walletOptions, goalOptions)

    expect(result).toMatchObject({
      type: 'unknown',
    })
    expect(result.reply).toContain('Nama dompet')
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
