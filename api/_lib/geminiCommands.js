import { normalizeMoneyNumber } from '../../src/lib/moneyNumber.js'

export const LANGUAGE_INTENTS = ['record_income', 'record_expense', 'transfer_money', 'create_wallet',
  'create_saving_goal', 'deposit_goal', 'withdraw_goal', 'query_balance', 'query_income',
  'query_expenses', 'query_transactions', 'query_saving_goal', 'query_budget', 'set_theme', 'general_chat', 'clarify']
const FIELDS = ['amountText', 'description', 'wallet', 'sourceWallet', 'destinationWallet', 'name', 'targetText', 'dateText', 'reply', 'theme']
export const LANGUAGE_SCHEMA = {
  type: 'object', properties: {
    intent: { type: 'string', enum: LANGUAGE_INTENTS },
    ...Object.fromEntries(FIELDS.map((key) => [key, { type: 'string' }])),
  }, required: ['intent', ...FIELDS],
}

export function languageContext(context = {}) {
  const names = (items) => Array.isArray(items)
    ? items.slice(0, 60).filter((name) => typeof name === 'string' && name.length <= 100) : []
  return { wallets: names(context?.wallets), goals: names(context?.goals) }
}

function amountFromEvidence(evidence, text) {
  if (!evidence) return ''
  const escaped = evidence.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`(?<![\\p{L}\\d.,-])${escaped}(?![\\p{L}\\d.,])`, 'iu').test(text)) throw new Error('Missing amount evidence')
  const match = evidence.trim().match(/^(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|miliar)?(?:\s*rupiah)?$/iu)
  const numeric = match && normalizeMoneyNumber(match[1])
  if (numeric === null || !match) throw new Error('Invalid amount')
  const scale = { rb: 1000, ribu: 1000, k: 1000, jt: 1000000, juta: 1000000, miliar: 1000000000 }
  const value = Number(numeric) * (scale[match[2]?.toLowerCase()] || 1)
  if (!Number.isFinite(value) || value < 0 || value > 1e12) throw new Error('Invalid amount')
  return `Rp${value.toFixed(2).replace('.', ',')}`
}

// Compile only allowlisted operations; model output is never executable code or SQL.
export function compileLanguageCommand(result, text, rawContext) {
  if (!result || !LANGUAGE_INTENTS.includes(result.intent)) throw new Error('Invalid intent')
  for (const field of FIELDS) {
    if (result[field] != null && (typeof result[field] !== 'string' || result[field].length > (field === 'reply' ? 3000 : 140))) throw new Error('Invalid field')
  }
  const context = languageContext(rawContext)
  const original = text.toLowerCase()
  if (!result.intent.startsWith('query_') && !['general_chat', 'clarify'].includes(result.intent) &&
    /\b(?:jangan|bukan|tidak|andaikan|seandainya|kalau|misalnya)\b/iu.test(text)) throw new Error('Unsafe action context')
  const clean = (value) => String(value || '').replace(/[^\p{L}\p{N} &'-]/gu, ' ').replace(/\s+/g, ' ').trim()
  const referenced = (value, allowed) => {
    if (!value) return ''
    const name = allowed.find((item) => item.toLowerCase() === value.toLowerCase())
    if (!name || !original.includes(name.toLowerCase())) throw new Error('Unknown reference')
    return clean(name)
  }
  const wallet = referenced(result.wallet, context.wallets)
  const source = referenced(result.sourceWallet, context.wallets)
  const destination = referenced(result.destinationWallet, context.wallets)
  const name = clean(result.name)
  if (name && !original.includes(name.toLowerCase())) throw new Error('Missing name evidence')
  const amount = amountFromEvidence(result.amountText, text)
  const target = amountFromEvidence(result.targetText, text)
  const description = clean(result.description)
  const date = String(result.dateText || '')
  if (date && (!original.includes(date.toLowerCase()) || !/^[\p{L}\p{N} /-]+$/u.test(date))) throw new Error('Invalid date')
  let command
  switch (result.intent) {
    case 'record_income': case 'record_expense':
      command = `catat ${result.intent === 'record_income' ? 'pemasukan' : 'pengeluaran'} ${description} ${amount} ${wallet ? `pakai ${wallet}` : ''} ${date}`; break
    case 'transfer_money':
      command = `transfer ${amount} ${source ? `dari ${source}` : ''} ${destination ? `ke ${destination}` : ''} ${date}`; break
    case 'create_wallet': command = `buat dompet ${name} ${amount ? `saldo awal ${amount}` : ''}`; break
    case 'create_saving_goal': command = `buat tabungan bernama ${name} ${target ? `target ${target}` : ''}`; break
    case 'deposit_goal': case 'withdraw_goal': {
      const goal = referenced(result.name, context.goals)
      command = result.intent === 'deposit_goal' ? `setor ${amount} ke tabungan ${goal} ${source ? `dari ${source}` : ''}` : `tarik ${amount} dari tabungan ${goal} ${destination ? `ke ${destination}` : ''}`
      break
    }
    case 'set_theme':
      if (!['dark', 'light', 'system'].includes(result.theme)) throw new Error('Invalid theme')
      return { intent: result.intent, theme: result.theme }
    case 'general_chat': case 'clarify':
      return { intent: result.intent, reply: result.reply?.trim() || 'Bisa jelaskan sedikit lagi maksudmu?' }
    default: {
      const queries = { query_balance: 'saldo saya berapa', query_income: 'berapa pemasukan', query_expenses: 'berapa pengeluaran', query_transactions: 'lihat transaksi', query_saving_goal: 'lihat tabungan', query_budget: 'lihat anggaran' }
      command = `${queries[result.intent]} ${wallet} ${result.intent === 'query_saving_goal' ? name : ''} ${date}`
    }
  }
  return { intent: result.intent, command: command.replace(/\s+/g, ' ').trim() }
}
