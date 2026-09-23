import { describe, expect, it, vi } from 'vitest'
import { getGeminiReply } from './geminiAssistant'

const env = { GEMINI_API_KEY: 'test-secret', GEMINI_MODEL: 'gemini-3.5-flash-lite' }
const success = (reply = 'Hai! Lagi pengin cerita apa?') => ({
  ok: true,
  json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: reply }] } }] }),
})
function setup(response = success()) {
  return { env, text: 'hi', sql: vi.fn().mockResolvedValue([{ scope: 'test' }]), fetchImpl: vi.fn().mockResolvedValue(response) }
}

describe('Gemini conversation gateway', () => {
  it('keeps credentials in headers and sends only the current text', async () => {
    const input = setup()
    expect(await getGeminiReply(input)).toEqual({ mode: 'gemini', reply: 'Hai! Lagi pengin cerita apa?' })
    const [url, options] = input.fetchImpl.mock.calls[0]
    expect(url).not.toContain(env.GEMINI_API_KEY)
    expect(options.headers['x-goog-api-key']).toBe(env.GEMINI_API_KEY)
    expect(JSON.parse(options.body).contents).toEqual([{ role: 'user', parts: [{ text: 'hi' }] }])
    expect(JSON.stringify(input.sql.mock.calls)).not.toContain(env.GEMINI_API_KEY)
  })
  it.each([undefined, '', '  ', {}, 'a'.repeat(2001)])('rejects invalid input before spending quota (%s)', async (text) => {
    const input = setup()
    expect((await getGeminiReply({ ...input, text })).mode).toBe('fallback')
    expect(input.sql).not.toHaveBeenCalled()
    expect(input.fetchImpl).not.toHaveBeenCalled()
  })
  it.each([{}, { ...env, GEMINI_ENABLED: 'false' }, { ...env, GEMINI_MODEL: '../bad' }])('handles disabled/misconfigured provider', async (config) => {
    const input = setup()
    expect((await getGeminiReply({ ...input, env: config })).mode).toBe('fallback')
    expect(input.fetchImpl).not.toHaveBeenCalled()
  })
  it('does not call Gemini while another worker holds the shared cooldown', async () => {
    const input = setup()
    input.sql.mockResolvedValue([])
    expect(await getGeminiReply(input)).toEqual({ mode: 'fallback', reason: 'cooldown' })
    expect(input.fetchImpl).not.toHaveBeenCalled()
  })
  it('fails closed when the cooldown table is missing', async () => {
    const input = setup()
    input.sql.mockRejectedValue(new Error('missing table'))
    expect((await getGeminiReply(input)).reason).toBe('cooldown_store_unavailable')
    expect(input.fetchImpl).not.toHaveBeenCalled()
  })
  it.each([[429, 86400000, 'quota'], [403, 86400000, 'configuration'], [404, 86400000, 'configuration'], [503, 60000, 'unavailable']])('cooldown for provider status %s', async (status, delay, reason) => {
    const input = setup({ ok: false, status })
    expect(await getGeminiReply(input)).toEqual({ mode: 'fallback', reason })
    expect(input.sql.mock.calls[1][1]).toBe(delay)
  })
  it('falls back on timeouts without leaking errors', async () => {
    const input = setup()
    input.fetchImpl.mockRejectedValue(new Error('secret upstream message'))
    expect(await getGeminiReply(input)).toEqual({ mode: 'fallback', reason: 'unavailable' })
  })
  it.each([
    { candidates: [] },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'incomplete' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal' }] } }] },
  ])('falls back on blocked, truncated, or empty provider outputs', async (payload) => {
    const input = setup({ ok: true, json: async () => payload })
    expect((await getGeminiReply(input)).reason).toBe('invalid_response')
  })
  it('still returns fallback if persisting cooldown fails after provider error', async () => {
    const input = setup({ ok: false, status: 429 })
    input.sql.mockResolvedValueOnce([{ scope: 'test' }]).mockRejectedValueOnce(new Error('database down'))
    expect((await getGeminiReply(input)).reason).toBe('quota')
  })
})
