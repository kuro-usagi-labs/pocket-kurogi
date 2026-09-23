import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('./_lib/assistantServer.js', () => ({
  applyAssistantCors: vi.fn(),
  authenticateAssistantRequest: vi.fn(),
  getAssistantSql: vi.fn(),
  parseAssistantBody: vi.fn((req) => req.body),
  runAssistantDatabaseOperation: vi.fn(),
  sendAssistantError: vi.fn(),
  validateAssistantOperationRequest: vi.fn(),
}))
vi.mock('./_lib/geminiAssistant.js', () => ({ getGeminiReply: vi.fn() }))
import handler from './assistant'
import { authenticateAssistantRequest, runAssistantDatabaseOperation, sendAssistantError } from './_lib/assistantServer'
import { getGeminiReply } from './_lib/geminiAssistant'

describe('assistant language operation authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authenticateAssistantRequest.mockResolvedValue({ userId: 'owner' })
    getGeminiReply.mockResolvedValue({ mode: 'fallback', reason: 'cooldown' })
  })
  const response = () => ({ setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), end: vi.fn() })
  it('returns fallback successfully without dispatching financial operations', async () => {
    const res = response()
    await handler({ method: 'POST', body: { operation: 'language', text: 'hi' } }, res)
    expect(authenticateAssistantRequest).toHaveBeenCalledOnce()
    expect(getGeminiReply).toHaveBeenCalledOnce()
    expect(runAssistantDatabaseOperation).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith({ data: { mode: 'fallback', reason: 'cooldown' } })
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store')
  })
  it('never calls Google for an unauthenticated request', async () => {
    authenticateAssistantRequest.mockRejectedValueOnce(Object.assign(new Error('unauthorized'), { statusCode: 401 }))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await handler({ method: 'POST', body: { operation: 'language', text: 'hi' } }, response())
      expect(getGeminiReply).not.toHaveBeenCalled()
      expect(sendAssistantError).toHaveBeenCalledOnce()
    } finally { log.mockRestore() }
  })
  it('does not call Google on a GET or preflight', async () => {
    await handler({ method: 'GET', query: { operation: 'language' } }, response())
    await handler({ method: 'OPTIONS' }, response())
    expect(getGeminiReply).not.toHaveBeenCalled()
  })
})
