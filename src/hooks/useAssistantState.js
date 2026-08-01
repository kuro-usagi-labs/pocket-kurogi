import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestAssistantApi } from '../lib/assistant/assistantApiClient'

export function useAssistantState() {
  const { user } = useAuth()
  const userId = user?.id || null
  const [dialogueState, setDialogueState] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const activeUserIdRef = useRef(userId)
  const requestSequenceRef = useRef(0)
  const activeRequestRef = useRef(null)
  const dialogueStateRef = useRef(null)
  const pendingActionRef = useRef(null)
  const memoriesRef = useRef([])

  activeUserIdRef.current = userId

  const fetchAssistantState = useCallback(async () => {
    const currentUserId = userId
    if (!currentUserId) {
      requestSequenceRef.current += 1
      activeRequestRef.current = null
      dialogueStateRef.current = null
      pendingActionRef.current = null
      memoriesRef.current = []
      setDialogueState(null)
      setPendingAction(null)
      setMemories([])
      setError(null)
      setLoading(false)
      return { data: null, error: null }
    }

    const requestId = ++requestSequenceRef.current
    setLoading(true)
    const request = requestAssistantApi({
      operation: 'get_state',
      method: 'GET',
    })
    activeRequestRef.current = { userId: currentUserId, requestId, request }

    try {
      const data = await request
      const isCurrent = (
        activeUserIdRef.current === currentUserId &&
        requestSequenceRef.current === requestId
      )
      if (!isCurrent) return { data: null, error: null, stale: true }

      const nextDialogueState = data?.dialogueState?.state || null
      const nextPendingAction = mapPendingAction(data?.pendingAction || null)
      const nextMemories = Array.isArray(data?.memories)
        ? data.memories.map(mapMemory)
        : []
      dialogueStateRef.current = nextDialogueState
      pendingActionRef.current = nextPendingAction
      memoriesRef.current = nextMemories
      setDialogueState(nextDialogueState)
      setPendingAction(nextPendingAction)
      setMemories(nextMemories)
      setError(null)
      return { data, error: null }
    } catch (caughtError) {
      if (
        activeUserIdRef.current === currentUserId &&
        requestSequenceRef.current === requestId
      ) {
        setError(caughtError)
      }
      return { data: null, error: caughtError }
    } finally {
      if (
        activeUserIdRef.current === currentUserId &&
        requestSequenceRef.current === requestId
      ) {
        setLoading(false)
      }
    }
  }, [userId])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAssistantState().catch(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [fetchAssistantState])

  const ensureReady = useCallback(async () => {
    if (!userId) {
      return { data: null, error: new Error('Sesi pengguna tidak tersedia.') }
    }

    const activeRequest = activeRequestRef.current
    if (
      loading &&
      activeRequest?.userId === userId &&
      activeRequest?.request
    ) {
      return activeRequest.request
        .then((data) => ({ data, error: null }))
        .catch((caughtError) => ({ data: null, error: caughtError }))
    }

    if (loading) return fetchAssistantState()
    if (error) return fetchAssistantState()
    return {
      data: {
        dialogueState: dialogueStateRef.current,
        pendingAction: pendingActionRef.current,
        memories: memoriesRef.current,
      },
      error: null,
    }
  }, [error, fetchAssistantState, loading, userId])

  const saveDialogueState = useCallback(async (nextState) => {
    if (!user || !nextState?.expiresAt) {
      return { data: null, error: new Error('Dialogue state belum valid.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'save_dialogue',
        body: {
          state: nextState,
        },
      })
      const savedState = data?.state || nextState
      dialogueStateRef.current = savedState
      setDialogueState(savedState)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

  const stagePendingAction = useCallback(async (action) => {
    if (!user || !action) {
      return { data: null, error: new Error('Pending action belum valid.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'stage_action',
        body: {
          idempotencyKey: action.idempotencyKey,
          actionType: action.actionType,
          payload: action.payload,
        },
      })
      const mapped = mapPendingAction({
        ...data,
        user_id: user.id,
      })
      pendingActionRef.current = mapped
      setPendingAction(mapped)
      return { data: mapped, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

  const confirmPendingAction = useCallback(async (action = pendingAction) => {
    if (!user || !action?.id) {
      return { data: null, error: new Error('Tidak ada pending action untuk dikonfirmasi.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'confirm_action',
        body: {
          actionId: action.id,
          payloadHash: action.payloadHash,
        },
      })
      pendingActionRef.current = null
      dialogueStateRef.current = null
      setPendingAction(null)
      setDialogueState(null)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [pendingAction, user])

  const cancelPendingAction = useCallback(async (action = pendingAction) => {
    if (!user || !action?.id) {
      return { data: null, error: new Error('Tidak ada pending action untuk dibatalkan.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'cancel_action',
        body: {
          actionId: action.id,
        },
      })
      pendingActionRef.current = null
      dialogueStateRef.current = null
      setPendingAction(null)
      setDialogueState(null)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [pendingAction, user])

  const supersedePendingActions = useCallback(async () => {
    if (!user) {
      return { data: null, error: new Error('Sesi pengguna tidak tersedia.') }
    }

    try {
      const data = await requestAssistantApi({ operation: 'supersede_actions', body: {} })
      pendingActionRef.current = null
      dialogueStateRef.current = null
      setPendingAction(null)
      setDialogueState(null)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

  const correctPendingAction = useCallback(async ({
    action = pendingAction,
    payload,
  } = {}) => {
    if (!user || !action?.id || !payload) {
      return { data: null, error: new Error('Koreksi pending action belum valid.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'correct_action',
        body: {
          actionId: action.id,
          payloadHash: action.payloadHash,
          payload,
        },
      })
      const mapped = mapPendingAction({
        ...data,
        user_id: user.id,
      })
      pendingActionRef.current = mapped
      setPendingAction(mapped)
      return { data: mapped, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [pendingAction, user])

  const rememberPreference = useCallback(async (entry) => {
    if (!user || !entry) {
      return { data: null, error: new Error('Memory belum valid.') }
    }
    try {
      const data = await requestAssistantApi({
        operation: 'remember',
        body: {
          key: entry.key,
          value: entry.value,
          confidence: entry.confidence,
          source: entry.source,
        },
      })
      const mapped = mapMemory({
        ...data,
        user_id: user.id,
      })
      memoriesRef.current = [
        mapped,
        ...memoriesRef.current.filter((memory) => memory.key !== mapped.key),
      ]
      setMemories((current) => [
        mapped,
        ...current.filter((memory) => memory.key !== mapped.key),
      ])
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

  const getSnapshot = useCallback(() => ({
    dialogueState: dialogueStateRef.current,
    pendingAction: pendingActionRef.current,
    memories: memoriesRef.current,
  }), [])

  const fetchFinancialContext = useCallback(async () => {
    if (!user) {
      return { data: null, error: new Error('Sesi pengguna tidak tersedia.') }
    }
    try {
      const data = await requestAssistantApi({
        operation: 'financial_context',
        body: {},
      })
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

  return {
    userId: user?.id || null,
    dialogueState,
    pendingAction,
    memories,
    loading,
    error,
    ensureReady,
    saveDialogueState,
    stagePendingAction,
    confirmPendingAction,
    cancelPendingAction,
    supersedePendingActions,
    correctPendingAction,
    rememberPreference,
    fetchFinancialContext,
    getSnapshot,
    refetch: fetchAssistantState,
  }
}

function mapPendingAction(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    actionType: row.action_type,
    payload: row.payload,
    payloadHash: row.payload_hash,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    result: row.result || null,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  }
}

function mapMemory(row) {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.memory_key,
    value: row.memory_value,
    confidence: Number(row.confidence || 0),
    source: row.source,
    lastUsedAt: row.last_used_at || null,
    updatedAt: row.updated_at,
  }
}
