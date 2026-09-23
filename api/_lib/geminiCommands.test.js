import { describe, expect, it } from 'vitest'
import { compileLanguageCommand } from './geminiCommands.js'
import { orchestrateAssistantMessage } from '../../src/lib/assistant/unifiedAssistantOrchestrator.js'

const wallets = [{ id: 'bca', name: 'BCA', current_balance: 5000000 }, { id: 'cash', name: 'Tunai', current_balance: 5000000 }]
const goals = [{ id: 'goal', name: 'Laptop', target_amount: 10000000, current_amount: 1000000, status: 'active' }]
const context = { wallets: wallets.map(w => w.name), goals: goals.map(g => g.name) }
describe('Gemini to deterministic command contract', () => {
  it.each([
    ['record_income', 'aku baru mendapatkan gaji hari ini yaitu 2,860,097 tolong catat', { amountText: '2,860,097', description: 'Gaji', dateText: 'hari ini' }],
    ['record_expense', 'barusan ngopi 25rb pakai BCA', { amountText: '25rb', description: 'Kopi', wallet: 'BCA' }],
    ['transfer_money', 'pindahin 100rb dari BCA ke Tunai', { amountText: '100rb', sourceWallet: 'BCA', destinationWallet: 'Tunai' }],
    ['create_wallet', 'bikinin dompet Jago saldo 50rb', { name: 'Jago', amountText: '50rb' }],
    ['create_saving_goal', 'buat tabungan Liburan target 5jt', { name: 'Liburan', targetText: '5jt' }],
    ['deposit_goal', 'tabung 100rb ke Laptop dari BCA', { name: 'Laptop', amountText: '100rb', sourceWallet: 'BCA' }],
    ['withdraw_goal', 'tarik 100rb dari tabungan Laptop ke BCA', { name: 'Laptop', amountText: '100rb', destinationWallet: 'BCA' }],
    ['query_balance', 'saldo saya berapa', {}],
    ['query_income', 'pemasukan hari ini berapa', { dateText: 'hari ini' }],
    ['query_expenses', 'pengeluaran hari ini berapa', { dateText: 'hari ini' }],
    ['query_transactions', 'lihat transaksi', {}],
    ['query_saving_goal', 'lihat tabungan', {}],
    ['query_budget', 'lihat anggaran', {}],
  ])('routes %s into the real engine', (intent, text, fields) => {
    const result = compileLanguageCommand({ intent, ...fields }, text, context)
    const { frame } = orchestrateAssistantMessage({ text: result.command, wallets, goals })
    expect(frame.intent, result.command).toBe(intent)
    if (intent === 'record_income') {
      expect(frame.slots.amount).toBe(2860097)
      expect(frame.slots.description).toBe('Gaji')
    }
  })
  it('cleans the original salary description without Gemini too', () => {
    const { frame } = orchestrateAssistantMessage({ text: 'aku baru mendapatkan gaji hari ini yaitu 2,860,097 tolong catat', wallets })
    expect(frame.slots.description).toBe('Gaji')
    expect(frame.slots.amount).toBe(2860097)
  })
  it.each(['25', '250', '2500', '5000'])('rejects truncated nominal %s', amountText => {
    expect(() => compileLanguageCommand({ intent: 'record_income', amountText }, 'gaji 25000', context)).toThrow()
  })
  it('rejects invented wallets and negated actions', () => {
    expect(() => compileLanguageCommand({ intent: 'record_income', wallet: 'BCA' }, 'catat gaji 5jt', context)).toThrow()
    expect(() => compileLanguageCommand({ intent: 'record_income' }, 'jangan catat gaji', context)).toThrow()
    expect(() => compileLanguageCommand({ intent: 'set_theme', theme: 'dark' }, 'jangan aktifkan darkmode', context)).toThrow()
  })
})
