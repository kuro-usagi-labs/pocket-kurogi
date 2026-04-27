import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const CHAT_BUCKET = 'chat-attachments'
const PAGE_SIZE = 40

function generateAttachmentToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return Math.random().toString(36).slice(2, 12)
}

export function useChat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const oldestCursorRef = useRef(null)

  const removeAttachment = useCallback(async (path) => {
    if (!path) {
      return
    }

    await supabase.storage.from(CHAT_BUCKET).remove([path])
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
      const { data } = await supabase.storage
        .from(CHAT_BUCKET)
        .createSignedUrls(imagePaths, 60 * 60)

      signedMap = new Map(
        (data || [])
          .filter((entry) => entry?.path && entry?.signedUrl)
          .map((entry) => [entry.path, entry.signedUrl])
      )
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

    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    if (loadMore && oldestCursorRef.current) {
      query = query.lt('created_at', oldestCursorRef.current)
    }

    const { data, error } = await query

    if (!error && data) {
      const hydrated = await hydrateMessages(data)
      const ordered = [...hydrated].reverse()
      oldestCursorRef.current = data[data.length - 1]?.created_at || null
      setHasMore(data.length === PAGE_SIZE)

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

    const extension = file.name?.includes('.') ? file.name.split('.').pop() : 'jpg'
    const objectName = `${Date.now()}-${generateAttachmentToken()}.${extension}`
    const objectPath = `${user.id}/${objectName}`

    const { error: uploadError } = await supabase.storage
      .from(CHAT_BUCKET)
      .upload(objectPath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      return { path: null, signedUrl: null, error: uploadError }
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(CHAT_BUCKET)
      .createSignedUrl(objectPath, 60 * 60)

    if (signedError) {
      await removeAttachment(objectPath)
    }

    return {
      path: objectPath,
      signedUrl: signedData?.signedUrl || null,
      error: signedError,
    }
  }, [removeAttachment, user])

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

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        sender,
        text,
        metadata,
      })
      .select()
      .single()

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
      return { data: formatted, error: null }
    }

    if (uploadedImagePath) {
      await removeAttachment(uploadedImagePath)
    }

    return { error }
  }, [removeAttachment, uploadAttachment, user])

  const clearMessages = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    const { data: storedMessages, error: fetchError } = await supabase
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
      const { error: storageError } = await supabase.storage
        .from(CHAT_BUCKET)
        .remove([...new Set(attachments)])

      if (storageError) {
        return { error: storageError }
      }
    }

    const { error } = await supabase
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
    hasMore,
    loadingMore,
    saveMessage,
    clearMessages,
    loadMore: () => fetchMessages({ loadMore: true }),
    refetch: fetchMessages,
  }
}
