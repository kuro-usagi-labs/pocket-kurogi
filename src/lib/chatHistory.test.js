import { describe, expect, it } from 'vitest'
import { mergeChatMessages } from './chatHistory'

describe('mergeChatMessages', () => {
  it('keeps a locally saved message when an older database response arrives late', () => {
    const databaseSnapshot = [
      { id: 'older', createdAt: '2026-07-30T10:00:00.000Z', text: 'Pesan lama' },
    ]
    const currentUi = [
      ...databaseSnapshot,
      { id: 'newer', createdAt: '2026-07-30T10:01:00.000Z', text: 'Pesan baru' },
    ]

    expect(mergeChatMessages(currentUi, databaseSnapshot)).toEqual(currentUi)
  })

  it('deduplicates by id and keeps chronological order', () => {
    const result = mergeChatMessages(
      [{ id: 'b', createdAt: '2026-07-30T10:02:00.000Z', text: 'versi lama' }],
      [
        { id: 'a', createdAt: '2026-07-30T10:01:00.000Z', text: 'pertama' },
        { id: 'b', createdAt: '2026-07-30T10:02:00.000Z', text: 'versi database' },
      ],
    )

    expect(result).toEqual([
      { id: 'a', createdAt: '2026-07-30T10:01:00.000Z', text: 'pertama' },
      { id: 'b', createdAt: '2026-07-30T10:02:00.000Z', text: 'versi database' },
    ])
  })
})
