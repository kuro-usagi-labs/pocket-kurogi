export function transactionCursor(row) {
  return row ? { createdAt: row.created_at, id: row.id } : null
}

export function transactionCursorFilter(cursor) {
  if (!/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/u.test(cursor?.createdAt || '') ||
      !Number.isFinite(Date.parse(cursor.createdAt)) || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(cursor?.id || '')) {
    throw new Error('Cursor riwayat tidak valid.')
  }
  return `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`
}
