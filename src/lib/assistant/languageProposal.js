import { normalizeMoneyNumber } from '../moneyNumber.js'
import { getIntentDefinition } from './intentDefinitions.js'

export const LANGUAGE_INTENTS = Object.freeze(['record_income', 'record_expense', 'transfer_money',
  'create_wallet', 'create_saving_goal', 'deposit_goal', 'withdraw_goal', 'set_wallet_balance',
  'query_balance', 'query_income', 'query_expenses', 'query_transactions', 'query_saving_goal',
  'query_budget', 'set_theme', 'general_chat', 'clarify'])
export const LANGUAGE_FIELDS = ['amountText', 'description', 'wallet', 'sourceWallet', 'destinationWallet', 'name', 'targetText', 'dateText', 'reply', 'theme', 'category']

function evidenceAmount(evidence, text) {
  if (!evidence) return undefined
  const escaped = evidence.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`(?<![\\p{L}\\d.,-])${escaped}(?![\\p{L}\\d.,])`, 'iu').test(text)) throw new Error('Missing amount evidence')
  const match = evidence.trim().match(/^(?:rp\.?\s*)?(\d+(?:[.,]\d+)*)\s*(rb|ribu|k|jt|juta|miliar)?(?:\s*rupiah)?$/iu)
  const numeric = match && normalizeMoneyNumber(match[1])
  if (numeric == null) throw new Error('Invalid amount')
  const scale = { rb: 1000, ribu: 1000, k: 1000, jt: 1000000, juta: 1000000, miliar: 1000000000 }
  const value = Number(numeric) * (scale[match[2]?.toLowerCase()] || 1)
  if (!Number.isFinite(value) || value < 0 || value > 1e12 || Math.abs(value * 100 - Math.round(value * 100)) > 0.001) throw new Error('Invalid amount')
  return value
}

// This produces domain slots, never executable text, SQL, or function names.
// Context must come from the authenticated caller's database, not model IDs.
export function validateLanguageProposal({ proposal, text, context = {} }) {
  if (!proposal || !LANGUAGE_INTENTS.includes(proposal.intent) || (proposal.version != null && proposal.version !== 1)) throw new Error('Invalid proposal')
  for (const key of LANGUAGE_FIELDS) {
    if (proposal[key] != null && (typeof proposal[key] !== 'string' || proposal[key].length > (key === 'reply' ? 3000 : 140))) throw new Error('Invalid field')
  }
  const intent = proposal.intent
  const definition = getIntentDefinition(intent)
  if ((definition.mutates || intent === 'set_theme') && /\b(?:jangan|bukan|tidak|andaikan|seandainya|kalau|misalnya)\b/iu.test(text)) throw new Error('Unsafe action context')
  const quote = value => !value || text.toLowerCase().includes(value.toLowerCase())
  const reference = (name, list = []) => {
    if (!name) return undefined
    const matches = list.filter(item => !item.is_archived && item.name.toLowerCase() === name.toLowerCase())
    if (matches.length !== 1 || !quote(name)) throw new Error('Unknown or ambiguous reference')
    return matches[0]
  }
  const toSlot = item => item && ({ id: item.id, name: item.name })
  const wallet = reference(proposal.wallet, context.wallets)
  const source = reference(proposal.sourceWallet, context.wallets)
  const destination = reference(proposal.destinationWallet, context.wallets)
  const amount = evidenceAmount(proposal.amountText, text)
  const target = evidenceAmount(proposal.targetText, text)
  if (!quote(proposal.name) || !quote(proposal.dateText)) throw new Error('Missing name or date evidence')
  let slots = {}
  switch (intent) {
    case 'record_income': case 'record_expense': {
      const transactionType = intent === 'record_income' ? 'income' : 'expense'
      // Semantic category suggestions need not be literal words in the utterance,
      // but must resolve to a single owned, type-compatible category. Invalid
      // suggestions are discarded without losing the user's valid transaction.
      const matches = (context.categories || []).filter(item => item.name?.toLowerCase() === proposal.category?.toLowerCase() && ['both', transactionType].includes(item.category_type))
      slots = { amount, description: proposal.description || undefined, wallet: toSlot(wallet), transactionType,
        ...(matches.length === 1 ? { category: toSlot(matches[0]) } : {}) }; break
    }
    case 'set_wallet_balance':
      slots = { wallet: toSlot(wallet), expectedBalance: wallet ? Number(wallet.current_balance) : undefined, targetBalance: amount }; break
    case 'transfer_money':
      slots = { amount, sourceWallet: toSlot(source), destinationWallet: toSlot(destination) }; break
    case 'create_wallet':
      slots = { walletName: proposal.name || undefined, initialBalance: amount ?? 0, walletType: 'cash' }; break
    case 'create_saving_goal':
      slots = { description: proposal.name || undefined, amount: target ?? amount }; break
    case 'deposit_goal': case 'withdraw_goal':
      slots = { amount, goal: toSlot(reference(proposal.name, context.goals)), ...(intent === 'deposit_goal' ? { sourceWallet: toSlot(source || wallet) } : { destinationWallet: toSlot(destination || wallet) }) }; break
    case 'set_theme':
      if (!['dark', 'light', 'system'].includes(proposal.theme)) throw new Error('Invalid theme')
      break
    default:
      slots = { wallet: toSlot(wallet), ...(intent === 'query_saving_goal' ? { goal: toSlot(reference(proposal.name, context.goals)) } : {}) }
  }
  slots = Object.fromEntries(Object.entries(slots).filter(([, value]) => value !== undefined))
  if (slots.amount !== undefined && slots.amount <= 0) throw new Error('Invalid amount')
  if (source && destination && source.id === destination.id) throw new Error('Same transfer wallet')
  const missingFields = definition.required.filter(key => slots[key] === undefined || slots[key] === '')
  return { version: 1, intent, slots, missingFields, dateText: proposal.dateText || '', theme: proposal.theme || '', reply: proposal.reply?.trim() || '' }
}
