import { describe, expect, it, vi } from 'vitest'
vi.mock('./assistantApiClient', () => ({ requestAssistantApi: vi.fn() }))
import { canUseLanguageAssistant, requestLanguageReply } from './languageAssistant'
import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'

describe('optional language assistance', () => {
  const frame = { intent: 'general_chat', action: { mutates: false }, safety: { errors: [] } }
  it('allows ordinary conversation', () => {
    expect(canUseLanguageAssistant({ frame })).toBe(true)
  })
  it.each(['hi', 'jelasin dana darurat pakai bahasa sederhana dong', 'lagi pengin ngobrol aja'])('routes free conversation through the real orchestrator: %s', (text) => {
    const { frame: actualFrame } = orchestrateAssistantMessage({ text })
    expect(canUseLanguageAssistant({ frame: actualFrame }), JSON.stringify(actualFrame)).toBe(true)
  })
  it.each([
    { pendingAction: {} }, { pendingMemoryProposal: {} }, { imageFile: {} },
    { frame: { ...frame, intent: 'query_balance' } },
    { frame: { ...frame, intent: 'emotional_support' } },
    { frame: { ...frame, action: { mutates: true } } },
    { frame: { ...frame, safety: { blocksWrite: true } } },
    { frame: { ...frame, safety: { errors: [{ code: 'NEGATED_ACTION' }] } } },
  ])('never replaces pending confirmations, financial results, or safety responses', (override) => {
    expect(canUseLanguageAssistant({ frame, ...override })).toBe(false)
  })
  it('labels generated replies and ignores any suggested executable actions', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'gemini', reply: 'Halo!', action: { type: 'delete' } })
    const reply = await requestLanguageReply('hi', request)
    expect(reply.text).toContain('Halo!')
    expect(reply.text).toContain('tidak membaca atau mengubah')
    expect(reply.action).toBeUndefined()
    expect(request.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal)
  })
  it.each([null, { mode: 'fallback', reason: 'quota' }, { mode: 'gemini', reply: '' }])('preserves local reply when no valid AI reply is available', async (result) => {
    expect(await requestLanguageReply('hi', async () => result)).toBeNull()
  })
  it('preserves local reply after network/authentication errors', async () => {
    expect(await requestLanguageReply('hi', async () => { throw new Error('offline') })).toBeNull()
  })
})
