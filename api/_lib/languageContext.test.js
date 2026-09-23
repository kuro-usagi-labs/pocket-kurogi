import { it, expect } from 'vitest'
import { readOwnedLanguageContext } from './languageContext.js'
it('loads references for the authenticated owner and bounds text-only conversation', async () => {
  const calls = []
  const sql = async (parts, ...values) => {
    calls.push({ query: parts.join('?'), values })
    if (parts.join('').includes('wallets')) return [{ id: 'w', name: 'Tunai', current_balance: 99 }]
    if (parts.join('').includes('goals')) return []
    return Array.from({ length: 6 }, () => ({ sender: 'user', text: 'x'.repeat(2000), metadata: { imagePath: 'secret' } }))
  }
  const context = await readOwnedLanguageContext(sql, 'owner')
  expect(context.wallets[0].id).toBe('w')
  expect(context.conversation.reduce((n, x) => n + x.text.length, 0)).toBeLessThanOrEqual(4000)
  expect(JSON.stringify(context.conversation)).not.toContain('secret')
  expect(calls.every(call => call.values.includes('owner') && call.query.includes('user_id ='))).toBe(true)
})
