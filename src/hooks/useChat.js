import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function useChat() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(100)

    if (!error && data) {
      setMessages(data.map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        time: new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      })))
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const saveMessage = async (sender, text) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        user_id: user.id,
        sender,
        text
      })
      .select()
      .single()

    if (!error && data) {
      const formatted = {
        id: data.id,
        sender: data.sender,
        text: data.text,
        time: new Date(data.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      }
      setMessages(prev => [...prev, formatted])
      return { data: formatted, error: null }
    }
    return { error }
  }

  const clearMessages = async () => {
    if (!user) return
    const { error } = await supabase.from('chat_messages').delete().eq('user_id', user.id)
    if (!error) {
      setMessages([])
    }
    return { error }
  }

  return { messages, loading, saveMessage, clearMessages, refetch: fetchMessages }
}
