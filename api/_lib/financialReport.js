import {
  buildFinancialReport,
  reportPeriod,
  REPORT_LIMIT,
} from '../../src/lib/financialReport.js'

export async function readFinancialReport(sql, userId, month) {
  const { start, end } = reportPeriod(month)
  // One statement gives a consistent snapshot. Owner checks also apply to joins.
  const rows = await sql`
    select t.id, t.amount::text, t.transaction_type, t.analytics_bucket, t.source,
      t.merchant, t.notes, t.occurred_at, t.category_id, t.wallet_id, c.name as category_name,
      c.category_type, w.name as wallet_name
    from public.transactions t
    left join public.categories c on c.id = t.category_id and c.user_id = ${userId}::uuid
    left join public.wallets w on w.id = t.wallet_id and w.user_id = ${userId}::uuid
    where t.user_id = ${userId}::uuid
      and (${start}::timestamptz is null or t.occurred_at >= ${start}::timestamptz)
      and (${end}::timestamptz is null or t.occurred_at < ${end}::timestamptz)
    order by t.occurred_at, t.id limit ${REPORT_LIMIT + 1}`
  return buildFinancialReport(rows, month)
}
