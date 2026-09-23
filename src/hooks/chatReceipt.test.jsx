// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useChat } from './useChat'
const io = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' } }) }))
vi.mock('../lib/neonAttachments', () => ({ getChatAttachmentUrls: async () => new Map(), removeChatAttachments: vi.fn(), uploadChatAttachment: vi.fn() }))
vi.mock('../lib/chat/chatApiClient', () => ({ requestChatApi: io.request }))
afterEach(cleanup)
it('retains a confirmed receipt locally when chat saving fails and retries only message storage', async () => {
  io.request.mockImplementation(async ({ operation }) => {
    if (operation === 'list_messages') return { data: { messages: [], hasMore: false } }
    throw new Error('offline')
  })
  const { result } = renderHook(useChat)
  await waitFor(() => expect(result.current.loading).toBe(false))
  let saved
  await act(async () => { saved = await result.current.saveMessage('bot', 'Pemasukan tercatat', { metadata: { conversationStatus: 'completed', pendingActionResolved: 'action-a' } }) })
  expect(saved.retainedLocally).toBe(true)
  expect(result.current.messages[0].metadata.deliveryStatus).toBe('unsynced')
  const local = result.current.messages[0]
  io.request.mockImplementation(async ({ operation, body }) => ({ data: operation === 'save_message' ? { id: 'server-a', sender: body.sender, text: body.text, created_at: '2026-09-23T00:00:00Z' } : { messages: [], hasMore: false } }))
  await act(() => result.current.retryMessage(local))
  expect(result.current.messages).toHaveLength(1)
  expect(result.current.messages[0].id).toBe('server-a')
  expect(result.current.messages[0].metadata.deliveryStatus).toBeUndefined()
})
