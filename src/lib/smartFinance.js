import { matchMoney, normalizeEntityName, parseMoneyMatch, resolveOptionReference } from './chatEntities'

export function detectSmartFinanceQuery(text, walletOptions = [], goalOptions = []) {
  const normalized = String(text || '').toLowerCase().trim()
  if (!normalized) return null

  const moneyMatch = matchMoney(normalized)
  const amount = moneyMatch ? parseMoneyMatch(moneyMatch) : 0

  if (/\b(cukup|mampu|sanggup|aman)\b.*\b(beli|bayar|ambil)\b|\b(bisa|boleh)\s+(?:ga|gak|nggak|tidak)?\s*(?:beli|bayar)/i.test(normalized)) {
    const wallet = resolveOptionReference({ input: normalized, options: prepareOptions(walletOptions) }).match
    return {
      type: 'affordability_query',
      amount,
      walletId: wallet?.id || null,
      wallet: wallet?.name || null,
    }
  }

  if (/\b(budget|batas|jatah)\s+(harian|per hari)|\b(boleh|aman)\s+(belanja|keluar)\s+(berapa|per hari)/i.test(normalized)) {
    return { type: 'daily_budget_query' }
  }

  if (/\b(berapa lama|kapan|bulan berapa)\b.*\b(target|goal|tabungan|tercapai|terkumpul|lunas)\b|\b(target|goal|tabungan)\b.*\b(berapa lama|kapan|tercapai)/i.test(normalized)) {
    const goal = resolveOptionReference({ input: normalized, options: prepareOptions(goalOptions) }).match
    return {
      type: 'goal_projection_query',
      goalId: goal?.id || null,
      goal: goal?.name || null,
      monthlyContribution: amount,
    }
  }

  if (/\b(langganan|subscription|transaksi berulang|pengeluaran rutin|tagihan rutin)\b/i.test(normalized)) {
    return { type: 'recurring_expense_query' }
  }

  return null
}

function prepareOptions(options = []) {
  return options.map((option) => ({
    ...option,
    normalizedName: option.normalizedName || normalizeEntityName(option.name),
  }))
}

export function buildSmartFinanceReply({
  query,
  wallets = [],
  goals = [],
  transactions = [],
  totalBalance = 0,
  formatRupiah,
  now = new Date(),
}) {
  if (query?.type === 'affordability_query') {
    if (!query.amount) {
      return 'Sebutkan harga yang ingin dicek. Contoh: “saldo saya cukup untuk beli sepatu 750rb?”'
    }

    const wallet = query.walletId ? wallets.find((item) => item.id === query.walletId) : null
    const available = Number(wallet?.current_balance ?? totalBalance ?? 0)
    const remaining = available - query.amount
    const sourceLabel = wallet ? `dompet **${wallet.name}**` : 'seluruh saldo likuid'

    if (remaining < 0) {
      return `${sourceLabel} belum cukup. Kurangnya **${formatRupiah(Math.abs(remaining))}** untuk pembelian ${formatRupiah(query.amount)}.`
    }

    const spendingShare = available > 0 ? (query.amount / available) * 100 : 100
    const caution = spendingShare >= 50
      ? ' Nominal ini memakai lebih dari separuh saldo yang tersedia, jadi sebaiknya cek kebutuhan rutin dulu.'
      : spendingShare >= 25
        ? ' Nominalnya cukup besar terhadap saldo; pastikan budget penting bulan ini sudah aman.'
        : ' Setelah transaksi, ruang saldo masih relatif aman.'

    return `${sourceLabel} cukup. Sisa setelah pembelian sekitar **${formatRupiah(remaining)}**.${caution}`
  }

  if (query?.type === 'daily_budget_query') {
    const current = new Date(now)
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(lastDay - current.getDate() + 1, 1)
    const safeReserve = Math.max(Number(totalBalance || 0) * 0.2, 0)
    const spendable = Math.max(Number(totalBalance || 0) - safeReserve, 0)
    const dailyBudget = Math.floor(spendable / daysRemaining / 1000) * 1000

    if (totalBalance <= 0) return 'Belum ada saldo likuid yang bisa dijadikan dasar budget harian.'

    return `Sampai akhir bulan tersisa **${daysRemaining} hari**. Dengan menahan cadangan 20%, batas belanja harian yang lebih aman sekitar **${formatRupiah(dailyBudget)} per hari**.`
  }

  if (query?.type === 'goal_projection_query') {
    const goal = query.goalId ? goals.find((item) => item.id === query.goalId) : goals[0]
    if (!goal) return 'Belum ada target aktif untuk diproyeksikan. Buat target dulu, lalu tanyakan kapan target itu tercapai.'

    const remaining = Math.max(Number(goal.target_amount || 0) - Number(goal.current_amount || 0), 0)
    if (remaining <= 0) return `Target **${goal.name}** sudah tercapai.`
    if (!query.monthlyContribution) {
      return `Target **${goal.name}** masih kurang **${formatRupiah(remaining)}**. Sebutkan rencana setoran bulanan, misalnya “kapan target ${goal.name} tercapai kalau nabung 500rb per bulan?”`
    }

    const months = Math.ceil(remaining / query.monthlyContribution)
    const targetDate = new Date(now)
    targetDate.setMonth(targetDate.getMonth() + months)
    const targetLabel = targetDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    return `Dengan setoran **${formatRupiah(query.monthlyContribution)} per bulan**, target **${goal.name}** diperkirakan tercapai dalam **${months} bulan**, sekitar **${targetLabel}**.`
  }

  if (query?.type === 'recurring_expense_query') {
    const groups = new Map()
    transactions
      .filter((item) => item.type === 'expense' || item.analyticsBucket === 'expense')
      .forEach((item) => {
        const label = String(item.desc || item.title || item.category || 'Pengeluaran').trim()
        const key = `${label.toLowerCase()}::${Number(item.amount || 0)}`
        const current = groups.get(key) || { label, amount: Number(item.amount || 0), count: 0 }
        current.count += 1
        groups.set(key, current)
      })

    const recurring = [...groups.values()]
      .filter((item) => item.count >= 2)
      .sort((left, right) => right.count - left.count || right.amount - left.amount)
      .slice(0, 3)

    if (recurring.length === 0) return 'Belum terlihat pengeluaran berulang yang cukup konsisten dari riwayat transaksi.'

    return [
      'Pengeluaran berulang yang terdeteksi:',
      ...recurring.map((item) => `- **${item.label}** — ${formatRupiah(item.amount)}, muncul ${item.count} kali`),
      'Periksa apakah semuanya masih dipakai dan layak dipertahankan.',
    ].join('\n')
  }

  return 'Saya belum bisa menghitung pertanyaan itu dari data yang tersedia.'
}
