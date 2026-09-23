import { describe, expect, it, vi } from 'vitest'
vi.mock('./assistantApiClient', () => ({ requestAssistantApi: vi.fn() }))
import { canUseLanguageAssistant, requestLanguageReply, requestLanguageInterpretation, detectThemeRequest, isSafeLanguageRewrite } from './languageAssistant'
import { orchestrateAssistantMessage } from './unifiedAssistantOrchestrator'

describe('optional language assistance', () => {
  it('sends names without financial records to the interpreter', async () => {
    const request = vi.fn().mockResolvedValue({ mode: 'gemini', interpretation: { intent: 'set_theme', theme: 'dark' } })
    expect(await requestLanguageInterpretation('aktifkan darkmode', { wallets: [{ name: 'BCA', current_balance: 777 }] }, request)).toEqual({ intent: 'set_theme', theme: 'dark' })
    expect(request.mock.calls[0][0].operation).toBe('interpret_v2')
    expect(request.mock.calls[0][0].body).toEqual({ text: 'aktifkan darkmode' })
    expect(await requestLanguageInterpretation('hi', {}, async () => { throw new Error('quota') })).toBeNull()
  })
  it('supports offline theme requests without changing negated preferences', () => {
    expect(detectThemeRequest('aktifkan darkmode dong mata saya sakit')).toBe('dark')
    expect(detectThemeRequest('jangan aktifkan darkmode')).toBeNull()
  })
  it('does not let a rewrite strip negation or change the classified action', () => {
    const candidate = orchestrateAssistantMessage({ text: 'catat gaji 5jt dari BCA', wallets: [{ id: 'bca', name: 'BCA' }] }).frame
    const original = orchestrateAssistantMessage({ text: 'jangan catat gaji 5jt' }).frame
    expect(isSafeLanguageRewrite(original, candidate, { intent: 'record_income' })).toBe(false)
    expect(isSafeLanguageRewrite(candidate, candidate, { intent: 'record_expense' })).toBe(false)
    expect(isSafeLanguageRewrite(candidate, candidate, { intent: 'record_income' })).toBe(true)
  })
  it('accepts the salary rewrite while preserving the missing-wallet question', () => {
    const original = orchestrateAssistantMessage({ text: 'aku baru mendapatkan gaji hari ini yaitu 2,860,097 tolong catat' }).frame
    const candidate = orchestrateAssistantMessage({ text: 'catat pemasukan Gaji Rp2860097,00 hari ini' }).frame
    expect(isSafeLanguageRewrite(original, candidate, { intent: 'record_income' })).toBe(true)
    expect(candidate.slots.description).toBe('Gaji')
  })
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
    expect(reply.text).not.toContain('tidak membaca atau mengubah')
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
