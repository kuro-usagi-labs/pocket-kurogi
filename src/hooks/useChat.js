import { useState, useEffect, useCallback, useRef } from 'react'
import { neon } from '../lib/neon'
import {
  getChatAttachmentUrls,
  removeChatAttachments,
  uploadChatAttachment,
} from '../lib/neonAttachments'
import { useAuth } from '../contexts/AuthContext'

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
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(null)
  const oldestCursorRef = useRef(null)

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
    if (!user) {
      setMessages([])
      setLoading(false)
      setLoadingMore(false)
      setHasMore(false)
      setError(null)
      oldestCursorRef.current = null
      return
    }

    if (loadMore) {
      if (!oldestCursorRef.current) return
      setLoadingMore(true)
    } else {
      setLoading(true)
      oldestCursorRef.current = null
    }

    const executeFetch = () => {
      let query = neon
        .from('chat_messages')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      if (loadMore && oldestCursorRef.current) {
        query = query.lt('created_at', oldestCursorRef.current)
      }

      return query
    }

    const { data, error: fetchError } = await runWithChatAuthRetry(executeFetch)

    if (!fetchError && data) {
      const hydrated = await hydrateMessages(data)
      const ordered = [...hydrated].reverse()
      oldestCursorRef.current = data[data.length - 1]?.created_at || null
      setHasMore(data.length === PAGE_SIZE)
      setError(null)

      if (loadMore) {
        setMessages((prev) => {
          const merged = [...ordered, ...prev]
          return merged.filter(
            (message, index, all) => all.findIndex((candidate) => candidate.id === message.id) === index
          )
        })
      } else {
        setMessages(ordered)
      }
    } else if (!loadMore) {
      setMessages([])
      setHasMore(false)
      setError(fetchError || new Error('Riwayat chat belum dapat dimuat.'))
    }

    if (loadMore) {
      setLoadingMore(false)
    } else {
      setLoading(false)
    }
  }, [hydrateMessages, user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchMessages().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchMessages])

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
      setMessages((prev) => [...prev, formatted])
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
