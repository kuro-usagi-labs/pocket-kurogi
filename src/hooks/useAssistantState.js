import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { requestAssistantApi } from '../lib/assistant/assistantApiClient'

export function useAssistantState() {
  const { user } = useAuth()
  const [dialogueState, setDialogueState] = useState(null)
  const [pendingAction, setPendingAction] = useState(null)
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAssistantState = useCallback(async () => {
    if (!user) {
      setDialogueState(null)
      setPendingAction(null)
      setMemories([])
      setLoading(false)
      return
    }

    setLoading(true)
    const data = await requestAssistantApi({
      operation: 'get_state',
      method: 'GET',
    })
    setDialogueState(data?.dialogueState?.state || null)
    setPendingAction(mapPendingAction(data?.pendingAction || null))
    setMemories(
      Array.isArray(data?.memories)
        ? data.memories.map(mapMemory)
        : []
    )

    setLoading(false)
  }, [user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAssistantState().catch(() => setLoading(false))
    }, 0)
    return () => clearTimeout(timeoutId)
  }, [fetchAssistantState])

  const saveDialogueState = useCallback(async (nextState) => {
    if (!user || !nextState?.expiresAt) {
      return { data: null, error: new Error('Dialogue state belum valid.') }
    }

    try {
      const data = await requestAssistantApi({
        operation: 'save_dialogue',
        body: {
          state: nextState,
          expiresAt: nextState.expiresAt,
        },
      })
      setDialogueState(data?.state || nextState)
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
          expiresAt: action.expiresAt,
        },
      })
      const mapped = mapPendingAction({
        ...data,
        user_id: user.id,
      })
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
      setPendingAction(null)
      setDialogueState(null)
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [pendingAction, user])

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
      setMemories((current) => [
        mapped,
        ...current.filter((memory) => memory.key !== mapped.key),
      ])
      return { data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }, [user])

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
    saveDialogueState,
    stagePendingAction,
    confirmPendingAction,
    cancelPendingAction,
    correctPendingAction,
    rememberPreference,
    fetchFinancialContext,
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
