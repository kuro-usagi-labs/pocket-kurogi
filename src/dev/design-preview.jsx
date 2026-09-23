// Isolated visual-review entry, excluded from the production index.html build.
// Fixtures never call authentication, Gemini or database APIs.
/* eslint-disable react-refresh/only-export-components -- standalone development entry point */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource-variable/space-grotesk'
import '../index.css'
import '../redesign.css'
import { ThemeProvider } from '../contexts/ThemeContext'
import ThemeToggle from '../components/shared/ThemeToggle'
import KurogiLogo from '../components/shared/KurogiLogo'
import ChatView from '../components/Chat/ChatView'
import WalletsView from '../components/Wallets/WalletsView'
import AnalyticsView from '../components/Analytics/AnalyticsView'
import DesktopRightPanel from '../components/Layout/DesktopRightPanel'
import WalletAdjustmentHistory from '../components/Wallets/WalletAdjustmentHistory'
import { formatMoney as rupiah } from '../lib/formatMoney'

const initialWallets = [{ id: 'demo', name: 'Tunai', wallet_type: 'cash', balance: 8450000, current_balance: 8450000 }]
const goals = [{ id: 'demo-goal', name: 'Liburan impian', current_amount: 3400000, target_amount: 5000000, status: 'active' }]
function DesignReview() {
  const [tab, setTab] = useState('chat')
  const [wallets, setWallets] = useState(initialWallets)
  const [isTyping, setIsTyping] = useState(false)
  const [reportStatus, setReportStatus] = useState(() => new URLSearchParams(location.search).has('reportError') ? 'error' : 'success')
  const [messages, setMessages] = useState([
    { id: '1', sender: 'user', text: 'Aku baru mendapatkan gaji 2,860,097, tolong catat di BCA', time: '13.21' },
    { id: '2', sender: 'bot', text: 'Pemasukan Rp2.860.097 ke BCA dengan catatan “Gaji”.', time: '13.21', card: { id: 'old-confirmation', type: 'pending_action', title: 'Konfirmasi pemasukan', amount: 2860097, sourceWallet: 'BCA' } },
    { id: '3', sender: 'user', text: 'Iya catat', time: '13.21' },
    { id: '4', sender: 'bot', text: 'Pemasukan Rp2.860.097 berhasil dicatat.', time: '13.21', card: { type: 'income', category: 'Gaji', wallet: 'BCA', amount: 2860097 } },
  ])
  const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.current_balance, 0)
  const sendDemo = async (message) => {
    const text = typeof message === 'string' ? message : message.text
    if (text === 'uji gagal kirim') return false
    const id = crypto.randomUUID()
    setMessages(previous => [...previous, { id, sender: 'user', text }])
    setIsTyping(true)
    await new Promise(resolve => setTimeout(resolve, 1800))
    setMessages(previous => [...previous, { id: `${id}-reply`, sender: 'bot', text: `Pesan contoh diterima: “${text}”. Ini balasan demo; tidak ada data yang dikirim ke server.` }])
    setIsTyping(false)
    return { success: true }
  }
  const setDemoBalance = async (walletId, expectedBalance, targetBalance) => {
    await new Promise(resolve => setTimeout(resolve, 1800))
    const wallet = wallets.find(item => item.id === walletId)
    if (!wallet || wallet.current_balance !== expectedBalance) return { error: new Error('Saldo contoh telah berubah. Buka ulang dialog.') }
    setWallets(previous => previous.map(item => item.id === walletId ? { ...item, current_balance: targetBalance, balance: targetBalance } : item))
    return { data: { wallet_id: walletId, current_balance: targetBalance }, error: null }
  }
  return <div className="app-shell app-viewport flex font-inter text-midnight">
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-cream bg-white p-5 lg:flex"><div className="brand-lockup"><KurogiLogo size={38} />Pocket Kurogi</div><p className="my-8 text-xs text-muted">PRATINJAU · DATA CONTOH</p><nav className="flex flex-col gap-2">{[['chat', 'Asisten Kurogi'], ['wallets', 'Dompet'], ['analytics', 'Laporan keuangan']].map(([id, name]) => <button className="rounded-xl p-3 text-left text-sm" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{name}</button>)}</nav></aside>
    <main className="flex min-w-0 flex-1 flex-col"><header className="flex h-24 shrink-0 items-center justify-between px-5"><div><p className="text-xs text-muted">Pratinjau lokal · tanpa koneksi database</p><h1 className="font-jakarta text-2xl font-bold">Ruang keuanganmu</h1></div><ThemeToggle /></header><div className="flex gap-2 px-4 pb-3 lg:hidden">{['chat', 'wallets', 'analytics'].map(id => <button className="button-text" onClick={() => setTab(id)} key={id}>{id}</button>)}</div><div className="flex min-h-0 flex-1 gap-4 px-4 pb-4"><section className={`relative min-w-0 flex-1 ${tab === 'chat' ? 'chat-surface' : 'overflow-y-auto'}`}>
      {tab === 'chat' && <ChatView messages={messages} isTyping={isTyping} isFreshChat goals={goals} balance={totalBalance} formatRupiah={rupiah} onNavigate={setTab} onSend={sendDemo} />}
      {tab === 'wallets' && <WalletsView wallets={wallets} goals={goals} formatRupiah={rupiah} onSetFinalBalance={setDemoBalance}
        renderAdjustmentHistory={(wallet, onClose) => <WalletAdjustmentHistory wallet={wallet} onClose={onClose} status="success" items={[{ id: 'demo-adjustment', created_at: '2026-09-23T07:00:00Z', previous_balance: 100.01, target_balance: 0, difference: -100.01 }]} />}
        onRenameWallet={async (id, name) => { setWallets(previous => previous.map(wallet => wallet.id === id ? { ...wallet, name } : wallet)); return { error: null } }}
        onDeleteWallet={async id => { setWallets(previous => previous.filter(wallet => wallet.id !== id)); return { error: null } }}
        onAddWallet={async (name, initialBalance = 0) => { setWallets(previous => [...previous, { id: crypto.randomUUID(), name, wallet_type: 'cash', current_balance: Number(initialBalance) }]); return { error: null } }}
      />}
      {tab === 'analytics' && <AnalyticsView status={reportStatus} onRetry={() => setReportStatus('success')} analytics={{ totalIncome: 6500000, totalExpense: 2150000, totalSavings: 1000000, netCashflow: 4350000 }} formatRupiah={rupiah} />}
    </section>{tab === 'chat' && <DesktopRightPanel goals={goals} analytics={{ totalIncome: 6500000, totalSavings: 1000000, netCashflow: 4350000 }} onExecuteStrategy={() => {}} />}</div></main>
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<ThemeProvider><DesignReview /></ThemeProvider>)
