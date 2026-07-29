import { describe, expect, it } from 'vitest'
import { buildGoalOptions, buildWalletOptions } from './chatEntities'
import {
  getChatWriteCandidate,
  hasCommittedChatWriteDecision,
} from './chatWriteSafety'
import { analyzeTransaction, assessPendingFinanceReply } from './localAssistant'

const wallets = buildWalletOptions([
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Tunai',
    wallet_type: 'cash',
    current_balance: 500000,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'BCA',
    wallet_type: 'bank',
    current_balance: 2000000,
  },
])

const goals = buildGoalOptions([
  {
    id: '66666666-6666-4666-8666-666666666666',
    name: 'Dana Darurat',
    current_amount: 500000,
    target_amount: 5000000,
  },
])

const movementWallets = [
  ...wallets,
  ...buildWalletOptions([
    {
      id: '88888888-8888-4888-8888-888888888888',
      name: 'DANA',
      wallet_type: 'ewallet',
      current_balance: 300000,
    },
    {
      id: '99999999-9999-4999-8999-999999999999',
      name: 'OVO',
      wallet_type: 'ewallet',
      current_balance: 400000,
    },
  ]),
]

async function analyze(
  text,
  {
    context = null,
    walletOptions = wallets,
    goalOptions = [],
    archivedWalletOptions = [],
    now = undefined,
  } = {}
) {
  return analyzeTransaction(
    text,
    null,
    walletOptions,
    goalOptions,
    [],
    '',
    {
      financeDraft: context,
      archivedWalletOptions,
      ...(now ? { now } : {}),
    }
  )
}

function expectNoWrite(result) {
  expect(['transaction', 'transaction_batch']).not.toContain(result?.type)
  expect(result?.writeDecision).not.toBe('commit')
}

function expectNoExecutableMutation(result) {
  expect(hasCommittedChatWriteDecision(result)).toBe(false)
}

describe('Indonesian finance write-safety invariant', () => {
  it.each([
    'ngga usah catet kopi 20rb dari Tunai',
    'jgn catat kopi 20rb dari Tunai',
    'jangan dicatat kopi 20rb',
    'kopi 20rb tidak perlu dicatat',
    'jangan masukkan gaji 5jt',
    'saya tidak membeli kopi 20rb',
    'aku ga pernah beli kopi 20rb',
    'saya bukan beli kopi 20rb',
    'tagihan listrik 200rb belum dibayar, catat',
    'gaji belum cair 5jt, catat',
    'refund belum diterima 100rb, catat',
    'seandainya beli kopi 20rb, tolong catat',
    'besok beli makan 20rb, catat',
    'lusa beli bensin 20rb, catat',
    'rencana nanti beli kopi 20rb, catat',
    'mungkin tadi beli kopi 20rb, tolong catat',
    'kayaknya tadi makan sekitar 20rb, catat',
    'beli kopi atau makan 20rb, tolong catat',
    'beli kopi dan makan total 20rb, tolong catat',
    'beli bensin 20rb dan makan, catat',
    'contoh kalimat catat kopi 20rb',
    'kalau saya ketik beli kopi 20rb catat, kamu paham?',
    'cara catat beli kopi 20rb?',
    'bisa catat kopi 20rb?',
    'harga bensin sekarang 20rb',
    'kata teman catat kopi 20rb',
    'teman saya beli kopi 20rb, catat',
    'kopi 20rb dibayarin teman, catat',
    'kopi 20rb bukan pengeluaran saya, catat',
    'beli game USD 20, catat',
    'tanggal 28 Juli beli makan 20rb, catat',
    'dua hari lalu beli makan 20rb, catat',
    'tadi malam beli makan 20rb, catat',
    'topup DANA 100rb dari Tunai, catat',
    'bayar utang 100rb, catat',
  ])('never emits an executable ledger write for ambiguous input: %s', async (text) => {
    expectNoWrite(await analyze(text))
  })

  it.each([
    ['tadi beli kopi 20rb dari BCA, tolong catat', 20000, 'expense'],
    ['tadi bayar makan dua puluh ribu dari BCA, catat', 20000, 'expense'],
    ['tadi beli permen Rp20 dari BCA, catat', 20, 'expense'],
    ['tadi dapat bonus setengah juta ke BCA, catat', 500000, 'income'],
    ['jangan lupa catat kopi 20rb dari BCA', 20000, 'expense'],
  ])('writes only a complete explicit request: %s', async (text, amount, transactionType) => {
    const result = await analyze(text)

    expect(result).toMatchObject({
      type: 'transaction_batch',
      writeDecision: 'commit',
    })
    expect(result.items[0]).toMatchObject({ amount, transactionType })
    expect(result.understanding.ambiguities).toEqual([])
  })

  it('understands additive negation without treating it as cancellation', async () => {
    const result = await analyze(
      'aku tidak cuma beli kopi 20rb tapi juga makan 30rb dari BCA, catat'
    )

    expect(result).toMatchObject({
      type: 'transaction_batch',
      writeDecision: 'commit',
    })
    expect(result.items.map((item) => item.amount)).toEqual([20000, 30000])
  })

  it.each([
    'kopi 20rb',
    'bayar token PLN 100rb dari BCA',
  ])('turns a statement without an explicit write request into a review draft: %s', async (text) => {
    const result = await analyze(text)

    expectNoWrite(result)
    expect(result.type).toBe('finance_calculation')
    expect(result.draft.understanding.writeDecision).toBe('review')
    expect(result.reply).toMatch(/belum mencatat/i)
  })

  it('asks the user to confirm an inferred thousand-unit before writing', async () => {
    const review = await analyze('tadi beli kopi 20 dari BCA, catat')

    expectNoWrite(review)
    expect(review).toMatchObject({
      type: 'finance_draft',
      draft: {
        status: 'needs_confirmation',
        missingSlots: expect.arrayContaining(['semantic_confirmation']),
      },
    })

    const persistedDraft = {
      ...review.draft,
      id: '33333333-3333-4333-8333-333333333333',
      requestId: '33333333-3333-4333-8333-333333333333',
    }
    const confirmed = await analyze('Ya', { context: persistedDraft })

    expect(confirmed).toMatchObject({
      type: 'transaction_batch',
      writeDecision: 'commit',
    })
    expect(confirmed.items[0].amount).toBe(20000)
  })

  it.each([
    'catat tadi kecuali makan',
    'catat yang bensin tadi',
    'catat tadi besok',
  ])('does not commit an ambiguous subset or time change from a draft: %s', async (text) => {
    const context = {
      id: '44444444-4444-4444-8444-444444444444',
      requestId: '44444444-4444-4444-8444-444444444444',
      version: 2,
      status: 'proposed',
      walletId: wallets[0].id,
      wallet: wallets[0].name,
      items: [
        {
          clientItemId: 'item-1',
          transactionType: 'expense',
          amount: 20000,
          category: 'Bensin',
          desc: 'Bensin',
          walletId: wallets[0].id,
          wallet: wallets[0].name,
        },
        {
          clientItemId: 'item-2',
          transactionType: 'expense',
          amount: 10000,
          category: 'Makan',
          desc: 'Makan',
          walletId: wallets[0].id,
          wallet: wallets[0].name,
        },
      ],
    }

    expectNoWrite(await analyze(text, { context }))
  })

  it('lets a trailing cancellation override an earlier commit phrase', async () => {
    const context = {
      id: '55555555-5555-4555-8555-555555555555',
      requestId: '55555555-5555-4555-8555-555555555555',
      version: 2,
      status: 'proposed',
      walletId: wallets[0].id,
      wallet: wallets[0].name,
      items: [{
        clientItemId: 'item-1',
        transactionType: 'expense',
        amount: 20000,
        category: 'Kopi',
        desc: 'Kopi',
        walletId: wallets[0].id,
        wallet: wallets[0].name,
      }],
    }
    const result = await analyze('catat tadi, eh jangan', { context })

    expectNoWrite(result)
    expect(result.type).toBe('finance_draft_cancel')
  })

  it.each([
    'catat kopi 20rb dari BCA tapi jangan sekarang',
    'jangan lupa catat kopi 20rb dari BCA, tapi jangan sekarang',
    'catat kopi 20rb dari BCA jangan dulu',
    'catat kopi 20rb dari BCA belum sekarang',
  ])('honors a late deferral instead of an earlier write phrase: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'saya sudah catat kopi 20rb dari BCA',
    'kopi 20rb sudah dicatat dari BCA',
    'tadi aku mencatat kopi 20rb dari BCA',
    'saya biasanya catat kopi 20rb dari BCA',
    'saya selalu mencatat kopi 20rb dari BCA',
    'transfer 100rb dari BCA ke Tunai tadi',
    'tabung 100rb dari BCA ke target Dana Darurat barusan',
    'buat dompet Belanja saldo 100rb tadi',
  ])('does not duplicate a report about prior or habitual bookkeeping: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text, { goalOptions: goals }))
  })

  it.each([
    ['transfer 100rb dari BCA ke Tunai', 'transfer'],
    ['tabung 100rb dari BCA ke target Dana Darurat', 'goal_contribution'],
    ['transfer 25rb dari target Dana Darurat ke BCA', 'goal_withdrawal'],
    ['batalkan transaksi terakhir', 'undo_transaction'],
    ['yang tadi harusnya 80rb', 'correct_last_transaction'],
    ['buat dompet Belanja saldo 100rb', 'create_wallet'],
    ['tolong buat dompet yang bernama BCA', 'create_wallet'],
    ['bikinin dompet GoPay dong', 'create_wallet'],
    ['ganti nama dompet BCA menjadi Rekening Utama', 'rename_wallet'],
    ['hapus dompet BCA', 'delete_wallet'],
    ['buat target Liburan 5jt', 'goal_creation_pending'],
  ])('marks a clear non-ledger mutation as an executable decision: %s', async (text, type) => {
    const result = await analyze(text, { goalOptions: goals })
    const candidate = getChatWriteCandidate(result)

    expect(candidate).toMatchObject({
      type,
      writeDecision: 'commit',
      understanding: {
        writeDecision: 'commit',
        ambiguities: [],
      },
    })
  })

  it.each([
    'besok transfer 100rb dari BCA ke Tunai',
    'bisa transfer 100rb dari BCA ke Tunai?',
    'transfer 100rb dari BCA ke Tunai?',
    'transfer 100rb dari BCA ke Tunai bisa',
    'transfer 100rb dari BCA ke Tunai untuk apa',
    'mungkin transfer 100rb dari BCA ke Tunai',
    'transfer sekitar 100rb dari BCA ke Tunai',
    'transfer 100rb atau 200rb dari BCA ke Tunai',
    'besok tabung 100rb dari BCA ke target Dana Darurat',
    'boleh tarik 25rb dari target Dana Darurat ke BCA?',
    'jangan batalkan transaksi terakhir',
    'bisa koreksi yang tadi jadi 80rb?',
    'buat dompet Belanja saldo 100rb besok',
    'buat dompet Belanja saldo 100rb?',
    'bisa buatkan dompet GoPay?',
    'ganti nama dompet BCA menjadi Rekening Utama nanti',
    'buat target Liburan 5jt atau 7jt',
    'tabung 100 dari BCA ke target Dana Darurat',
    'transfer USD 20 dari BCA ke Tunai',
  ])('never executes another mutation when its Indonesian structure is ambiguous: %s', async (text) => {
    const result = await analyze(text, { goalOptions: goals })

    expectNoExecutableMutation(result)
  })

  it.each([
    'misalkan saya beli kopi 20rb dari BCA lalu catat',
    'andaikata saya beli kopi 20rb dari BCA lalu catat',
    'umpamanya beli kopi 20rb dari BCA lalu catat',
    'anggap saja saya bilang beli kopi 20rb dari BCA lalu catat',
    'aku cuma mengetes beli kopi 20rb dari BCA catat',
    'aku sedang menguji kalimat beli kopi 20rb dari BCA catat',
    'tolong terjemahkan kalimat beli kopi 20rb dari BCA catat',
    "kalimat 'beli kopi 20rb dari BCA catat' artinya apa",
    'sekedar ngetes: beli kopi 20rb dari BCA catat',
  ])('blocks examples, tests, translations, and hypothetical meta-language: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'aku tak jadi beli kopi 20rb dari BCA, catat',
    'aku kagak beli kopi 20rb dari BCA, catat',
    'aku kaga beli kopi 20rb dari BCA, catat',
    'aku engga beli kopi 20rb dari BCA, catat',
    'aku ndak beli kopi 20rb dari BCA, catat',
    'aku ora beli kopi 20rb dari BCA, catat',
    'aku urung beli kopi 20rb dari BCA, catat',
    'aku ogah beli kopi 20rb dari BCA, catat',
    'gaji masih pending 5jt, catat ke BCA',
    'refund masih diproses 100rb, catat ke BCA',
    'kopinya gratis, harga 20rb, catat dari BCA',
    'kopi 20rb tidak pakai uangku, catat dari BCA',
  ])('blocks dialect negation and money that has not actually moved: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'kopi 20rb dibayarin temen, catat dari BCA',
    'kopi 20rb dibayarin doi, catat dari BCA',
    'kopi 20rb ditanggung kantor, catat dari BCA',
    'kopi 20rb ditraktir pacarku, catat dari BCA',
    'kopi 20rb dibeliin bos, catat dari BCA',
    'anak saya beli kopi 20rb, catat dari BCA',
    'saudara saya beli kopi 20rb, catat dari BCA',
    'beli kopi 20rb pakai duit teman, catat dari BCA',
    'beli kopi 20rb, uangnya punya teman, catat dari BCA',
  ])('blocks ambiguous third-party ownership: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'semalam beli makan 20rb dari BCA catat',
    'Senin lalu beli makan 20rb dari BCA catat',
    'pekan lalu beli makan 20rb dari BCA catat',
    'pekan depan beli makan 20rb dari BCA catat',
    'bsk beli makan 20rb dari BCA catat',
    'esok beli makan 20rb dari BCA catat',
    'tanggal dua puluh delapan beli makan 20rb dari BCA catat',
    'tempo hari beli makan 20rb dari BCA catat',
    'bulan kemarin beli makan 20rb dari BCA catat',
  ])('blocks dates that cannot be mapped to one safe timestamp: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it('normalizes "kemaren" to the supported previous-day timestamp', async () => {
    const now = new Date('2026-07-29T08:00:00.000Z')
    const result = await analyze('kemaren beli makan 20rb dari BCA catat', { now })

    expect(result).toMatchObject({
      type: 'transaction_batch',
      writeDecision: 'commit',
    })
    expect(result.items[0].occurredAt).toBe('2026-07-28T08:00:00.000Z')
  })

  it.each([
    'beli game AUD 20 dari BCA catat',
    'beli game CAD 20 dari BCA catat',
    'beli game HKD 20 dari BCA catat',
    'beli game RM 20 dari BCA catat',
    'beli game USDT 20 dari BCA catat',
    'beli game ETH 0,1 dari BCA catat',
    'beli game 20 rupee dari BCA catat',
    'beli game AUD 20.000 dari BCA catat',
    'beli game CAD 20000 dari BCA catat',
    'beli game HKD 10.000 dari BCA catat',
    'beli game RM 20000 dari BCA catat',
    'beli game USDT 1000 dari BCA catat',
    'beli game ETH 1.000 dari BCA catat',
    'beli game INR 20.000 dari BCA catat',
    'beli game CHF 20.000 dari BCA catat',
    'beli game 20000 rupee dari BCA catat',
  ])('never treats a foreign-currency amount as IDR, including after confirmation: %s', async (text) => {
    const first = await analyze(text)

    expectNoExecutableMutation(first)
    expect(first.type).toBe('unknown')

    if (first.draft) {
      const second = await analyze('Ya', { context: first.draft })
      expectNoExecutableMutation(second)
    }
  })

  it.each([
    'kisaran beli makan 20rb dari BCA catat',
    'kira2 beli makan 20rb dari BCA catat',
    'kurleb beli makan 20rb dari BCA catat',
    'beli makan kurang dari 20rb dari BCA catat',
    'beli makan lebih dari 20rb dari BCA catat',
    'beli makan di bawah 20rb dari BCA catat',
    'beli makan di atas 20rb dari BCA catat',
    'beli makan mentok 20rb dari BCA catat',
    'beli makan maks 20rb dari BCA catat',
    'beli makan 20rb lebih dari BCA catat',
    'perkiraan beli makan 20rb dari BCA catat',
    'estimasi beli makan 20rb dari BCA catat',
    'beli makan paling mentok 20rb dari BCA catat',
    'beli makan tidak sampai 20rb dari BCA catat',
  ])('blocks non-final nominal ranges and estimates: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'beli kopi plus roti 20rb dari BCA catat',
    'beli kopi & roti 20rb dari BCA catat',
    'beli bensin beserta makan 20rb dari BCA catat',
    'beli bensin berikut makan 20rb dari BCA catat',
    'beli bensin sekaligus makan 20rb dari BCA catat',
    'beli bensin/makan 20rb dari BCA catat',
    'bensin + makan masing2 20rb dari BCA catat',
    'kopi dan roti 20rb dari BCA catat',
  ])('blocks one amount whose scope spans multiple items: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'kopi di sini harganya 20rb dari BCA, catat',
    'biaya normal kopi 20rb dari BCA, catat',
    'nilai kopinya 20rb dari BCA, catat',
  ])('blocks price information that is not proof of a purchase: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'yang bensin aja, catat tadi',
    'yang bensin doang, catat tadi',
    'yang makan saja, catat tadi',
    'catat tadi tanpa makan',
    'catat tadi minus makan',
    'catat item bensin tadi',
    'catat transaksi bensin tadi',
    'catat nomor 1 tadi',
    'catat tadi, skip makan',
    'catat tadi jangan makan',
    'catat tadi tidak usah makan',
    'catat tadi, makan tidak',
    'catat tadi, yang makan coret',
    'catat tadi, hapus makan',
    'catat yang tadi, jangan deh',
    'catat yang tadi, enggak deh',
    'catat yang tadi, skip aja',
    'catat yang tadi, urungkan',
    'catat yang pertama tadi',
  ])('never commits all draft items for a subset or late cancellation: %s', async (text) => {
    const context = {
      id: '77777777-7777-4777-8777-777777777777',
      requestId: '77777777-7777-4777-8777-777777777777',
      version: 2,
      status: 'proposed',
      walletId: wallets[0].id,
      wallet: wallets[0].name,
      items: [
        {
          clientItemId: 'item-1',
          transactionType: 'expense',
          amount: 20000,
          category: 'Bensin',
          desc: 'Bensin',
          rawText: 'beli bensin 20rb',
          walletId: wallets[0].id,
          wallet: wallets[0].name,
        },
        {
          clientItemId: 'item-2',
          transactionType: 'expense',
          amount: 10000,
          category: 'Makan',
          desc: 'Makan',
          rawText: 'beli makan 10rb',
          walletId: wallets[0].id,
          wallet: wallets[0].name,
        },
      ],
    }
    const result = await analyze(text, { context })

    expectNoExecutableMutation(result)
  })

  it('treats a clearly incoming third-party transfer as income, not an internal transfer', async () => {
    const result = await analyze('ibu transfer 100rb ke saya, catat ke BCA')
    const candidate = getChatWriteCandidate(result)

    expect(candidate).toMatchObject({
      type: 'transaction',
      transactionType: 'income',
      amount: 100000,
      walletId: wallets[1].id,
      writeDecision: 'commit',
    })
  })

  it('does not collapse two incoming transfers into the first amount', async () => {
    const result = await analyze(
      'ibu transfer 100rb dan teman transfer 50rb ke saya, catat ke BCA'
    )

    expectNoExecutableMutation(result)
  })

  it.each([
    'ibu transfer 2 kali 100rb ke saya, catat ke BCA',
    'ibu transfer dua kali 100rb ke saya, catat ke BCA',
    'tadi beli kopi 2 kali 20rb dari BCA, catat',
    'tadi beli kopi dua kali 20rb dari BCA, catat',
    'tadi beli kopi 2 kali masing-masing 20rb dari BCA, catat',
    'transfer 2 kali 100rb dari BCA ke Tunai',
    'beli 2 roti masing-masing 10rb dari BCA, catat',
    'beli dua roti masing-masing 10rb dari BCA, catat',
    'beli 3 liter bensin 10rb per liter dari BCA, catat',
    'beli 2 tiket 50rb per tiket dari BCA, catat',
    'beli 2 kopi @20rb dari BCA, catat',
  ])('never ignores transaction multiplicity: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'kembalian 36rb dari uang 50rb, berarti habis berapa?',
    'dari 50rb kembali 36rb, berarti habis berapa?',
    'bayar 50rb, sisa 36rb, berarti habis berapa?',
  ])('understands reversed Indonesian change arithmetic: %s', async (text) => {
    const result = await analyze(text)

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
    expectNoExecutableMutation(result)
  })

  it('routes an explicit correction of the latest item before creating a new draft', async () => {
    const result = await analyze('makan tadi harusnya 12rb')

    expect(result).toMatchObject({
      type: 'correct_last_transaction',
      amount: 12000,
      category: 'Makan',
      writeDecision: 'commit',
    })
  })

  it.each([
    'yang tadi harusnya bukan 80rb',
    'yang tadi harusnya tidak 80rb',
    'makan tadi harusnya bukan 80rb',
    'koreksi yang tadi bukan 80rb',
    'ubah transaksi terakhir, jangan 80rb',
    'ganti transaksi terakhir bukan 80rb',
  ])('never applies a nominal that the user explicitly rejects: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text))
  })

  it.each([
    'transfer jangan 100rb dari BCA ke Tunai',
    'transfer bukan 100rb dari BCA ke Tunai',
    'transfer 100rb bukan dari BCA ke Tunai',
    'transfer 100rb jangan dari BCA ke Tunai',
    'tabung jangan 100rb dari BCA ke target Dana Darurat',
    'tabung 100rb bukan dari BCA ke target Dana Darurat',
    'transfer 25rb dari target Dana Darurat bukan ke BCA',
    'ganti nama dompet BCA bukan jadi Utama',
    'hapus dompet bukan BCA',
  ])('never executes a mutation with a negated amount or entity argument: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text, { goalOptions: goals }))
  })

  it.each([
    'catat semua kecuali kopi 20rb dari BCA',
    'catat pengeluaran selain kopi 20rb dari BCA',
    'catat kopi 20rb tanpa dari BCA',
    'transfer 100rb kecuali dari BCA ke Tunai',
    'transfer 100rb selain dari BCA ke Tunai',
    'transfer 100rb dari semua kecuali BCA ke Tunai',
    'tabung 100rb dari semua kecuali BCA ke target Dana Darurat',
    'ganti nama dompet selain BCA jadi Utama',
  ])('never executes an unmodeled exclusion scope: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text, { goalOptions: goals }))
  })

  it.each([
    'transfer 100rb dari BCA ke Tunai dan DANA',
    'transfer 100rb dari BCA ke Tunai plus DANA',
    'transfer 100rb dari BCA dan OVO ke Tunai',
    'tabung 100rb dari BCA dan OVO ke target Dana Darurat',
    'transfer 25rb dari target Dana Darurat ke BCA dan OVO',
    'buat dompet DANA dan OVO saldo 100rb',
    'buat target Liburan dan Laptop 5jt',
  ])('never truncates multiple sources or destinations to the first wallet: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text, {
      walletOptions: movementWallets,
      goalOptions: goals,
    }))
  })

  it.each([
    'transfer 100rb dan 200rb dari BCA ke Tunai',
    'transfer 100rb + 20rb dari BCA ke Tunai',
    'transfer 100rb dari BCA ke Tunai biaya admin 5rb',
    'tabung 100rb dan 50rb dari BCA ke target Dana Darurat',
    'transfer 25rb dan 10rb dari target Dana Darurat ke BCA',
    'buat target Liburan 5jt setoran awal 1jt',
    'buat target Liburan 5jt dari BCA',
    'buat dompet DANA saldo 100rb dari BCA',
  ])('never drops a mutation amount or an unmodeled funding leg: %s', async (text) => {
    expectNoExecutableMutation(await analyze(text, { goalOptions: goals }))
  })

  it('still executes one exact transfer when additional wallets exist', async () => {
    const result = await analyze('transfer 100rb dari BCA ke DANA', {
      walletOptions: movementWallets,
      goalOptions: goals,
    })

    expect(getChatWriteCandidate(result)).toMatchObject({
      type: 'transfer',
      amount: 100000,
      fromWalletId: wallets[1].id,
      toWalletId: movementWallets[2].id,
      writeDecision: 'commit',
    })
  })

  it.each([
    ['transfer Rp20 dari BCA ke Tunai', 'transfer', 'amount', 20],
    ['transfer 20 rupiah dari BCA ke Tunai', 'transfer', 'amount', 20],
    ['transfer 50 perak dari BCA ke Tunai', 'transfer', 'amount', 50],
    ['tabung Rp20 dari BCA ke target Dana Darurat', 'goal_contribution', 'amount', 20],
    ['buat target Tes Rp20', 'goal_creation_pending', 'targetAmount', 20],
    ['buat dompet Receh saldo Rp20', 'create_wallet', 'initial_balance', 20],
    ['transfer 1 kali 100rb dari BCA ke Tunai', 'transfer', 'amount', 100000],
    ['transfer dua puluh ribu dari BCA ke Tunai', 'transfer', 'amount', 20000],
    ['tabung setengah juta dari BCA ke target Dana Darurat', 'goal_contribution', 'amount', 500000],
    ['buat target Tes lima juta', 'goal_creation_pending', 'targetAmount', 5000000],
  ])('uses the same literal amount in safety review and execution: %s', async (
    text,
    type,
    amountField,
    expectedAmount
  ) => {
    const result = await analyze(text, { goalOptions: goals })
    const candidate = getChatWriteCandidate(result)

    expect(candidate).toMatchObject({
      type,
      [amountField]: expectedAmount,
      writeDecision: 'commit',
    })
  })

  it.each([
    'kalau 5jt gimana?',
    'sekitar 5jt',
    '5jt atau 10jt',
    'USD 20',
    'besok 5jt',
  ])('rejects an ambiguous value while filling a pending finance slot: %s', (text) => {
    expect(assessPendingFinanceReply(text).safe).toBe(false)
  })

  it.each([
    ['5jt', '5jt'],
    ['targetnya lima juta', 'targetnya 5000000 rupiah'],
    ['pakai BCA', 'pakai bca'],
  ])('accepts and normalizes a direct pending-slot answer: %s', (text, normalizedText) => {
    expect(assessPendingFinanceReply(text)).toMatchObject({
      safe: true,
      normalizedText,
    })
  })
})
