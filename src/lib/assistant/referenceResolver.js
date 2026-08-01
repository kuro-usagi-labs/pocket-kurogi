import { normalizeIndonesianFinanceText } from '../indonesianFinanceLanguage'

const RECENT_REFERENCE_PATTERN =
  /\b(?:itu|tadi|yang tadi|transaksi tadi|catatan tadi)\b/iu
const OTHER_WALLET_CONTEXT_PATTERN =
  /\b(?:(?:dompet|wallet|rekening)(?:\s+yang)?|(?:pakai|gunakan|dari|ke|lewat|melalui)\s+(?:dompet\s+)?(?:yang\s+)?)satunya\b/iu
const USUAL_WALLET_CONTEXT_PATTERN =
  /\b(?:(?:dompet|wallet|rekening)(?:\s+yang)?|(?:pakai|gunakan|dari|ke|lewat|melalui)\s+(?:dompet\s+)?(?:yang\s+)?)biasa(?:nya)?\b/iu
const OTHER_WALLET_DIRECT_PATTERN =
  /^(?:dompet\s+)?(?:yang\s+)?satunya(?:\s+saja)?[.!]?$/iu
const USUAL_WALLET_DIRECT_PATTERN =
  /^(?:dompet\s+)?(?:yang\s+)?biasa(?:nya)?(?:\s+saja)?[.!]?$/iu

export function resolveConversationReferences({
  text = '',
  messages = [],
  wallets = [],
  memory = [],
  dialogueState = null,
  pendingAction = null,
} = {}) {
  const originalText = String(text || '').trim()
  let resolvedText = originalText
  const references = []
  const latestDraft = buildPendingActionDraft(pendingAction)
  const latestFrame = findLatestSemanticFrame(messages)
  const activeWallets = wallets.filter((wallet) => !wallet?.is_archived)
  const preferredWallet = resolvePreferredWallet(memory, activeWallets)
  const expectsWallet = conversationExpectsWallet({
    dialogueState,
    latestFrame,
  })
  const usualWalletPattern =
    USUAL_WALLET_CONTEXT_PATTERN.test(resolvedText)
      ? USUAL_WALLET_CONTEXT_PATTERN
      : expectsWallet && USUAL_WALLET_DIRECT_PATTERN.test(resolvedText)
        ? USUAL_WALLET_DIRECT_PATTERN
        : null
  const otherWalletPattern =
    OTHER_WALLET_CONTEXT_PATTERN.test(resolvedText)
      ? OTHER_WALLET_CONTEXT_PATTERN
      : expectsWallet && OTHER_WALLET_DIRECT_PATTERN.test(resolvedText)
        ? OTHER_WALLET_DIRECT_PATTERN
        : null

  if (usualWalletPattern && preferredWallet) {
    resolvedText = resolvedText.replace(
      usualWalletPattern,
      preferredWallet.name
    )
    references.push(createReference({
      expression: 'yang biasa',
      kind: 'wallet',
      target: {
        id: preferredWallet.id,
        name: preferredWallet.name,
      },
      source: 'explicit_memory',
      confidence: 0.96,
    }))
  }

  if (otherWalletPattern) {
    const lastWalletId =
      latestFrame?.slots?.wallet?.id ||
      latestFrame?.slots?.sourceWallet?.id ||
      latestDraft?.walletId ||
      latestDraft?.items?.find((item) => item.walletId)?.walletId ||
      dialogueState?.collectedSlots?.wallet?.id ||
      null
    const otherWallets = activeWallets.filter((wallet) => wallet.id !== lastWalletId)
    if (lastWalletId && otherWallets.length === 1) {
      resolvedText = resolvedText.replace(
        otherWalletPattern,
        otherWallets[0].name
      )
      references.push(createReference({
        expression: 'dompet satunya',
        kind: 'wallet',
        target: {
          id: otherWallets[0].id,
          name: otherWallets[0].name,
        },
        source: 'conversation_context',
        confidence: 0.9,
      }))
    }
  }

  if (RECENT_REFERENCE_PATTERN.test(originalText)) {
    const target = latestDraft
      ? {
          id: latestDraft.id || latestDraft.requestId || null,
          type: 'finance_draft',
        }
      : latestFrame
        ? {
            intent: latestFrame.intent,
            type: 'semantic_frame',
          }
        : dialogueState?.lastReferencedTransactionId
          ? {
              id: dialogueState.lastReferencedTransactionId,
              type: 'transaction',
            }
          : null
    references.push(createReference({
      expression: originalText.match(RECENT_REFERENCE_PATTERN)?.[0] || 'tadi',
      kind: 'recent_context',
      target,
      source: target ? 'conversation_context' : 'unresolved',
      confidence: target ? 0.88 : 0.25,
    }))
  }

  const itemReference = resolveDraftItemReference(originalText, latestDraft)
  if (itemReference) references.push(itemReference)

  return {
    originalText,
    resolvedText,
    changed: resolvedText !== originalText,
    references,
    latestDraft: latestDraft
      ? {
          id: latestDraft.id || latestDraft.requestId || null,
          status: latestDraft.status || null,
          itemCount: latestDraft.items?.length || 0,
        }
      : null,
  }
}

function buildPendingActionDraft(pendingAction) {
  if (!pendingAction?.id || !Array.isArray(pendingAction?.payload?.items)) {
    return null
  }
  return {
    id: pendingAction.id,
    requestId: pendingAction.idempotency_key || pendingAction.id,
    status: pendingAction.status || 'pending_confirmation',
    items: pendingAction.payload.items,
  }
}

function conversationExpectsWallet({ dialogueState, latestFrame }) {
  const missingSlots = [
    ...(dialogueState?.missingSlots || []),
    ...(latestFrame?.missingSlots || []),
  ]
  if (missingSlots.some((slot) =>
    ['wallet', 'sourceWallet', 'destinationWallet'].includes(slot)
  )) {
    return true
  }

  return ['wallet', 'sourceWallet', 'destinationWallet'].includes(
    dialogueState?.activeQuestion?.slot
  )
}

function resolveDraftItemReference(text, draft) {
  if (!draft?.items?.length) return null
  const normalizedText = normalizeIndonesianFinanceText(text)
  const correctionMatch = normalizedText.match(
    /\byang\s+([\p{L}\p{N}\s-]{2,30}?)\s+(?:tadi\s+)?(?:harusnya|seharusnya|ubah|ganti|jadi)\b/iu
  )
  if (!correctionMatch?.[1]) return null
  const requested = normalizeIndonesianFinanceText(correctionMatch[1])
  const candidates = draft.items.filter((item) => {
    const searchable = normalizeIndonesianFinanceText(
      [item.desc, item.description, item.category, item.merchant]
        .filter(Boolean)
        .join(' ')
    )
    return searchable.includes(requested) || requested.includes(searchable)
  })
  if (candidates.length !== 1) {
    return createReference({
      expression: correctionMatch[0],
      kind: 'draft_item',
      target: null,
      source: 'unresolved',
      confidence: 0.3,
    })
  }
  const item = candidates[0]
  return createReference({
    expression: correctionMatch[0],
    kind: 'draft_item',
    target: {
      id: item.clientItemId || null,
      description: item.desc || item.description || item.category || null,
    },
    source: 'conversation_context',
    confidence: 0.94,
  })
}

function findLatestSemanticFrame(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.metadata?.assistantUnderstanding) {
      return messages[index].metadata.assistantUnderstanding
    }
  }
  return null
}

function resolvePreferredWallet(memory, wallets) {
  const preference = memory
    .filter((entry) =>
      entry?.key === 'preferred_wallet' &&
      Number(entry.confidence || 0) >= 0.75
    )
    .sort((left, right) =>
      new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
    )[0]
  if (!preference) return null
  return wallets.find((wallet) =>
    wallet.id === preference.value ||
    String(wallet.name || '').toLocaleLowerCase('id-ID') ===
      String(preference.value || '').toLocaleLowerCase('id-ID')
  ) || null
}

function createReference({
  expression,
  kind,
  target,
  source,
  confidence,
}) {
  return {
    expression,
    kind,
    target,
    source,
    confidence,
    resolved: Boolean(target),
  }
}
