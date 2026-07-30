import { describe, expect, it } from 'vitest'
import {
  createAssistantMemory,
  getUsableMemory,
  upsertAssistantMemory,
} from './assistantMemory'
import { runAssistantEngine } from './assistantEngine'
import { shouldHandleAssistantEngineResult } from './assistantChatBridge'
import { createDialogueState } from './conversationContext'
import { resolveDateEntities } from './dateResolver'
import { detectEmotionalContext } from './emotionalContext'
import { extractAssistantEntities } from './entityExtractor'
import {
  buildFinancialInsightSnapshot,
  buildRunwayInsight,
  composeFinancialQueryResult,
} from './financialInsights'
import { routeAssistantIntent } from './intentRouter'
import { extractMoneyEntities } from './moneyExtractor'
import {
  cancelPendingAction,
  confirmPendingAction,
  correctPendingAction,
  createPendingAction,
} from './pendingActionManager'
import { composeAssistantResponse } from './responseComposer'
import {
  validateAssistantInterpretation,
  validatePendingActionExecution,
} from './safetyValidator'
import { resolveIntentSlots } from './slotResolver'
import { resolveWalletEntities } from './walletResolver'

const now = new Date('2026-07-29T12:00:00+07:00')
const wallets = [
  { id: 'wallet-bca', name: 'BCA', current_balance: 1_000_000 },
  { id: 'wallet-gopay', name: 'GoPay', current_balance: 200_000 },
]
const categories = [
  { id: 'cat-food', name: 'Makan', category_type: 'expense' },
  { id: 'cat-transport', name: 'Transportasi', category_type: 'expense' },
  { id: 'cat-salary', name: 'Gaji', category_type: 'income' },
]
const goals = [
  {
    id: 'goal-emergency',
    name: 'Dana Darurat',
    target_amount: 5_000_000,
    current_amount: 1_000_000,
    status: 'active',
  },
]

describe('deterministic assistant modules', () => {
  it('extracts literal rupiah safely and rejects non-money quantities', () => {
    expect(extractMoneyEntities('Harga kabel Rp500')).toEqual([
      expect.objectContaining({ value: 500, explicitCurrency: true }),
    ])
    expect(extractMoneyEntities('Beli kabel 5 meter seharga 20rb')).toEqual([
      expect.objectContaining({ value: 20_000 }),
    ])
    expect(extractMoneyEntities('iPhone 15 panjangnya 5 meter')).toEqual([])
  })

  it('understands colloquial bare thousands without treating item quantities as money', () => {
    expect(extractMoneyEntities('beli kopi 20')).toEqual([
      expect.objectContaining({
        value: 20_000,
        inferredUnit: 'ribu',
      }),
    ])
    expect(extractMoneyEntities('beli 2 roti seharga 20rb')).toEqual([
      expect.objectContaining({ value: 20_000 }),
    ])
  })

  it('never interprets m as miliar', () => {
    expect(extractMoneyEntities('beli tali 5m')).toEqual([])
    expect(extractMoneyEntities('catat investasi 5 miliar')).toEqual([
      expect.objectContaining({ value: 5_000_000_000 }),
    ])
  })

  it('resolves Indonesian relative and explicit dates', () => {
    expect(resolveDateEntities('tadi malam makan', now)[0]).toEqual(
      expect.objectContaining({
        source: 'relative',
        value: '2026-07-29T13:00:00.000Z',
      })
    )
    expect(resolveDateEntities('dua hari lalu beli bensin', now)[0].value)
      .toBe('2026-07-26T17:00:00.000Z')
    expect(resolveDateEntities('tanggal 15 Juli 2026', now)[0].value)
      .toContain('2026-07-15')
  })

  it('resolves wallets explicitly without guessing between multiple wallets', () => {
    expect(resolveWalletEntities({ text: 'pakai BCA', wallets })[0]).toEqual(
      expect.objectContaining({ id: 'wallet-bca', source: 'explicit' })
    )
    expect(resolveWalletEntities({ text: 'pakai uang', wallets })).toEqual([])
  })

  it('scores intents from combined evidence and exposes conflicts', () => {
    const entities = extractAssistantEntities({
      text: 'Tolong catat makan 20rb pakai BCA',
      wallets,
      categories,
      now,
    })
    const route = routeAssistantIntent({
      text: entities.normalizedText,
      entities,
    })

    expect(route).toEqual(expect.objectContaining({
      intent: 'record_expense',
      ambiguous: false,
    }))
    expect(route.evidence).toEqual(expect.arrayContaining([
      'expense_verb',
      'record_verb',
      'money:single',
    ]))
  })

  it('fills only missing slots and retains prior dialogue slots', () => {
    const firstEntities = extractAssistantEntities({
      text: 'Tadi makan 20rb',
      wallets,
      categories,
      now,
    })
    const firstSlots = resolveIntentSlots({
      intent: 'record_expense',
      entities: firstEntities,
      text: 'Tadi makan 20rb',
    })
    expect(firstSlots.missingSlots).toEqual(['wallet'])

    const state = createDialogueState({
      activeIntent: 'record_expense',
      collectedSlots: firstSlots.slots,
      missingSlots: firstSlots.missingSlots,
      now,
    })
    const walletEntities = extractAssistantEntities({
      text: 'BCA saja',
      wallets,
      categories,
      now,
    })
    const completed = resolveIntentSlots({
      intent: 'record_expense',
      entities: walletEntities,
      dialogueState: state,
      text: 'BCA saja',
    })

    expect(completed.complete).toBe(true)
    expect(completed.slots).toEqual(expect.objectContaining({
      amount: 20_000,
      description: 'Makan',
      wallet: { id: 'wallet-bca', name: 'BCA' },
    }))
  })

  it('keeps a meaningful modifier in an income description', () => {
    const entities = extractAssistantEntities({
      text: 'sisa gaji',
      wallets,
      categories,
      now,
    })
    const resolved = resolveIntentSlots({
      intent: 'record_income',
      entities,
      text: 'sisa gaji',
    })

    expect(resolved.slots).toEqual(expect.objectContaining({
      description: 'Sisa gaji',
      category: { id: 'cat-salary', name: 'Gaji' },
    }))
  })

  it('detects emotional context without inventing financial facts', () => {
    expect(detectEmotionalContext('Aku stres, uang tinggal sedikit sampai gajian', {
      totalBalance: 400_000,
    })).toEqual(expect.objectContaining({
      emotion: 'stressed',
      financialConcern: true,
    }))
  })

  it('creates relevant memory only from supported explicit preferences', () => {
    const entry = createAssistantMemory({
      key: 'preferred_wallet',
      value: 'wallet-bca',
      confidence: 0.92,
      source: 'explicit',
      now,
      userId: 'user-1',
    })
    const repeated = upsertAssistantMemory([entry], {
      ...entry,
      confidence: 0.9,
    }, new Date('2026-07-30T00:00:00Z'))
    expect(getUsableMemory(repeated, 'preferred_wallet')).toEqual(
      expect.objectContaining({ value: 'wallet-bca', confidence: 1 })
    )
  })

  it('calculates financial insights only from supplied transaction data', () => {
    const snapshot = buildFinancialInsightSnapshot({
      now,
      transactions: [
        {
          id: '1',
          type: 'expense',
          amount: 100_000,
          category: 'Makan',
          merchant: 'Warung',
          occurredAt: '2026-07-29T02:00:00Z',
        },
        {
          id: '2',
          type: 'income',
          amount: 1_000_000,
          category: 'Gaji',
          occurredAt: '2026-07-01T02:00:00Z',
        },
      ],
      budgets: [{ id: 'b1', category: 'Makan', limit: 500_000 }],
      goals: [{ id: 'g1', name: 'Dana darurat', currentAmount: 200_000, targetAmount: 1_000_000 }],
    })

    expect(snapshot.today.expense).toBe(100_000)
    expect(snapshot.currentMonth.income).toBe(1_000_000)
    expect(snapshot.topCategories[0]).toEqual(expect.objectContaining({
      name: 'Makan',
      amount: 100_000,
    }))
    expect(snapshot.budgetUsage[0].percentage).toBe(20)
    expect(buildRunwayInsight({
      balance: 400_000,
      requiredExpenses: 120_000,
      daysUntilIncome: 14,
    }).dailyLimit).toBe(20_000)
  })

  it('answers balance, budget, and saving-goal queries from supplied database context', () => {
    const snapshot = buildFinancialInsightSnapshot({
      now,
      transactions: [{
        id: '1',
        type: 'expense',
        amount: 100_000,
        category: 'Makan',
        occurredAt: '2026-07-29T02:00:00Z',
      }],
      budgets: [{ id: 'b1', category: 'Makan', monthly_limit: 500_000 }],
      goals,
    })

    expect(composeFinancialQueryResult({
      intent: 'query_balance',
      snapshot,
      wallets,
    }).text).toMatch(/Rp\s*1\.200\.000/u)
    expect(composeFinancialQueryResult({
      intent: 'query_budget',
      snapshot,
    }).details[0]).toContain('20.0%')
    expect(composeFinancialQueryResult({
      intent: 'query_saving_goal',
      snapshot,
      goals,
    }).details[0]).toMatch(/Rp\s*1\.000\.000/u)
  })

  it('uses an explicit salary-date memory for a deterministic runway estimate', () => {
    const result = composeFinancialQueryResult({
      intent: 'emotional_support',
      snapshot: buildFinancialInsightSnapshot({
        now,
        transactions: [{
          id: '1',
          type: 'expense',
          amount: 20_000,
          category: 'Makan',
          occurredAt: '2026-07-29T02:00:00Z',
        }],
      }),
      wallets: [{ id: 'cash', name: 'Tunai', current_balance: 400_000 }],
      memory: [{
        key: 'salary_date',
        value: 12,
        confidence: 0.98,
      }],
      now,
    })

    expect(result.details.join(' ')).toContain('per hari')
    expect(result.details.join(' ')).toContain('tagihan wajib')
  })

  it('turns database facts into conservative, actionable financial advice', () => {
    const snapshot = buildFinancialInsightSnapshot({
      transactions: [{
        id: 'trx-1',
        type: 'expense',
        amount: 300_000,
        category: 'Jajan',
        occurredAt: now.toISOString(),
      }],
      budgets: [{
        id: 'budget-1',
        category: 'Jajan',
        monthly_limit: 200_000,
      }],
      now,
    })
    const result = composeFinancialQueryResult({
      intent: 'financial_advice',
      snapshot,
      wallets: [{ id: 'cash', name: 'Tunai', current_balance: 200_000 }],
      now,
    })

    expect(result.text).toMatch(/hentikan sementara/iu)
    expect(result.details.join(' ')).toMatch(/budget terlewati/iu)
    expect(result.details.join(' ')).toMatch(/saldo aktif/iu)
  })

  it('resolves a known goal and stages a reviewed target update', () => {
    const result = runAssistantEngine({
      text: 'Ubah target Dana Darurat jadi 7 juta',
      userId: 'user-1',
      wallets,
      categories,
      goals,
      now,
    })

    expect(result.route.intent).toBe('update_saving_goal')
    expect(result.dialogue.status).toBe('pending_confirmation')
    expect(result.pendingAction.payload).toMatchObject({
      goalId: 'goal-emergency',
      amount: 7_000_000,
    })
  })

  it.each([
    ['Cek saldo', 'query_balance'],
    ['Lihat transaksi', 'query_transactions'],
    ['Cek budget', 'query_budget'],
    ['Lihat target tabungan', 'query_saving_goal'],
  ])('routes Indonesian imperative queries: %s', (text, intent) => {
    const result = runAssistantEngine({
      text,
      userId: 'user-1',
      wallets,
      categories,
      goals,
      now,
    })
    expect(result.route.intent).toBe(intent)
    expect(result.dialogue.status).toBe('query')
  })

  it('creates a clean saving-goal name before review', () => {
    const result = runAssistantEngine({
      text: 'Buat target liburan 5 juta',
      userId: 'user-1',
      wallets,
      categories,
      goals,
      now,
    })
    expect(result.route.intent).toBe('create_saving_goal')
    expect(result.pendingAction.payload.description).toBe('liburan')
  })

  it('keeps pending actions idempotent and owner-scoped', () => {
    const pending = createPendingAction({
      id: 'pa-test',
      userId: 'user-1',
      intent: 'record_expense',
      actionType: 'record_transactions',
      payload: {
        items: [{ amount: 20_000, walletId: 'wallet-bca' }],
      },
      now,
    })
    const corrected = correctPendingAction(pending, {
      userId: 'user-1',
      patch: { items: [{ amount: 25_000, walletId: 'wallet-bca' }] },
      now,
    })
    const first = confirmPendingAction(corrected, { userId: 'user-1', now })
    const replay = confirmPendingAction(first.action, { userId: 'user-1', now })

    expect(first.replayed).toBe(false)
    expect(replay.replayed).toBe(true)
    expect(first.action.idempotencyKey).toBe('pa-test')
    expect(() => cancelPendingAction(pending, {
      userId: 'user-2',
      now,
    })).toThrow(/bukan milik/)
  })

  it('blocks unsafe interpretations and unconfirmed execution', () => {
    const unsafe = validateAssistantInterpretation({
      intent: 'record_expense',
      entities: {
        hypothetical: true,
        question: false,
        thirdParty: false,
        negated: false,
        foreignCurrencies: [],
      },
      slots: { amount: 500_000 },
      route: { ambiguous: false },
    })
    expect(unsafe.safe).toBe(false)
    expect(unsafe.errors[0].code).toBe('HYPOTHETICAL_OR_FUTURE')

    const pending = createPendingAction({
      id: 'pa-unconfirmed',
      userId: 'user-1',
      intent: 'record_expense',
      actionType: 'record_transactions',
      payload: { items: [{ amount: 20_000, walletId: 'wallet-bca' }] },
      now,
    })
    expect(validatePendingActionExecution({
      action: pending,
      userId: 'user-1',
      wallets,
      now,
    })).toEqual(expect.objectContaining({ safe: false }))
  })

  it('composes structured pending-action responses', () => {
    const pending = createPendingAction({
      id: 'pa-card',
      userId: 'user-1',
      intent: 'record_expense',
      actionType: 'record_transactions',
      payload: { items: [{ amount: 20_000, walletId: 'wallet-bca' }] },
      now,
    })
    const response = composeAssistantResponse({
      intent: 'record_expense',
      confidence: 0.9,
      slots: {
        amount: 20_000,
        description: 'Makan',
        wallet: { id: 'wallet-bca', name: 'BCA' },
      },
      pendingAction: pending,
      status: 'pending_confirmation',
    })

    expect(response.card).toEqual(expect.objectContaining({
      type: 'pending_action',
      actions: ['confirm', 'edit', 'cancel'],
    }))
    expect(response.text).toContain('Konfirmasi')
    expect(response.text).not.toMatch(/perlu (?:satu )?detail/iu)
    expect(response.components.acknowledgment).toBeNull()
    expect(response.components.warning).toBeNull()
  })

  it('keeps clarification concise while preserving financial facts', () => {
    const first = composeAssistantResponse({
      intent: 'record_expense',
      confidence: 0.9,
      slots: {
        amount: 20_000,
        description: 'Makan',
        wallet: { id: 'wallet-bca', name: 'BCA' },
      },
      status: 'clarification',
      clarification: { question: 'Dompet mana yang dipakai?' },
    })
    const second = composeAssistantResponse({
      intent: 'record_expense',
      confidence: 0.9,
      slots: {
        amount: 20_000,
        description: 'Makan',
        wallet: { id: 'wallet-bca', name: 'BCA' },
      },
      status: 'clarification',
      clarification: { question: 'Dompet mana yang dipakai?' },
      recentAssistantMessages: [first.text],
    })

    expect(first.components.acknowledgment).toBeNull()
    expect(second.components.acknowledgment).toBeNull()
    expect(second.text).toMatch(/Rp\s*20\.000/u)
    expect(second.text).toContain('Makan')
    expect(second.text).toContain('BCA')
    expect(second.text).toContain('Dompet mana yang dipakai?')
  })
})

describe('assistant engine multi-turn integration', () => {
  it('does not pad a repeated clarification with another acknowledgment', () => {
    const first = runAssistantEngine({
      text: 'Tadi makan 20rb',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    const second = runAssistantEngine({
      text: 'Tadi makan 20rb',
      userId: 'user-1',
      wallets,
      categories,
      messages: [{ sender: 'bot', text: first.response.text }],
      now,
    })

    expect(first.response.components.acknowledgment).toBeNull()
    expect(second.response.components.acknowledgment).toBeNull()
    expect(second.response.text).toMatch(/Rp\s*20\.000/u)
  })

  it('collects slots across turns and never mutates before confirmation', () => {
    const first = runAssistantEngine({
      text: 'Tadi makan 20rb',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(first.dialogue.status).toBe('clarification')
    expect(first.slots.missingSlots).toEqual(['wallet'])
    expect(first.pendingAction).toBeNull()

    const second = runAssistantEngine({
      text: 'BCA saja',
      userId: 'user-1',
      wallets,
      categories,
      dialogueState: first.dialogueState,
      now,
    })
    expect(second.dialogue.status).toBe('pending_confirmation')
    expect(second.pendingAction).toEqual(expect.objectContaining({
      status: 'pending',
      intent: 'record_expense',
    }))

    const third = runAssistantEngine({
      text: 'Iya catat',
      userId: 'user-1',
      wallets,
      categories,
      dialogueState: second.dialogueState,
      pendingAction: second.pendingAction,
      now,
    })
    expect(third.command).toEqual({
      type: 'confirm_pending_action',
      pendingActionId: second.pendingAction.id,
    })
  })

  it('cancels an incomplete multi-turn draft without creating a pending action', () => {
    const first = runAssistantEngine({
      text: 'Tadi makan 20rb',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    const cancelled = runAssistantEngine({
      text: 'Jangan jadi',
      userId: 'user-1',
      wallets,
      categories,
      dialogueState: first.dialogueState,
      now,
    })

    expect(cancelled.route.intent).toBe('cancel_pending_action')
    expect(cancelled.command).toEqual({
      type: 'cancel_pending_action',
      pendingActionId: null,
    })
    expect(cancelled.dialogueState.activeIntent).toBeNull()
    expect(cancelled.pendingAction).toBeNull()
  })

  it.each([
    ['Besok mau beli sepatu 500rb', 'HYPOTHETICAL_OR_FUTURE'],
    ['Tadi aku hampir beli sepatu 500rb', 'HYPOTHETICAL_OR_FUTURE'],
    ['Temanku beli sepatu 700rb', 'THIRD_PARTY_OWNERSHIP'],
    ['Gaji belum masuk 5 juta', 'NEGATED_ACTION'],
  ])('blocks unsafe mutation text: %s', (text, expectedCode) => {
    const result = runAssistantEngine({
      text,
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(result.pendingAction).toBeNull()
    expect(result.safety.errors.map((error) => error.code)).toContain(expectedCode)
  })

  it('calculates change without recording anything', () => {
    const result = runAssistantEngine({
      text: 'Bayar 100rb kembali 35rb',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })

    expect(result.route.intent).toBe('calculate_change')
    expect(result.dialogue.calculation.spentAmount).toBe(65_000)
    expect(result.pendingAction).toBeNull()
  })

  it('delegates change, tendered cash, runway, and incoming transfers to the contextual parser', () => {
    for (const text of [
      'Bayar 100rb kembali 35rb',
      'Beli bensin 20 dan makan 10 pakai uang 50rb',
      'Sisa uangku 200rb buat sebulan, gimana?',
      'Ibu transfer 200rb ke aku',
    ]) {
      const result = runAssistantEngine({
        text,
        userId: 'user-1',
        wallets,
        categories,
        now,
      })
      expect(
        shouldHandleAssistantEngineResult(result),
        `${text} should use the contextual parser`
      ).toBe(false)
    }
  })

  it('allows questions to read data but never stages permission questions as mutations', () => {
    const balanceQuestion = runAssistantEngine({
      text: 'Sisa uangku berapa?',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(balanceQuestion.route.intent).toBe('query_balance')
    expect(balanceQuestion.dialogue.status).toBe('query')
    expect(balanceQuestion.safety.safe).toBe(true)

    const budgetPermission = runAssistantEngine({
      text: 'Bisakah buatkan budget makan 500rb?',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(budgetPermission.pendingAction).toBeNull()
    expect(budgetPermission.safety.errors.map((entry) => entry.code))
      .toContain('QUESTION_NOT_ACTION')
  })

  it('treats an explicit wish to record as a current request, not a future plan', () => {
    const result = runAssistantEngine({
      text: 'Saya ingin catat makan 20rb dari BCA',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })

    expect(result.entities.hypothetical).toBe(false)
    expect(result.route.intent).toBe('record_expense')
    expect(result.dialogue.status).toBe('pending_confirmation')
  })

  it.each([
    ['Tolong tambahkan budget makan 500rb', 'create_budget'],
    ['Bikinin target laptop 10jt', 'create_saving_goal'],
  ])('understands natural Indonesian creation morphology: %s', (text, intent) => {
    const result = runAssistantEngine({
      text,
      userId: 'user-1',
      wallets,
      categories,
      now,
    })

    expect(result.route.intent).toBe(intent)
    expect(result.dialogue.status).toBe('pending_confirmation')
  })

  it('corrects a pending single transaction before confirmation', () => {
    const staged = runAssistantEngine({
      text: 'Tolong catat makan 20rb pakai BCA',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    const editRequest = runAssistantEngine({
      text: 'Ubah rincian aksi ini',
      userId: 'user-1',
      wallets,
      categories,
      pendingAction: staged.pendingAction,
      dialogueState: staged.dialogueState,
      now,
    })
    expect(editRequest.dialogue.status).toBe('correction_clarification')

    const correction = runAssistantEngine({
      text: 'nominalnya 25rb',
      userId: 'user-1',
      wallets,
      categories,
      pendingAction: staged.pendingAction,
      dialogueState: editRequest.dialogueState,
      now,
    })
    expect(correction.command).toEqual(expect.objectContaining({
      type: 'correct_pending_action',
      pendingActionId: staged.pendingAction.id,
    }))
    expect(correction.command.payload.items[0].amount).toBe(25_000)
  })

  it.each([
    ['Tolong catat makan 20rb pakai BCA', 'record_expense', 'pending_confirmation'],
    ['Tadi makan 20rb', 'record_expense', 'clarification'],
    ['Besok mau beli sepatu 500rb', 'unknown', 'blocked'],
    ['Temanku beli sepatu 700rb', 'unknown', 'blocked'],
    ['Gaji belum masuk 5 juta', 'unknown', 'blocked'],
    ['Aku menerima bonus 500rb', 'record_income', 'clarification'],
    ['Beli kabel 5 meter seharga 20rb', 'record_expense', 'clarification'],
    ['Bayar 100rb kembali 35rb', 'calculate_change', 'calculation'],
    ['Rp500', 'unknown', 'blocked'],
    ['Saldo tinggal 400rb sampai gajian', 'emotional_support', 'query'],
    ['Pindahkan 200rb dari BCA ke GoPay', 'transfer_money', 'pending_confirmation'],
    ['Aku stres karena boros terus', 'emotional_support', 'query'],
    ['Menurutmu keuanganku bulan ini bagaimana?', 'financial_advice', 'query'],
  ])('covers required behavior: %s', (text, intent, status) => {
    const result = runAssistantEngine({
      text,
      userId: 'user-1',
      wallets,
      categories,
      transactions: [],
      now,
    })
    expect(
      result.route.intent,
      JSON.stringify({
        route: result.route,
        normalizedText: result.entities.normalizedText,
      })
    ).toBe(intent)
    expect(result.dialogue.status).toBe(status)
  })

  it('keeps a natural correction without pending state for the legacy transaction-reference resolver', () => {
    const result = runAssistantEngine({
      text: 'Yang makan tadi harusnya 25rb',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(result.pendingAction).toBeNull()
    expect(result.text).toMatch(/harusnya/iu)
  })

  it('builds a reviewed multi-transaction action with a shared wallet', () => {
    const result = runAssistantEngine({
      text: 'Makan 25rb, kopi 18rb, parkir 5rb dari GoPay',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })
    expect(result.route.intent).toBe('record_multiple_transactions')
    expect(result.dialogue.status).toBe('pending_confirmation')
    expect(result.pendingAction.payload.items.map((item) => item.amount))
      .toEqual([25_000, 18_000, 5_000])
    expect(result.pendingAction.payload.items.map((item) => item.description.toLowerCase()))
      .toEqual(['makan', 'kopi', 'parkir'])
    expect(result.pendingAction.payload.items.every((item) =>
      item.walletId === 'wallet-gopay'
    )).toBe(true)
  })

  it('keeps separate wallets on multi-wallet transaction items', () => {
    const result = runAssistantEngine({
      text: 'Makan 20rb BCA dan kopi 10rb GoPay',
      userId: 'user-1',
      wallets,
      categories,
      now,
    })

    expect(result.route.intent).toBe('record_multiple_transactions')
    expect(result.dialogue.status).toBe('pending_confirmation')
    expect(result.pendingAction.payload.items.map((item) => item.walletId))
      .toEqual(['wallet-bca', 'wallet-gopay'])
  })
})
