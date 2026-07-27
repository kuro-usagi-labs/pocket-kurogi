function buildPrompt(label, walletName) {
  if (!walletName) {
    return label
  }

  return `${label} ${walletName}`.trim()
}

function countLooseCategories(transactions = []) {
  return transactions.filter((transaction) => String(transaction.category || '').toLowerCase() === 'lainnya').length
}

function countRecurringExpenses(transactions = []) {
  const signatures = new Map()
  transactions
    .filter((transaction) => transaction.type === 'expense' || transaction.analyticsBucket === 'expense')
    .forEach((transaction) => {
      const label = String(transaction.desc || transaction.title || transaction.category || '').toLowerCase().trim()
      const key = `${label}:${Number(transaction.amount || 0)}`
      if (label) signatures.set(key, (signatures.get(key) || 0) + 1)
    })

  return [...signatures.values()].filter((count) => count >= 2).length
}

export function buildChatQuickActions({
  wallets = [],
  archivedWallets = [],
  transactions = [],
  analytics = {},
} = {}) {
  const primaryWallet = wallets[0] || null
  const secondaryWallet = wallets[1] || null
  const looseCategoryCount = countLooseCategories(transactions)
  const recurringExpenseCount = countRecurringExpenses(transactions)
  const netCashflow = Number(analytics?.netCashflow || 0)

  if (!primaryWallet) {
    return [
      {
        id: 'add-wallet',
        icon: 'wallet',
        label: 'Tambah dompet',
        helper: 'Mulai setup',
        navigateTo: 'wallets',
      },
      {
        id: 'help',
        icon: 'sparkles',
        label: 'Contoh perintah',
        helper: 'Lihat bantuan',
        prompt: 'kamu bisa bantu apa aja?',
      },
      {
        id: 'overview',
        icon: 'summary',
        label: 'Ringkasan',
        helper: 'Kondisi awal',
        prompt: 'ringkas keuangan saya',
      },
      {
        id: 'compose',
        icon: 'compose',
        label: 'Tulis pesan',
        helper: 'Mulai dari chat',
        action: 'scroll',
      },
    ]
  }

  if (transactions.length === 0 && Number(primaryWallet.current_balance || 0) <= 0) {
    return [
      {
        id: 'income',
        icon: 'income',
        label: 'Isi saldo awal',
        helper: primaryWallet.name,
        prompt: buildPrompt('pemasukan 1jt ke', primaryWallet.name),
        action: 'compose',
      },
      {
        id: 'add-wallet',
        icon: 'wallet',
        label: 'Tambah dompet',
        helper: 'Bank atau e-wallet',
        navigateTo: 'wallets',
      },
      {
        id: 'help',
        icon: 'sparkles',
        label: 'Contoh perintah',
        helper: 'Pelajari chat',
        prompt: 'kamu bisa bantu apa aja?',
      },
      {
        id: 'compose',
        icon: 'compose',
        label: 'Tulis sendiri',
        helper: 'Mulai dari chat',
        action: 'scroll',
      },
    ]
  }

  const actions = [
    {
      id: 'expense',
      icon: 'expense',
      label: 'Catat keluar',
      helper: primaryWallet.name,
      prompt: buildPrompt('beli makan 25rb dari', primaryWallet.name),
      action: 'compose',
    },
  ]

  if (transactions.length === 0) {
    actions.push({
      id: 'income',
      icon: 'income',
      label: 'Catat masuk',
      helper: primaryWallet.name,
      prompt: buildPrompt('gaji 5jt ke', primaryWallet.name),
      action: 'compose',
    })
  } else if (secondaryWallet) {
    actions.push({
      id: 'transfer',
      icon: 'transfer',
      label: 'Transfer',
      helper: `${primaryWallet.name} ke ${secondaryWallet.name}`,
      prompt: `transfer 100rb dari ${primaryWallet.name} ke ${secondaryWallet.name}`,
      action: 'compose',
    })
  } else {
    actions.push({
      id: 'income',
      icon: 'income',
      label: 'Catat masuk',
      helper: primaryWallet.name,
      prompt: buildPrompt('pemasukan 500rb ke', primaryWallet.name),
      action: 'compose',
    })
  }

  if (archivedWallets.length > 0) {
    actions.push({
      id: 'restore-wallet',
      icon: 'restore',
      label: 'Pulihkan',
      helper: archivedWallets[0].name,
      prompt: `pulihkan dompet ${archivedWallets[0].name}`,
    })
  } else if (looseCategoryCount >= 3) {
    actions.push({
      id: 'cleanup-category',
      icon: 'sparkles',
      label: 'Rapikan kategori',
      helper: `${looseCategoryCount} lainnya`,
      prompt: 'review transaksi kategori lainnya saya dan sarankan perbaikan kategori yang lebih rapi',
    })
  } else if (recurringExpenseCount > 0) {
    actions.push({
      id: 'recurring-expenses',
      icon: 'summary',
      label: 'Cek rutin',
      helper: `${recurringExpenseCount} pola`,
      prompt: 'cek transaksi berulang saya',
    })
  } else {
    actions.push({
      id: 'daily-budget',
      icon: 'wallet',
      label: 'Budget harian',
      helper: `${wallets.length} dompet`,
      prompt: 'budget harian saya berapa?',
    })
  }

  actions.push({
    id: netCashflow < 0 ? 'advice' : 'summary',
    icon: netCashflow < 0 ? 'advice' : 'summary',
    label: netCashflow < 0 ? 'Saran hemat' : 'Ringkasan',
    helper: 'Bulan ini',
    prompt:
      netCashflow < 0
        ? 'berdasarkan data saya, strategi terbaik untuk menahan pengeluaran bulan ini apa?'
        : 'ringkas keuangan bulan ini',
  })

  return actions.slice(0, 4)
}
