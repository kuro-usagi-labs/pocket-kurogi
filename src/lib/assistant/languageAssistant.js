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
      text: result.reply.trim(),
      metadata: { conversationStatus: 'general_chat', responseSource: 'gemini' },
    }
  } catch {
    return null
  }
}

export async function requestLanguageInterpretation(text, { wallets = [], goals = [] } = {}, request = requestAssistantApi) {
  try {
    const data = await request({ operation: 'interpret', body: { text, context: {
      wallets: wallets.map((item) => item.name), goals: goals.map((item) => item.name),
    } }, signal: AbortSignal.timeout(12000) })
    return data?.mode === 'gemini' ? data.interpretation : null
  } catch { return null }
}

export function detectThemeRequest(text) {
  if (/\b(?:jangan|tidak|bukan|nanti|kalau|apa itu)\b/iu.test(text)) return null
  if (!/\b(?:aktifkan|nyalakan|ganti|ubah|pindah|pakai|balik|matikan|nonaktifkan)\b/iu.test(text)) return null
  if (/\b(?:dark\s*mode|mode gelap|tema gelap)\b/iu.test(text)) return /\b(?:matikan|nonaktifkan)\b/iu.test(text) ? 'light' : 'dark'
  if (/\b(?:light\s*mode|mode terang|tema terang)\b/iu.test(text)) return 'light'
  if (/\b(?:tema|mode)\b.*\b(?:sistem|otomatis)\b/iu.test(text)) return 'system'
  return null
}

export function isSafeLanguageRewrite(original, candidate, interpretation) {
  if (!candidate || candidate.intent !== interpretation.intent) return false
  if (!candidate.action?.mutates) return true
  const flags = original.entities?.flags || {}
  return !Object.values(flags).some(Boolean) &&
    !original.safety?.errors?.some((error) => error.code !== 'AMBIGUOUS_INTENT') &&
    !candidate.safety?.blocksWrite
}
