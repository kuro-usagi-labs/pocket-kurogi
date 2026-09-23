export async function readOwnedLanguageContext(sql, userId) {
  const [wallets, goals, messages] = await Promise.all([
    sql`select id, name, current_balance from public.wallets where user_id = ${userId}::uuid and not is_archived order by created_at limit 60`,
    sql`select id, name from public.goals where user_id = ${userId}::uuid order by created_at limit 60`,
    sql`select sender, left(text, 2000) as text from public.chat_messages where user_id = ${userId}::uuid order by created_at desc, id desc limit 6`,
  ])
  let remaining = 4000
  const conversation = messages.slice(0, 6).map(message => {
    const text = String(message.text || '').replace(/(?:https?:\/\/\S+|\b(?:AIza|AQ\.)\S+|\bBearer\s+\S+)/giu, '[redacted]').slice(0, remaining)
    remaining -= text.length
    return { sender: message.sender === 'user' ? 'user' : 'assistant', text }
  }).filter(message => message.text).reverse()
  return { wallets, goals, conversation }
}
