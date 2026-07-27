export function buildWalletDeletionPrompt(wallet, formatRupiah, { markdown = false } = {}) {
  const balance = Number(wallet?.current_balance || 0)
  const walletName = wallet?.name || 'dompet ini'
  const highlightedName = markdown ? `**${walletName}**` : `"${walletName}"`

  if (balance !== 0) {
    const highlightedBalance = markdown ? `**${formatRupiah(balance)}**` : formatRupiah(balance)

    return [
      `Hapus dompet ${highlightedName}?`,
      `Saldo yang masih tersisa: ${highlightedBalance}.`,
      'Kalau lanjut, dompet dan riwayat transaksinya akan dihapus.',
      markdown
        ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
        : 'Lanjutkan penghapusan?',
    ].join('\n\n')
  }

  return [
    `Hapus dompet ${highlightedName}?`,
    'Dompet dan riwayat transaksinya akan dihapus.',
    markdown
      ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
      : 'Lanjutkan penghapusan?',
  ].join('\n\n')
}

export function buildWalletDeletionSuccess(walletName) {
  return `Dompet **${walletName}** berhasil dihapus.`
}

export function buildWalletRestorePrompt(wallet, { markdown = false } = {}) {
  const walletName = wallet?.name || 'dompet ini'
  const highlightedName = markdown ? `**${walletName}**` : `"${walletName}"`

  return [
    `Pulihkan dompet ${highlightedName} ke daftar aktif?`,
    'Dompet ini akan kembali muncul di daftar aktif dan bisa dipakai lagi untuk transaksi serta chat.',
    markdown
      ? 'Ketik "Ya" untuk konfirmasi atau "Batal" untuk membatalkan.'
      : 'Lanjutkan pemulihan?',
  ].join('\n\n')
}

export function buildWalletRestoreSuccess(walletName) {
  return `Dompet **${walletName}** berhasil dipulihkan ke daftar aktif.`
}

export function buildWalletDeletionNotice(walletName) {
  return `Dompet ${walletName} berhasil dihapus.`
}

export function buildWalletRestoreNotice(walletName) {
  return `Dompet ${walletName} berhasil dipulihkan ke daftar aktif.`
}

export function getWalletDeletionDialogCopy(wallet, formatRupiah) {
  const balance = Number(wallet?.current_balance || 0)
  const walletName = wallet?.name || 'dompet ini'

  if (balance !== 0) {
    return {
      title: `Hapus dompet "${walletName}"?`,
      paragraphs: [
        `Saldo yang masih tersisa: ${formatRupiah(balance)}.`,
        'Kalau lanjut, dompet dan riwayat transaksinya akan dihapus.',
      ],
      confirmLabel: 'Hapus Dompet',
      tone: 'danger',
    }
  }

  return {
    title: `Hapus dompet "${walletName}"?`,
    paragraphs: [
      'Dompet dan riwayat transaksinya akan dihapus.',
    ],
    confirmLabel: 'Hapus Dompet',
    tone: 'danger',
  }
}

export function getGoalDeletionDialogCopy(goal, refundAmount, refundTargetName, formatRupiah) {
  if (refundAmount > 0) {
    return {
      title: `Hapus target "${goal?.name || 'target ini'}"?`,
      paragraphs: [
        `Dana sebesar ${formatRupiah(refundAmount)} akan dikembalikan ke dompet ${refundTargetName}.`,
        'Saldo dan histori tetap sinkron.',
      ],
      confirmLabel: 'Hapus Target',
      tone: 'danger',
    }
  }

  return {
    title: `Hapus target "${goal?.name || 'target ini'}"?`,
    paragraphs: [
      'Target ini akan dihapus.',
    ],
    confirmLabel: 'Hapus Target',
    tone: 'danger',
  }
}

export function getTransactionDeletionDialogCopy(transaction, formatRupiah, { mode = 'delete' } = {}) {
  const amount = Number(transaction?.amount || 0)
  const isIncome = transaction?.type === 'income'
  const title = transaction?.title || transaction?.desc || 'transaksi ini'
  const walletName = transaction?.wallet || 'dompet terkait'
  const categoryName = transaction?.category || 'kategori terkait'
  const directionLabel = isIncome ? 'Pemasukan' : 'Pengeluaran'
  const balanceEffect = isIncome
    ? `Saldo ${walletName} akan dikurangi ${formatRupiah(amount)}.`
    : `Saldo ${walletName} akan dikembalikan ${formatRupiah(amount)}.`

  return {
    title: mode === 'undo' ? `Batalkan "${title}"?` : `Hapus "${title}"?`,
    paragraphs: [
      `${directionLabel}: ${formatRupiah(amount)} (${categoryName}).`,
      balanceEffect,
      'Analytics dan histori akan ikut disinkronkan.',
    ],
    confirmLabel: mode === 'undo' ? 'Batalkan' : 'Hapus',
    tone: 'danger',
  }
}

export function mapDomainError(error) {
  const rawMessage = String(error?.message || error || '').trim()
  const message = rawMessage.toLowerCase()

  if (!rawMessage) {
    return 'Terjadi kesalahan saat memproses permintaan.'
  }

  if (message.includes('insufficient wallet balance')) {
    return 'Saldo dompet tidak cukup untuk menjalankan aksi ini.'
  }

  if (message.includes('goal balance is insufficient')) {
    return 'Saldo target tabungan tidak cukup untuk pencairan itu.'
  }

  if (message.includes('wallet not found') || message.includes('source wallet not found') || message.includes('destination wallet not found')) {
    return 'Dompet yang dimaksud tidak ditemukan atau sudah tidak aktif.'
  }

  if (message.includes('goal not found')) {
    return 'Target tabungan yang dimaksud tidak ditemukan.'
  }

  if (message.includes('wallet name is already in use')) {
    return 'Nama dompet itu sudah dipakai. Gunakan nama lain atau rename dompet yang bentrok.'
  }

  if (message.includes('wallet is already active')) {
    return 'Dompet itu sudah aktif, jadi tidak perlu dipulihkan lagi.'
  }

  if (message.includes('goal name is already in use')) {
    return 'Nama target itu sudah dipakai. Gunakan nama lain atau rename target yang bentrok.'
  }

  if (message.includes('category not found')) {
    return 'Kategori yang dipilih tidak ditemukan. Transaksi belum disimpan.'
  }

  if (message.includes('amount must be greater than zero')) {
    return 'Nominal harus lebih besar dari nol.'
  }

  if (message.includes('initial balance must not be negative') || message.includes('initial amount must not be negative')) {
    return 'Saldo awal tidak boleh negatif.'
  }

  if (message.includes('wallet is required')) {
    return 'Aksi ini butuh dompet sumber atau tujuan yang jelas.'
  }

  if (message.includes('unauthorized') || message.includes('jwt')) {
    return 'Sesi Anda sudah tidak valid. Muat ulang lalu login lagi.'
  }

  if (message.includes('goal name is required')) {
    return 'Nama target wajib diisi.'
  }

  if (message.includes('wallet name is required')) {
    return 'Nama dompet wajib diisi.'
  }

  if (
    message.includes('server live masih memakai aturan hapus wallet lama') ||
    message.includes('wallet masih memiliki saldo dan tidak bisa dihapus permanen') ||
    message.includes('wallet dengan riwayat ledger tidak bisa dihapus permanen')
  ) {
    return 'Server live Anda masih memakai aturan hapus wallet lama. Jalankan migration Neon terbaru agar dompet bersaldo bisa dihapus permanen.'
  }

  return rawMessage
}
