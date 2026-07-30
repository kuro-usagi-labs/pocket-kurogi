import { useState, useEffect, useCallback, useRef } from 'react'
import { neon } from '../lib/neon'
import {
  getChatAttachmentUrls,
  removeChatAttachments,
  uploadChatAttachment,
} from '../lib/neonAttachments'
import { useAuth } from '../contexts/AuthContext'
import { mergeChatMessages } from '../lib/chatHistory'

const CHAT_BUCKET = 'chat-attachments'
const PAGE_SIZE = 40
const CHAT_AUTH_RETRY_DELAY_MS = 180

function isRetryableChatAuthError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return (
    error?.code === '42501' ||
    message.includes('row-level security') ||
    message.includes('auth required')
  )
}

async function runWithChatAuthRetry(operation) {
  const firstResult = await operation()

  if (!firstResult?.error || !isRetryableChatAuthError(firstResult.error)) {
    return firstResult
  }

  await neon.auth.getSession().catch(() => null)
  await new Promise((resolve) => window.setTimeout(resolve, CHAT_AUTH_RETRY_DELAY_MS))
  return operation()
}

export function useChat() {
  const { user } = useAuth()
  const userId = user?.id || null
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const oldestCursorRef = useRef(null)
  const activeUserIdRef = useRef(userId)
  const requestSequenceRef = useRef(0)
  const latestRefreshRequestRef = useRef(0)
  const conversationVersionRef = useRef(0)
  const localMutationVersionRef = useRef(0)

  activeUserIdRef.current = userId

  const removeAttachment = useCallback(async (path) => {
    if (!path) {
      return
    }

    await removeChatAttachments([path])
  }, [])

  const hydrateMessages = useCallback(async (rows) => {
    const hydrated = rows.map((message) => {
      const metadata = message.metadata && typeof message.metadata === 'object' ? message.metadata : {}

      return {
        id: message.id,
        sender: message.sender,
        text: message.text,
        time: new Date(message.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAt: message.created_at,
        metadata,
        card: metadata.card || null,
        imagePath: metadata.imagePath || null,
        imageBucket: metadata.imageBucket || CHAT_BUCKET,
      }
    })

    const imagePaths = hydrated
      .filter((message) => message.imagePath)
      .map((message) => message.imagePath)

    let signedMap = new Map()

    if (imagePaths.length > 0) {
      signedMap = await getChatAttachmentUrls(imagePaths)
    }

    return hydrated.map((message) => ({
      id: message.id,
      sender: message.sender,
      text: message.text,
      time: message.time,
      createdAt: message.createdAt,
      card: message.card,
      image: message.imagePath ? signedMap.get(message.imagePath) || null : null,
      metadata: message.metadata,
    }))
  }, [])

  const fetchMessages = useCallback(async ({ loadMore = false } = {}) => {
    const currentUserId = userId

    if (!currentUserId) {
      conversationVersionRef.current += 1
      setMessages([])
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      setError(null)
      oldestCursorRef.current = null
      return { data: [], error: null }
    }

    const requestId = ++requestSequenceRef.current
    const conversationVersion = conversationVersionRef.current
    const mutationVersion = localMutationVersionRef.current

    if (loadMore) {
      if (!oldestCursorRef.current) return { data: [], error: null }
      setLoadingMore(true)
    } else {
      setLoading(true)
      oldestCursorRef.current = null
      latestRefreshRequestRef.current = requestId
    }

    const executeFetch = () => {
      let query = neon
        .from('chat_messages')
        .select('*')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE)

      if (loadMore && oldestCursorRef.current) {
        const cursor = oldestCursorRef.current
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
        )
      }

      return query
    }

    try {
      const { data, error: fetchError } = await runWithChatAuthRetry(executeFetch)
      const isCurrentConversation = () => (
        activeUserIdRef.current === currentUserId &&
        conversationVersionRef.current === conversationVersion &&
        (loadMore || latestRefreshRequestRef.current === requestId)
      )

      if (!isCurrentConversation()) {
        return { data: null, error: null, stale: true }
      }

      if (fetchError || !data) {
        // Keep the last known messages visible. A transient auth refresh must
        // never replace a conversation with the welcome screen.
        if (!loadMore) setError(fetchError || new Error('Riwayat chat belum dapat dimuat.'))
        return { data: null, error: fetchError || new Error('Riwayat chat belum dapat dimuat.') }
      }

      const hydrated = await hydrateMessages(data)
      if (!isCurrentConversation()) {
        return { data: null, error: null, stale: true }
      }

      const ordered = [...hydrated].reverse()
      if (loadMore) {
        oldestCursorRef.current = data[data.length - 1]
          ? { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id }
          : oldestCursorRef.current
      } else {
        oldestCursorRef.current = data[data.length - 1]
          ? { createdAt: data[data.length - 1].created_at, id: data[data.length - 1].id }
          : null
      }
      setHasMore(data.length === PAGE_SIZE)
      setError(null)

      setMessages((previous) => {
        if (loadMore || localMutationVersionRef.current !== mutationVersion) {
          return mergeChatMessages(previous, ordered)
        }
        return ordered
      })

      return { data: ordered, error: null }
    } catch (caughtError) {
      if (
        activeUserIdRef.current === currentUserId &&
        conversationVersionRef.current === conversationVersion &&
        (loadMore || latestRefreshRequestRef.current === requestId) &&
        !loadMore
      ) {
        setError(caughtError)
      }
      return { data: null, error: caughtError }
    } finally {
      if (
        activeUserIdRef.current === currentUserId &&
        conversationVersionRef.current === conversationVersion &&
        (loadMore || latestRefreshRequestRef.current === requestId)
      ) {
        if (loadMore) setLoadingMore(false)
        else setLoading(false)
      }
    }
  }, [hydrateMessages, userId])

  useEffect(() => {
    conversationVersionRef.current += 1
    oldestCursorRef.current = null
    localMutationVersionRef.current += 1
    setMessages([])
    setHasMore(false)
    setError(null)

    const timeoutId = setTimeout(() => {
      fetchMessages().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchMessages, userId])

  const uploadAttachment = useCallback(async (file) => {
    if (!user || !file) {
      return { path: null, signedUrl: null, error: null }
    }

    const uploadResult = await uploadChatAttachment(user.id, file)
    return {
      path: uploadResult.path,
      signedUrl: uploadResult.url,
      error: uploadResult.error,
    }
  }, [user])

  const saveMessage = useCallback(async (sender, text, extras = {}) => {
    if (!user) return { error: 'Not authenticated' }

    let imagePath = extras.imagePath || null
    let imageUrl = extras.image || null
    let uploadedImagePath = null

    if (extras.imageFile && !imagePath) {
      const uploadResult = await uploadAttachment(extras.imageFile)
      if (uploadResult.error) {
        return { error: uploadResult.error }
      }

      imagePath = uploadResult.path
      imageUrl = uploadResult.signedUrl || extras.imagePreview || null
      uploadedImagePath = uploadResult.path
    }

    const metadata = {
      ...((extras.metadata && typeof extras.metadata === 'object') ? extras.metadata : {}),
      ...(extras.card ? { card: extras.card } : {}),
      ...(imagePath ? { imagePath, imageBucket: CHAT_BUCKET } : {}),
      ...(extras.intentStatus ? { intentStatus: extras.intentStatus } : {}),
    }

    const { data, error } = await runWithChatAuthRetry(() =>
      neon
        .from('chat_messages')
        .insert({
          user_id: user.id,
          sender,
          text,
          metadata,
        })
        .select()
        .single()
    )

    if (!error && data) {
      const formatted = {
        id: data.id,
        sender: data.sender,
        text: data.text,
        time: new Date(data.created_at).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        createdAt: data.created_at,
        card: metadata.card || null,
        image: imageUrl,
        metadata,
      }
      localMutationVersionRef.current += 1
      setMessages((prev) => mergeChatMessages(prev, [formatted]))
      setError(null)
      return { data: formatted, error: null }
    }

    if (uploadedImagePath) {
      await removeAttachment(uploadedImagePath)
    }

    return { error }
  }, [removeAttachment, uploadAttachment, user])

  const clearMessages = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    const { data: storedMessages, error: fetchError } = await neon
      .from('chat_messages')
      .select('metadata')
      .eq('user_id', user.id)

    if (fetchError) {
      return { error: fetchError }
    }

    const attachments = (storedMessages || [])
      .map((message) => {
        const metadata = message?.metadata && typeof message.metadata === 'object'
          ? message.metadata
          : {}

        return metadata.imagePath || null
      })
      .filter(Boolean)

    if (attachments.length > 0) {
      const { error: storageError } = await removeChatAttachments(
        [...new Set(attachments)],
      )

      if (storageError) {
        return { error: storageError }
      }
    }

    const { error } = await neon
      .from('chat_messages')
      .delete()
      .eq('user_id', user.id)

    if (!error) {
      conversationVersionRef.current += 1
      localMutationVersionRef.current += 1
      setMessages([])
      setHasMore(false)
      oldestCursorRef.current = null
    }

    return { error }
  }, [user])

  return {
    messages,
    loading,
    error,
    hasMore,
    loadingMore,
    saveMessage,
    clearMessages,
    loadMore: () => fetchMessages({ loadMore: true }),
    refetch: fetchMessages,
  }
}
