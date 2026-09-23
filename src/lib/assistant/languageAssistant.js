import { requestAssistantApi } from './assistantApiClient'

export function canUseLanguageAssistant({ frame, pendingAction, pendingMemoryProposal, imageFile }) {
  return !pendingAction && !pendingMemoryProposal && !imageFile &&
    ['unknown', 'general_chat'].includes(frame?.intent) &&
    !frame?.action?.mutates && !frame?.safety?.blocksWrite &&
    // Unknown language is expected here; every financial safety error still blocks.
    !(frame?.safety?.errors?.some((error) => error.code !== 'AMBIGUOUS_INTENT'))
}

export async function requestLanguageReply(text, request = requestAssistantApi) {
  try {
    const result = await request({
      operation: 'language',
      body: { text },
      signal: AbortSignal.timeout(10_000),
    })
    if (result?.mode !== 'gemini' || typeof result.reply !== 'string' || !result.reply.trim()) {
      return null
    }
    return {
      text: `${result.reply.trim()}\n\n_(Obrolan AI; tidak membaca atau mengubah data keuangan.)_`,
      metadata: { conversationStatus: 'general_chat', responseSource: 'gemini' },
    }
  } catch {
    return null
  }
}
