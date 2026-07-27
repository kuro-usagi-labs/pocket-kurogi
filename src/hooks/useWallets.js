import { useState, useEffect, useCallback } from 'react'
import { neon } from '../lib/neon'
import { useAuth } from '../contexts/AuthContext'
import { normalizeEntityName } from '../lib/chatEntities'

const LEGACY_WALLET_DELETE_ERRORS = [
  'wallet masih memiliki saldo dan tidak bisa dihapus permanen',
  'wallet dengan riwayat ledger tidak bisa dihapus permanen',
]

function isLegacyWalletDeleteBlocker(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return LEGACY_WALLET_DELETE_ERRORS.some((candidate) => message.includes(candidate))
}

function buildLegacyWalletDeleteError() {
  return new Error(
    'Server live masih memakai aturan hapus wallet lama. Terapkan migration Neon terbaru agar dompet bersaldo dan ber-riwayat bisa dihapus permanen.'
  )
}

export function useWallets() {
  const { user } = useAuth()
  const [wallets, setWallets] = useState([])
  const [archivedWallets, setArchivedWallets] = useState([])
  const [loading, setLoading] = useState(true)

  const sortWalletsByCreatedAt = useCallback(
    (items = []) => [...items].sort((left, right) => new Date(left.created_at) - new Date(right.created_at)),
    []
  )

  const partitionWallets = useCallback((items = []) => {
    const active = []
    const archived = []

    for (const wallet of items) {
      if (wallet?.is_archived) {
        archived.push(wallet)
      } else {
        active.push(wallet)
      }
    }

    return {
      active: sortWalletsByCreatedAt(active),
      archived: sortWalletsByCreatedAt(archived),
    }
  }, [sortWalletsByCreatedAt])

  const applyWalletBuckets = useCallback((items = []) => {
    const { active, archived } = partitionWallets(items)
    setWallets(active)
    setArchivedWallets(archived)
    return { active, archived }
  }, [partitionWallets])

  const queryWallets = useCallback(async () => {
    if (!user) {
      return { data: [], error: null }
    }

    return neon
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
  }, [user])

  const fetchWalletById = useCallback(async (id) => {
    const { data, error } = await neon
      .from('wallets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    return { data, error }
  }, [user])

  const addWallet = useCallback(async (name, initialBalance = 0, walletType = 'cash') => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedInitialBalance = Number(initialBalance || 0)
    const rpcResult = await neon.rpc('create_wallet_with_opening_balance', {
      p_name: name,
      p_initial_balance: normalizedInitialBalance,
      p_wallet_type: walletType,
      p_tone: null,
    })

    if (!rpcResult.error && rpcResult.data?.wallet_id) {
      const { data: insertedWallet, error: fetchError } = await fetchWalletById(rpcResult.data.wallet_id)

      if (fetchError || !insertedWallet) {
        const fallbackWallet = {
          id: rpcResult.data.wallet_id,
          user_id: user.id,
          name: rpcResult.data.wallet_name || name,
          wallet_type: rpcResult.data.wallet_type || walletType,
          initial_balance: Number(rpcResult.data.initial_balance ?? normalizedInitialBalance),
          current_balance: Number(rpcResult.data.current_balance ?? normalizedInitialBalance),
          tone: rpcResult.data.tone || '#0F172A',
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        setWallets((prev) => (
          prev.some((wallet) => wallet.id === fallbackWallet.id)
            ? prev
            : [...prev, fallbackWallet]
        ))
        setArchivedWallets((prev) => prev.filter((wallet) => wallet.id !== fallbackWallet.id))

        return { data: fallbackWallet, error: null, ledgerCreated: normalizedInitialBalance > 0 }
      }

      setWallets((prev) => (
        prev.some((wallet) => wallet.id === insertedWallet.id)
          ? prev
          : [...prev, insertedWallet]
      ))
      setArchivedWallets((prev) => prev.filter((wallet) => wallet.id !== insertedWallet.id))
      return { data: insertedWallet, error: null, ledgerCreated: normalizedInitialBalance > 0 }
    }

    return {
      data: null,
      error: rpcResult.error ?? new Error('Dompet tidak bisa dibuat saat ini.'),
      ledgerCreated: false,
    }
  }, [fetchWalletById, user])

  const fetchWallets = useCallback(async () => {
    if (!user) {
      setWallets([])
      setArchivedWallets([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      await neon.rpc('ensure_default_wallet')
    } catch {
      // Ignore bootstrap wallet failures here and continue with the main wallet query.
    }

    const { data, error } = await queryWallets()

    if (!error && data) {
      const { active } = applyWalletBuckets(data)
      if (active.length === 0) {
        const ensureResult = await neon.rpc('ensure_default_wallet')
        if (!ensureResult.error) {
          const { data: refreshedWallets, error: refreshError } = await queryWallets()

          if (!refreshError && refreshedWallets) {
            applyWalletBuckets(refreshedWallets)
          }
        }
      }
    }

    setLoading(false)
  }, [applyWalletBuckets, queryWallets, user])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchWallets().catch(() => null)
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [fetchWallets])

  const deleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const walletResult = await fetchWalletById(id)

    if (walletResult.error || !walletResult.data) {
      return { error: walletResult.error ?? new Error('Dompet tidak ditemukan.'), mode: null }
    }

    const hardDeleteResult = await neon.rpc('delete_wallet_permanently_safe', {
      p_wallet_id: id,
    })

    if (!hardDeleteResult.error) {
      setWallets((prev) => prev.filter((wallet) => wallet.id !== id))
      setArchivedWallets((prev) => prev.filter((wallet) => wallet.id !== id))
      fetchWallets().catch(() => null)
      return { error: null, mode: 'deleted' }
    }

    if (isLegacyWalletDeleteBlocker(hardDeleteResult.error)) {
      return { error: buildLegacyWalletDeleteError(), mode: 'migration_required' }
    }

    return { error: hardDeleteResult.error, mode: null }
  }, [fetchWalletById, fetchWallets, user])

  const hardDeleteWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const rpcResult = await neon.rpc('delete_wallet_permanently_safe', {
      p_wallet_id: id,
    })

    if (!rpcResult.error) {
      await fetchWallets()
      return { error: null }
    }

    if (isLegacyWalletDeleteBlocker(rpcResult.error)) {
      return { error: buildLegacyWalletDeleteError() }
    }

    return { error: rpcResult.error }
  }, [fetchWallets, user])

  const restoreWallet = useCallback(async (id) => {
    if (!user) return { error: 'Not authenticated' }

    const walletToRestore = archivedWallets.find((wallet) => wallet.id === id) || null
    const rpcResult = await neon.rpc('restore_wallet_safely', {
      p_wallet_id: id,
    })

    if (!rpcResult.error) {
      if (walletToRestore) {
        const restoredWallet = {
          ...walletToRestore,
          is_archived: false,
          updated_at: new Date().toISOString(),
        }

        setArchivedWallets((prev) => prev.filter((wallet) => wallet.id !== id))
        setWallets((prev) => {
          const nextWallets = prev.some((wallet) => wallet.id === id)
            ? prev.map((wallet) => (wallet.id === id ? { ...wallet, ...restoredWallet } : wallet))
            : [...prev, restoredWallet]

          return sortWalletsByCreatedAt(nextWallets)
        })
      }

      fetchWallets().catch(() => null)
      return {
        data: {
          wallet_id: id,
          wallet_name: rpcResult.data?.wallet_name || walletToRestore?.name || null,
        },
        error: null,
      }
    }

    return { data: null, error: rpcResult.error }
  }, [archivedWallets, fetchWallets, sortWalletsByCreatedAt, user])

  const clearAllWallets = useCallback(async () => {
    if (!user) return { error: 'Not authenticated' }

    return {
      error: new Error(
        'Dompet tidak bisa dihapus massal. Hapus satu per satu.'
      ),
    }
  }, [user])

  const updateBalance = useCallback(async (walletId, amount, type) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedAmount = Number(amount)
    const delta = type === 'income' ? normalizedAmount : -normalizedAmount

    const rpcResult = await neon.rpc('adjust_wallet_balance', {
      p_wallet_id: walletId,
      p_delta: delta,
    })

    if (!rpcResult.error) {
      const nextBalance = Number(rpcResult.data)
      setWallets((prev) =>
        prev.map((wallet) =>
          wallet.id === walletId ? { ...wallet, current_balance: nextBalance } : wallet
        )
      )
      return { error: null }
    }

    return { error: rpcResult.error ?? new Error('Saldo dompet tidak bisa diperbarui saat ini.') }
  }, [user])

  const renameWallet = useCallback(async (walletId, nextName) => {
    if (!user) return { error: 'Not authenticated' }

    const normalizedName = normalizeEntityName(nextName)
    if (!normalizedName) {
      return { error: new Error('Nama dompet wajib diisi.') }
    }

    const rpcResult = await neon.rpc('rename_wallet', {
      p_wallet_id: walletId,
      p_name: nextName,
    })

    if (!rpcResult.error) {
      const nextWalletName = rpcResult.data?.wallet_name || nextName.trim()

      setWallets((prev) =>
        prev.map((wallet) =>
          wallet.id === walletId ? { ...wallet, name: nextWalletName } : wallet
        )
      )
      setArchivedWallets((prev) =>
        prev.map((wallet) =>
          wallet.id === walletId ? { ...wallet, name: nextWalletName } : wallet
        )
      )

      fetchWallets().catch(() => null)
      return {
        data: {
          wallet_id: walletId,
          wallet_name: nextWalletName,
        },
        error: null,
      }
    }

    return { data: null, error: rpcResult.error }
  }, [fetchWallets, user])

  const totalBalance = wallets.reduce(
    (accumulator, wallet) => accumulator + Number(wallet.current_balance),
    0
  )

  return {
    wallets,
    archivedWallets,
    loading,
    totalBalance,
    addWallet,
    deleteWallet,
    hardDeleteWallet,
    restoreWallet,
    clearAllWallets,
    updateBalance,
    renameWallet,
    refetch: fetchWallets,
  }
}
