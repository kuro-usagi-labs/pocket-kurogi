import { afterEach, describe, expect, it } from 'vitest'
import {
  applyAssistantCors,
  parseAssistantBody,
  validateAssistantOperationRequest,
} from './assistantServer'

const originalNodeEnv = process.env.NODE_ENV
const originalOrigins = process.env.ASSISTANT_ALLOWED_ORIGINS

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv
  if (originalOrigins === undefined) {
    delete process.env.ASSISTANT_ALLOWED_ORIGINS
  } else {
    process.env.ASSISTANT_ALLOWED_ORIGINS = originalOrigins
  }
})

describe('assistant Vercel API safety', () => {
  it('allows only configured production origins', () => {
    process.env.NODE_ENV = 'production'
    process.env.ASSISTANT_ALLOWED_ORIGINS = 'https://pocket.kurousagi.web.id'
    const headers = new Map()
    const response = {
      setHeader: (key, value) => headers.set(key, value),
    }

    applyAssistantCors({
      headers: { origin: 'https://pocket.kurousagi.web.id' },
    }, response)
    expect(headers.get('Access-Control-Allow-Origin'))
      .toBe('https://pocket.kurousagi.web.id')

    expect(() => applyAssistantCors({
      headers: { origin: 'https://evil.example' },
    }, response)).toThrow(/tidak diizinkan/)
  })

  it('rejects oversized and non-object request bodies', () => {
    expect(() => parseAssistantBody({ body: [] })).toThrow(/JSON object/)
    expect(() => parseAssistantBody({
      body: { payload: 'x'.repeat(70_000) },
    })).toThrow(/terlalu besar/)
  })

  it('validates operation schemas before any database query', () => {
    expect(() => validateAssistantOperationRequest('confirm_action', {
      actionId: 'not-a-uuid',
      payloadHash: 'invalid',
    })).toThrow(/Action ID/)
    expect(() => validateAssistantOperationRequest('stage_action', {
      idempotencyKey: 'request-1',
      actionType: 'raw_sql',
      payload: {},
      expiresAt: new Date().toISOString(),
    })).toThrow(/tidak didukung/)
    expect(() => validateAssistantOperationRequest(
      'save_dialogue',
      {},
      'GET'
    )).toThrow(/harus memakai POST/)
    expect(() => validateAssistantOperationRequest('financial_context', {}, 'GET'))
      .not.toThrow()
  })
})
