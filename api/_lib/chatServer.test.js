import { describe, expect, it } from 'vitest'
import {
  getChatRequestMeta,
  runChatDatabaseOperation,
  sendChatError,
  validateChatRequest,
} from './chatServer'

describe('chat API safety and lifecycle', () => {
  it('accepts a stable cursor and rejects malformed write input', () => {
    expect(() => validateChatRequest('list_messages', {
      cursorCreatedAt: '2026-07-30T12:00:00.000Z',
      cursorId: '11111111-1111-4111-8111-111111111111',
    }, 'GET')).not.toThrow()
    expect(() => validateChatRequest('list_messages', { cursorId: 'missing-time' }, 'GET'))
      .toThrow(/Cursor/)
    expect(() => validateChatRequest('save_message', { sender: 'system', text: 'Halo' }))
      .toThrow(/Pengirim/)
    expect(() => validateChatRequest('save_message', { sender: 'user', text: ' ' }))
      .toThrow(/Isi pesan/)
  })

  it('records request correlation without trusting malformed headers', () => {
    const meta = getChatRequestMeta({ headers: {
      'x-request-id': 'invalid',
      'x-chat-session-generation': '5',
      'x-chat-retry-attempt': '-1',
    } })
    expect(meta.requestId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(meta.sessionGeneration).toBe(5)
    expect(meta.retryAttempt).toBe(0)
  })

  it('writes a message and its immutable event in one database operation', async () => {
    const queries = []
    const sql = (strings, ...values) => ({ text: strings.join('?'), values })
    sql.transaction = async (nextQueries) => {
      queries.push(...nextQueries)
      return [[{ set_config: 'ok' }], [{
        id: '22222222-2222-4222-8222-222222222222',
        sender: 'user', text: 'Catat makan', metadata: {}, created_at: '2026-07-30T12:00:00.000Z',
      }]]
    }
    const result = await runChatDatabaseOperation({
      sql,
      userId: '11111111-1111-4111-8111-111111111111',
      operation: 'save_message',
      body: { sender: 'user', text: 'Catat makan', metadata: {} },
      requestId: '33333333-3333-4333-8333-333333333333',
    })
    expect(result.text).toBe('Catat makan')
    expect(queries[1].text).toContain('chat_conversation_events')
    expect(queries[1].values).toContain('33333333-3333-4333-8333-333333333333')
  })

  it('returns a calm, structured unavailable error', () => {
    const response = {
      statusCode: null,
      payload: null,
      status(code) { this.statusCode = code; return this },
      json(payload) { this.payload = payload },
    }
    sendChatError(response, new Error('connection refused'), '33333333-3333-4333-8333-333333333333')
    expect(response.statusCode).toBe(500)
    expect(response.payload.error.code).toBe('CHAT_UNAVAILABLE')
    expect(response.payload.meta.requestId).toBe('33333333-3333-4333-8333-333333333333')
  })
})
