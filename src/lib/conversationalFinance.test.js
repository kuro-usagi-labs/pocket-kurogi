import { describe, expect, it } from 'vitest'
import {
  analyzeConversationalFinance,
  buildLiquidityAdvice,
  derivePendingFinanceDraft,
  extractMoneyMentions,
} from './conversationalFinance'

const cashWallet = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tunai',
  normalizedName: 'tunai',
  walletType: 'cash',
  currentBalance: 500000,
}

const bankWallet = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'BCA',
  normalizedName: 'bca',
  walletType: 'bank',
  currentBalance: 2000000,
}

describe('conversational finance parser', () => {
  it('separates tender money from two item expenses', () => {
    const result = analyzeConversationalFinance({
      text: 'tadi saya beli bensin dan beli makanan pake uang 50rb, beli bensin 20, beli makanan 10, tolong catat',
      walletOptions: [cashWallet],
    })

    expect(result).toMatchObject({
      type: 'transaction_batch',
      walletId: cashWallet.id,
      arithmetic: {
        tenderAmount: 50000,
        spentAmount: 30000,
        changeAmount: 20000,
      },
    })
    expect(result.items).toHaveLength(2)
    expect(result.items.map((item) => [item.amount, item.category])).toEqual([
      [20000, 'Bensin'],
      [10000, 'Makan'],
    ])
  })

  it('calculates change, replies without writing, and creates a Jajan draft', () => {
    const result = analyzeConversationalFinance({
      text: 'tadi aku ke alfamart jajan pake uang 50rb, terus dapat kembalian 36, berarti aku jajan berapa ya?',
      walletOptions: [cashWallet],
    })

    expect(result).toMatchObject({
      type: 'finance_calculation',
      draft: {
        arithmetic: {
          tenderAmount: 50000,
          changeAmount: 36000,
          spentAmount: 14000,
        },
      },
    })
    expect(result.draft.items).toHaveLength(1)
    expect(result.draft.items[0]).toMatchObject({
      amount: 14000,
      category: 'Jajan',
      merchant: 'Alfamart',
    })
    expect(result.reply.replace(/\s/g, '')).toContain('Rp14.000')
  })

  it('commits the exact pending calculation on a natural follow-up', () => {
    const pendingDraft = {
      id: '33333333-3333-4333-8333-333333333333',
      requestId: '33333333-3333-4333-8333-333333333333',
      status: 'proposed',
      items: [{
        clientItemId: 'item-1',
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan di Alfamart',
        category: 'Jajan',
        walletId: cashWallet.id,
        wallet: cashWallet.name,
      }],
    }
    const result = analyzeConversationalFinance({
      text: 'oke catat ke pengeluaran ya tadi',
      walletOptions: [cashWallet],
      context: pendingDraft,
    })

    expect(result).toMatchObject({
      type: 'transaction_batch',
      requestId: pendingDraft.requestId,
      draftId: pendingDraft.id,
      derivedFromDraft: true,
    })
    expect(result.items[0].amount).toBe(14000)
  })

  it('asks for a wallet while retaining the draft when multiple wallets exist', () => {
    const pendingDraft = {
      id: '44444444-4444-4444-8444-444444444444',
      requestId: '44444444-4444-4444-8444-444444444444',
      status: 'proposed',
      items: [{ transactionType: 'expense', amount: 14000, desc: 'Jajan', category: 'Jajan' }],
    }
    const result = analyzeConversationalFinance({
      text: 'iya catat yang tadi',
      walletOptions: [cashWallet, bankWallet],
      context: pendingDraft,
    })

    expect(result).toMatchObject({
      type: 'finance_draft',
      draft: {
        id: pendingDraft.id,
        status: 'needs_wallet',
        missingSlots: ['wallet'],
      },
    })
    expect(result.reply).toContain('Tunai')
    expect(result.reply).toContain('BCA')
  })

  it('selects a wallet after context recovery and requires one final explicit commit', () => {
    const pendingDraft = {
      id: '55555555-5555-4555-8555-555555555555',
      requestId: '55555555-5555-4555-8555-555555555555',
      status: 'needs_wallet',
      missingSlots: ['wallet'],
      items: [{ transactionType: 'expense', amount: 14000, desc: 'Jajan', category: 'Jajan' }],
    }
    const selection = analyzeConversationalFinance({
      text: 'Tunai',
      walletOptions: [cashWallet, bankWallet],
      context: pendingDraft,
    })

    expect(selection).toMatchObject({
      type: 'finance_draft_revision',
      draft: {
        walletId: cashWallet.id,
        status: 'proposed',
      },
    })

    const selectedDraft = {
      ...selection.draft,
      id: '56565656-5656-4565-8565-565656565656',
      requestId: '56565656-5656-4565-8565-565656565656',
    }
    const commit = analyzeConversationalFinance({
      text: 'catat transaksi tadi',
      walletOptions: [cashWallet, bankWallet],
      context: selectedDraft,
    })

    expect(commit).toMatchObject({
      type: 'transaction_batch',
      walletId: cashWallet.id,
      requestId: selectedDraft.requestId,
      writeDecision: 'commit',
    })
  })

  it('does not consume a pending wallet draft from an unrelated balance question', () => {
    const pendingDraft = {
      id: '77777777-7777-4777-8777-777777777777',
      requestId: '77777777-7777-4777-8777-777777777777',
      status: 'needs_wallet',
      missingSlots: ['wallet'],
      items: [{ transactionType: 'expense', amount: 14000, desc: 'Jajan', category: 'Jajan' }],
    }
    const result = analyzeConversationalFinance({
      text: 'berapa saldo BCA sekarang?',
      walletOptions: [cashWallet, bankWallet],
      context: pendingDraft,
    })

    expect(result?.type).not.toBe('transaction_batch')
  })

  it('rejects impossible or inconsistent change arithmetic', () => {
    const impossible = analyzeConversationalFinance({
      text: 'bayar 50rb kembali 60rb, jadi berapa?',
      walletOptions: [cashWallet],
    })
    const inconsistent = analyzeConversationalFinance({
      text: 'bensin 20 dan makan 10, bayar 50, kembali 15, catat',
      walletOptions: [cashWallet],
    })

    expect(impossible.type).toBe('unknown')
    expect(impossible.reply).toContain('lebih besar')
    expect(inconsistent.type).toBe('unknown')
    expect(inconsistent.reply).toContain('belum konsisten')
  })

  it('does not treat dates, quantities, or clock time as money', () => {
    const mentions = extractMoneyMentions('tanggal 20 beli 2 roti dan 2 liter bensin 10rb jam 8')

    expect(mentions.map((mention) => mention.value)).toEqual([10000])
  })

  it('never turns a finance question into an implicit write', () => {
    const result = analyzeConversationalFinance({
      text: 'kalau bensin 20rb cukup nggak?',
      walletOptions: [cashWallet],
    })

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('belum mencatat')
  })

  it.each([
    'jangan catat kopi 20rb',
    'tidak usah dicatat bensin 50rb',
    'rencana beli bensin 20rb besok',
    'kalau nanti beli makan 30rb dan kopi 20rb',
  ])('never writes a cancelled or hypothetical message: %s', (text) => {
    const result = analyzeConversationalFinance({ text, walletOptions: [cashWallet] })

    expect(result.type).not.toBe('transaction_batch')
    expect(result.type).not.toBe('transaction')
    expect(result.reply).toMatch(/tidak ada transaksi|tidak ada.*dicatat|belum mencatat|rencana|belum ada perintah/i)
  })

  it.each([
    'jangan beli kopi 20rb',
    'tadi saya tidak beli kopi 20rb',
    'gaji belum masuk 5jt',
    'saya tidak terima gaji 5jt',
    'contoh kalimat catat kopi 20rb',
    'abaikan pesan ini: beli kopi 20rb',
    'tadi saya tanya harga bensin 20 dan makan 10',
    'tadi teman beli bensin 20 dan makan 10',
  ])('blocks non-occurring, meta, or third-party ledger writes: %s', (text) => {
    const result = analyzeConversationalFinance({ text, walletOptions: [cashWallet] })

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('tidak mencatat')
  })

  it('distinguishes product numbers and quantities from item prices', () => {
    const product = analyzeConversationalFinance({
      text: 'beli iphone15 20rb dan makan 10rb, tolong catat',
      walletOptions: [cashWallet],
    })
    const quantities = analyzeConversationalFinance({
      text: 'beli beras 5 kg 75rb dan beli telur 2kg 60rb, tolong catat',
      walletOptions: [cashWallet],
    })
    const dataPlan = analyzeConversationalFinance({
      text: 'beli paket data 10gb 50rb dan makan 10rb, catat',
      walletOptions: [cashWallet],
    })

    expect(product.type).toBe('transaction_batch')
    expect(product.items.map((item) => item.amount)).toEqual([20000, 10000])
    expect(quantities.type).toBe('transaction_batch')
    expect(quantities.items.map((item) => item.amount)).toEqual([75000, 60000])
    expect(dataPlan.type).toBe('transaction_batch')
    expect(dataPlan.items.map((item) => item.amount)).toEqual([50000, 10000])
  })

  it('clarifies an ambiguous specification number instead of selecting the first number', () => {
    const result = analyzeConversationalFinance({
      text: 'beli pertamax 92 50rb dan makan 10rb, tolong catat',
      walletOptions: [cashWallet],
    })

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('mana jumlah barang serta mana harga')
  })

  it('does not treat a model number without a price as money', () => {
    const result = analyzeConversationalFinance({
      text: 'beli iphone15',
      walletOptions: [cashWallet],
    })

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('angka yang menempel pada nama produk')
  })

  it('does not collapse two explicitly named wallets into one batch source', () => {
    const result = analyzeConversationalFinance({
      text: 'beli bensin 20rb dari BCA dan makan 10rb dari Tunai, catat',
      walletOptions: [cashWallet, bankWallet],
    })

    expect(result.type).toBe('unknown')
    expect(result.reply).toContain('lebih dari satu dompet')
  })

  it.each([
    'beli bensin 20rb dari DANA, catat',
    'beli bensin 20rb dari bcaa, catat',
    'beli bensin 20rb tunai, catat',
  ])('never falls back to the only bank wallet for an unresolved explicit source: %s', (text) => {
    const result = analyzeConversationalFinance({ text, walletOptions: [bankWallet] })

    expect(result.type).toBe('finance_draft')
    expect(result.draft.status).toBe('needs_wallet')
    expect(result.draft.walletId).toBeNull()
  })

  it('stores yesterday transactions with a previous-day timestamp', () => {
    const now = new Date('2026-07-29T08:00:00.000Z')
    const result = analyzeConversationalFinance({
      text: 'kemarin beli bensin 20rb dan makan 10rb, catat',
      walletOptions: [cashWallet],
      now,
    })

    expect(result.type).toBe('transaction_batch')
    expect(result.items.every((item) => item.occurredAt === '2026-07-28T08:00:00.000Z')).toBe(true)
  })
})

describe('finance conversation memory', () => {
  const draft = {
    id: '66666666-6666-4666-8666-666666666666',
    requestId: '66666666-6666-4666-8666-666666666666',
    items: [{ amount: 14000 }],
    expiresAt: '2026-07-30T12:00:00.000Z',
  }

  it('recovers an unresolved draft from persisted chat metadata', () => {
    const recovered = derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: draft } },
      { sender: 'user', metadata: {} },
    ], new Date('2026-07-29T12:00:00.000Z'))

    expect(recovered).toMatchObject({
      ...draft,
      version: 2,
      status: 'needs_confirmation',
      missingSlots: ['semantic_confirmation'],
      understanding: {
        writeDecision: 'review',
        legacyDraft: true,
      },
    })
  })

  it('drops resolved, cancelled, and expired drafts', () => {
    expect(derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: draft } },
      { sender: 'bot', metadata: { financeDraftResolved: draft.id } },
    ], new Date('2026-07-29T12:00:00.000Z'))).toBeNull()

    expect(derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: draft } },
      { sender: 'bot', metadata: { financeDraftCancelled: draft.id } },
    ], new Date('2026-07-29T12:00:00.000Z'))).toBeNull()

    expect(derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: draft } },
    ], new Date('2026-08-01T12:00:00.000Z'))).toBeNull()
  })

  it('does not resurrect an older draft after the newer draft is resolved', () => {
    const olderDraft = { ...draft, id: '88888888-8888-4888-8888-888888888888' }
    const newerDraft = { ...draft, id: '99999999-9999-4999-8999-999999999999' }
    const recovered = derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: olderDraft } },
      { sender: 'bot', metadata: { financeDraft: newerDraft } },
      { sender: 'bot', metadata: { financeDraftResolved: newerDraft.id } },
    ], new Date('2026-07-29T12:00:00.000Z'))

    expect(recovered).toBeNull()
  })

  it('revises a pending amount, persists the new draft, and commits only the revision', () => {
    const originalDraft = {
      ...draft,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'proposed',
      items: [{
        clientItemId: 'item-1',
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan di Alfamart',
        category: 'Jajan',
        walletId: cashWallet.id,
        wallet: cashWallet.name,
      }],
    }
    const revision = analyzeConversationalFinance({
      text: 'yang tadi harusnya 12rb',
      walletOptions: [cashWallet],
      context: originalDraft,
    })

    expect(revision.type).toBe('finance_draft_revision')
    expect(revision.draft.items[0].amount).toBe(12000)

    const persistedRevision = {
      ...revision.draft,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      requestId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    }
    const recovered = derivePendingFinanceDraft([
      { sender: 'bot', metadata: { financeDraft: originalDraft } },
      {
        sender: 'bot',
        metadata: {
          financeDraft: persistedRevision,
          financeDraftCancelled: originalDraft.id,
        },
      },
    ], new Date('2026-07-29T12:00:00.000Z'))
    const commit = analyzeConversationalFinance({
      text: 'oke catat pengeluaran tadi',
      walletOptions: [cashWallet],
      context: recovered,
    })

    expect(recovered.items[0].amount).toBe(12000)
    expect(commit.type).toBe('transaction_batch')
    expect(commit.requestId).toBe(persistedRevision.requestId)
    expect(commit.items[0].amount).toBe(12000)
  })

  it.each([
    'bensin tadi harusnya 12rb',
    'catat bensin 20rb yang tadi',
  ])('keeps draft corrections away from the previous ledger entry: %s', (text) => {
    const originalDraft = {
      ...draft,
      status: 'proposed',
      items: [{
        transactionType: 'expense',
        amount: 14000,
        desc: 'Bensin',
        category: 'Bensin',
        walletId: cashWallet.id,
      }],
    }
    const result = analyzeConversationalFinance({
      text,
      walletOptions: [cashWallet],
      context: originalDraft,
    })

    expect(result.type).toBe('finance_draft_revision')
    expect(result.type).not.toBe('correct_last_transaction')
  })

  it('updates amount, category, and description when a single-item correction names a different category', () => {
    const originalDraft = {
      ...draft,
      status: 'proposed',
      items: [{
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan di Alfamart',
        category: 'Jajan',
        walletId: cashWallet.id,
      }],
    }
    const result = analyzeConversationalFinance({
      text: 'bensin tadi harusnya 12rb',
      walletOptions: [cashWallet],
      context: originalDraft,
    })

    expect(result.type).toBe('finance_draft_revision')
    expect(result.draft.items[0]).toMatchObject({
      amount: 12000,
      transactionType: 'expense',
      category: 'Bensin',
      desc: 'Bensin',
      rawText: 'Bensin',
    })
    expect(result.reply).toContain('Bensin')

    const commit = analyzeConversationalFinance({
      text: 'oke catat pengeluaran tadi',
      walletOptions: [cashWallet],
      context: {
        ...result.draft,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        requestId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      },
    })

    expect(commit.type).toBe('transaction_batch')
    expect(commit.items[0]).toMatchObject({
      amount: 12000,
      transactionType: 'expense',
      category: 'Bensin',
      desc: 'Bensin',
    })
  })

  it('keeps the existing category and description when a correction only changes the amount', () => {
    const originalDraft = {
      ...draft,
      status: 'proposed',
      items: [{
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan di Alfamart',
        category: 'Jajan',
        walletId: cashWallet.id,
      }],
    }
    const result = analyzeConversationalFinance({
      text: 'yang tadi harusnya 12rb',
      walletOptions: [cashWallet],
      context: originalDraft,
    })

    expect(result.type).toBe('finance_draft_revision')
    expect(result.draft.items[0]).toMatchObject({
      amount: 12000,
      transactionType: 'expense',
      category: 'Jajan',
      desc: 'Jajan di Alfamart',
    })
  })

  it('does not use the old draft wallet when an explicit override is unknown', () => {
    const originalDraft = {
      ...draft,
      status: 'proposed',
      walletId: cashWallet.id,
      wallet: cashWallet.name,
      items: [{
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan',
        category: 'Jajan',
        walletId: cashWallet.id,
        wallet: cashWallet.name,
      }],
    }
    const result = analyzeConversationalFinance({
      text: 'catat tadi dari DANA',
      walletOptions: [cashWallet, bankWallet],
      context: originalDraft,
    })

    expect(result.type).toBe('finance_draft')
    expect(result.draft.status).toBe('needs_wallet')
    expect(result.draft.walletId).toBeNull()
    expect(result.draft.items[0].walletId).toBeNull()
  })

  it('applies an explicit wallet or transaction-type change to a revision', () => {
    const originalDraft = {
      ...draft,
      status: 'proposed',
      walletId: cashWallet.id,
      wallet: cashWallet.name,
      items: [{
        transactionType: 'expense',
        amount: 14000,
        desc: 'Jajan',
        category: 'Jajan',
        walletId: cashWallet.id,
        wallet: cashWallet.name,
      }],
    }
    const walletRevision = analyzeConversationalFinance({
      text: 'yang tadi harusnya 12rb dari BCA',
      walletOptions: [cashWallet, bankWallet],
      context: originalDraft,
    })
    const typeRevision = analyzeConversationalFinance({
      text: 'yang tadi harusnya pemasukan 20rb',
      walletOptions: [cashWallet, bankWallet],
      context: originalDraft,
    })

    expect(walletRevision).toMatchObject({
      type: 'finance_draft_revision',
      draft: {
        walletId: bankWallet.id,
        wallet: bankWallet.name,
      },
    })
    expect(walletRevision.draft.items[0]).toMatchObject({
      amount: 12000,
      walletId: bankWallet.id,
      wallet: bankWallet.name,
    })
    expect(typeRevision.draft.items[0]).toMatchObject({
      amount: 20000,
      transactionType: 'income',
      category: 'Pemasukan',
    })
  })

  it('cancels a pending draft from a standalone negative answer', () => {
    const result = analyzeConversationalFinance({
      text: 'tidak',
      walletOptions: [cashWallet],
      context: { ...draft, status: 'proposed' },
    })

    expect(result).toMatchObject({
      type: 'finance_draft_cancel',
      draftId: draft.id,
    })
  })
})

describe('liquidity advice', () => {
  it('prioritizes essentials and pauses discretionary spending for a thin runway', () => {
    const reply = buildLiquidityAdvice({
      balance: 200000,
      now: new Date('2026-07-01T08:00:00.000Z'),
    })

    expect(reply.replace(/\s/g, '')).toContain('Rp200.000')
    expect(reply).toContain('Jajan, Kopi, dan Hiburan')
    expect(reply).toContain('bensin/transport kerja')
    expect(reply).toContain('cadangan kebutuhan penting')
  })

  it('understands "buat sebulan" as a 30-day runway even near month end', () => {
    const result = analyzeConversationalFinance({
      text: 'dompet saya tinggal 200rb buat sebulan, sebaiknya gimana?',
      walletOptions: [cashWallet],
      financialState: { totalBalance: 200000 },
      now: new Date('2026-07-29T08:00:00.000Z'),
    })

    expect(result.type).toBe('liquidity_advice')
    expect(result.reply).toContain('30 hari')
    expect(result.reply).toContain('hentikan dulu')
  })

  it('uses the balance explicitly stated by the user instead of an unrelated global total', () => {
    const result = analyzeConversationalFinance({
      text: 'uang saya tinggal 200rb buat sebulan, sebaiknya gimana?',
      walletOptions: [cashWallet],
      financialState: { totalBalance: 1000000 },
      now: new Date('2026-07-29T08:00:00.000Z'),
    })

    expect(result.reply.replace(/\s/g, '')).toContain('Rp200.000')
    expect(result.reply.replace(/\s/g, '')).not.toContain('Rp1.000.000')
  })
})
