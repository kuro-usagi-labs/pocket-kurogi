import { formatCompactList } from './formatters'

const SLOT_QUESTIONS = Object.freeze({
  amount: 'Berapa nominal pastinya?',
  description: 'Uang itu digunakan atau diterima untuk apa?',
  wallet: 'Pakai dompet mana?',
  sourceWallet: 'Uangnya dipindahkan dari dompet mana?',
  destinationWallet: 'Uangnya dipindahkan ke dompet mana?',
  walletName: 'Dompet barunya ingin diberi nama apa?',
  nextWalletName: 'Nama baru dompetnya apa?',
  category: 'Kategori mana yang ingin kamu gunakan?',
  items: 'Tolong pisahkan tiap transaksi beserta nominalnya.',
  goal: 'Target tabungan yang mana?',
  pendingActionId: 'Aksi mana yang ingin kamu lanjutkan?',
  correction: 'Bagian mana yang ingin diubah?',
})

export function planClarification({
  intentResult = null,
  slotResult = null,
  entities = {},
} = {}) {
  if (intentResult?.ambiguous) {
    const alternatives = (intentResult.alternatives || [])
      .filter((candidate) => candidate.score >= 0.35 && candidate.intent !== 'unknown')
      .slice(0, 2)
      .map((candidate) => humanizeIntent(candidate.intent))

    return {
      type: 'intent',
      field: 'intent',
      question: alternatives.length > 1
        ? `Maksudmu ingin ${formatCompactList(alternatives)}?`
        : 'Kamu ingin mencatat transaksi, melihat data, atau meminta saran?',
      alternatives,
    }
  }

  const ambiguousWallet = entities.wallets?.find((wallet) => wallet.source === 'ambiguous')
  const missingWalletField = (slotResult?.missingSlots || []).find((slot) =>
    ['wallet', 'sourceWallet', 'destinationWallet'].includes(slot)
  )
  if (ambiguousWallet && missingWalletField) {
    const candidates = ambiguousWallet.candidates?.map((candidate) => candidate.name) || []
    return {
      type: 'entity',
      field: missingWalletField,
      question: `${missingWalletField === 'sourceWallet' ? 'Dompet sumbernya' : 'Dompetnya'} masih ambigu. Pilih ${formatCompactList(candidates)}.`,
      candidates,
    }
  }

  const missingSlot = slotResult?.missingSlots?.[0]
  if (missingSlot) {
    return {
      type: 'slot',
      field: missingSlot,
      question: SLOT_QUESTIONS[missingSlot] || `Saya masih membutuhkan ${missingSlot}.`,
      candidates: [],
    }
  }

  return null
}

function humanizeIntent(intent) {
  return {
    record_expense: 'mencatat pengeluaran',
    record_income: 'mencatat pemasukan',
    record_multiple_transactions: 'mencatat beberapa transaksi',
    transfer_money: 'mentransfer antar-dompet',
    query_balance: 'mengecek saldo',
    query_expenses: 'melihat pengeluaran',
    query_income: 'melihat pemasukan',
    financial_advice: 'meminta saran keuangan',
  }[intent] || intent.replaceAll('_', ' ')
}
