import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import MessageBubble from './MessageBubble'

describe('MessageBubble confirmation flow', () => {
  it('renders only the pending-action controls when a card owns confirmation', () => {
    const markup = renderToStaticMarkup(
      <MessageBubble
        msg={{
          sender: 'bot',
          text: 'Pemasukan Rp72.000 ke Tunai dengan catatan "Sisa gaji".',
          time: '13.31',
          metadata: {
            intentStatus: 'needs_confirmation',
            confirmationMode: 'card',
          },
          card: {
            type: 'pending_action',
            id: 'pending-1',
            title: 'Konfirmasi pemasukan',
            amount: 72_000,
            sourceWallet: 'Tunai',
            actions: ['confirm', 'edit', 'cancel'],
          },
        }}
        formatRupiah={(value) => `Rp${Number(value).toLocaleString('id-ID')}`}
        onReply={vi.fn()}
        onCardAction={vi.fn()}
      />
    )

    expect(markup).not.toContain('Lengkapi jawaban yang diminta')
    expect(markup.match(/>Batal</gu)).toHaveLength(1)
    expect(markup).toContain('>Konfirmasi</button>')
    expect(markup).toContain('>Ubah</button>')
  })
})
