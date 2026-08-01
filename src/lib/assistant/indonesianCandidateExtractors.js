const PARTY_PATTERN =
  /\b(?<party>teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan|bos)(?:ku|nya)?\b/iu

/**
 * Specialist Indonesian extractors. They only propose grounded candidates;
 * routing, safety, dialogue, and execution remain owned by the canonical
 * assistant pipeline.
 */
export function extractIndonesianCandidates({
  text = '',
  amounts = [],
  wallets = [],
} = {}) {
  return [
    extractCompoundPurchase(text, amounts, wallets),
    extractIncomingTransfer(text, amounts),
    extractRunwayScenario(text, amounts),
    extractGoalPlan(text, amounts, wallets),
  ].filter(Boolean)
}

function extractCompoundPurchase(text, amounts, wallets) {
  if (amounts.length < 2 || !/\b(?:beli|belanja|jajan)\b/iu.test(text)) {
    return null
  }

  const tender = amounts.find((amount) => {
    const before = text.slice(Math.max(0, amount.start - 35), amount.start)
    return /\b(?:pakai|bawa|serahkan|kasih)(?:\s+(?:dengan|sebesar))?\s+(?:uang|duit)\s*$/iu.test(before)
  })
  const change = amounts.find((amount) => {
    const before = text.slice(Math.max(0, amount.start - 28), amount.start)
    return /\b(?:kembalian|kembali|sisa)\s*$/iu.test(before)
  })
  if (!tender && !change) return null

  const itemAmounts = amounts.filter((amount) => amount !== tender && amount !== change)
  if (itemAmounts.length === 0) return null
  const items = itemAmounts.map((amount, index) => ({
    clientItemId: `item-${index + 1}`,
    amount: amount.value,
    transactionType: 'expense',
    description: describeAmount(text, amount, index),
    walletId: wallets[0]?.id || null,
    wallet: wallets[0]?.name || null,
    evidence: evidenceFor(amount, 'purchase_amount'),
  }))

  return candidate('compound_purchase', Math.min(0.99, 0.86 + itemAmounts.length * 0.03), [
    tender ? evidenceFor(tender, 'tendered_amount') : null,
    change ? evidenceFor(change, 'change_amount') : null,
    ...itemAmounts.map((amount) => evidenceFor(amount, 'purchase_amount')),
  ], {
    tenderedAmount: tender?.value || null,
    changeAmount: change?.value || null,
    computedSpent: tender && change ? tender.value - change.value : null,
    items,
  })
}

function extractIncomingTransfer(text, amounts) {
  const transfer = text.match(
    /\b(?:teman|temen|istri|suami|adik|kakak|ibu|ayah|mama|papa|pacar|anak|saudara|rekan|bos)(?:ku|nya)?\b.{0,45}\b(?:transfer|kirim(?:kan)?|kasih|beri)\b.{0,40}\b(?:ke|kepada|buat)\s+(?:saya|aku|gue|gw)\b/iu
  )
  if (!transfer || amounts.length === 0) return null
  const party = text.match(PARTY_PATTERN)?.groups?.party || 'seseorang'
  const amount = amounts[0]
  return candidate('incoming_transfer', 0.96, [
    textEvidence(transfer[0], transfer.index, 'incoming_ownership'),
    evidenceFor(amount, 'income_amount'),
  ], {
    amount: amount.value,
    description: `Transfer dari ${titleCase(party)}`,
    transactionType: 'income',
  })
}

function extractRunwayScenario(text, amounts) {
  const balanceCue = text.match(
    /(?:\b(?:saldo|uang|dompet|rekening)\b.{0,35}\b(?:tinggal|sisa|cuma|hanya|menipis)\b|\b(?:tinggal|sisa|cuma|hanya)\b.{0,24}(?:rp\s*)?\d)/iu
  )
  const horizon = text.match(
    /\b(?:(?<count>\d+)\s*(?<unit>hari|minggu|pekan|bulan)|sebulan|akhir bulan|sampai gajian|gajian|cukup|hemat|prioritas|gimana|bagaimana)\b/iu
  )
  if (!balanceCue || !horizon || amounts.length === 0) return null
  const balance = amounts[0]
  const count = Number(horizon.groups?.count || 0)
  const unit = horizon.groups?.unit
  const horizonDays = count > 0
    ? count * (/minggu|pekan/iu.test(unit || '') ? 7 : /bulan/iu.test(unit || '') ? 30 : 1)
    : /sebulan/iu.test(horizon[0]) ? 30 : null
  return candidate('runway_scenario', 0.94, [
    evidenceFor(balance, 'scenario_balance'),
    textEvidence(horizon[0], horizon.index, 'runway_horizon'),
  ], {
    scenarioBalance: balance.value,
    horizonDays,
  })
}

function extractGoalPlan(text, amounts, wallets) {
  if (
    amounts.length < 2 ||
    !/\b(?:target|goal|tabungan|menabung|nabung)\b/iu.test(text) ||
    !/\b(?:buat|bikin|pasang|tambah|catat)\b/iu.test(text)
  ) return null

  const initial = amounts.find((amount) => {
    const before = text.slice(Math.max(0, amount.start - 38), amount.start)
    return /\b(?:setoran|modal|isi|saldo)\s+awal(?:nya)?(?:\s+(?:sebesar|senilai))?\s*$/iu.test(before) ||
      /\bmulai\s+dengan\s*$/iu.test(before)
  })
  const target = amounts.find((amount) => amount !== initial)
  if (!target || !initial) return null
  return candidate('goal_with_opening_deposit', 0.97, [
    evidenceFor(target, 'goal_target'),
    evidenceFor(initial, 'opening_deposit'),
  ], {
    targetAmount: target.value,
    initialAmount: initial.value,
    sourceWallet: wallets[0]?.id
      ? { id: wallets[0].id, name: wallets[0].name }
      : null,
  })
}

function describeAmount(text, amount, index) {
  const start = Math.max(
    text.lastIndexOf(',', amount.start),
    text.lastIndexOf(' dan ', amount.start),
    text.lastIndexOf(' lalu ', amount.start),
    0
  )
  const description = text.slice(start, amount.start)
    .replace(/\b(?:dan|lalu|terus|tolong|catat|beli|belanja|jajan|harga|tadi)\b/giu, ' ')
    .replace(/[,.;:!?]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  return description ? titleCase(description) : `Transaksi ${index + 1}`
}

function candidate(kind, confidence, evidence, fields) {
  return {
    kind,
    source: 'utterance',
    confidence,
    evidence: evidence.filter(Boolean),
    fields,
  }
}

function evidenceFor(entity, type) {
  return textEvidence(entity.raw, entity.start, type)
}

function textEvidence(raw, start = 0, type) {
  return { type, raw, start: start || 0, end: (start || 0) + String(raw || '').length }
}

function titleCase(value) {
  return String(value || '').replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase('id-ID'))
}
