import { transactionCursorFilter } from '../../src/lib/transactionCursor.js'

export async function readTransactionHistory(sql, userId, cursor = null) {
  if (cursor !== null) {
    try { transactionCursorFilter(cursor) } catch {
      const error = new Error('Cursor riwayat tidak valid.')
      error.statusCode = 400
      throw error
    }
  }
  // Identity comes exclusively from the verified JWT, never from request data.
  // Keep rows even when their wallet/category is archived or no longer present.
  const rows = await sql`
    select t.*, json_build_object('name', w.name) as wallets,
           json_build_object('name', c.name, 'icon', c.icon) as categories
    from public.transactions t
    left join public.wallets w on w.id = t.wallet_id and w.user_id = ${userId}::uuid
    left join public.categories c on c.id = t.category_id and c.user_id = ${userId}::uuid
    where t.user_id = ${userId}::uuid
      and (${cursor?.createdAt ?? null}::timestamptz is null
        or (t.created_at, t.id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid))
    order by t.created_at desc, t.id desc
    limit 30
  `
  return { transactions: rows }
}
