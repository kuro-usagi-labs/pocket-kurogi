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

const wallets = [{ id: 'demo', name: 'Tunai', wallet_type: 'cash', balance: 8450000, current_balance: 8450000 }]
const goals = [{ id: 'demo-goal', name: 'Liburan impian', current_amount: 3400000, target_amount: 5000000, status: 'active' }]
const rupiah = number => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(number)
function DesignReview() {
  const [tab, setTab] = useState('chat')
  const [messages, setMessages] = useState([{ id: '1', sender: 'bot', text: 'Hai! Mau mencatat transaksi atau melihat keuanganmu hari ini?' }, { id: '2', sender: 'user', text: 'Aku baru mendapatkan gaji 2,860,097, tolong catat' }, { id: '3', sender: 'bot', text: 'Pemasukan Rp2.860.097 dengan catatan “Gaji”. Pakai dompet mana?' }])
  return <div className="app-shell app-viewport flex font-inter text-midnight">
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-cream bg-white p-5 lg:flex"><div className="brand-lockup"><KurogiLogo size={38} />Pocket Kurogi</div><p className="my-8 text-xs text-muted">PRATINJAU · DATA CONTOH</p><nav className="flex flex-col gap-2">{[['chat', 'Asisten Kurogi'], ['wallets', 'Dompet'], ['analytics', 'Laporan keuangan']].map(([id, name]) => <button className="rounded-xl p-3 text-left text-sm" key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{name}</button>)}</nav></aside>
    <main className="flex min-w-0 flex-1 flex-col"><header className="flex h-24 shrink-0 items-center justify-between px-5"><div><p className="text-xs text-muted">Pratinjau lokal · tanpa koneksi database</p><h1 className="font-jakarta text-2xl font-bold">Ruang keuanganmu</h1></div><ThemeToggle /></header><div className="flex gap-2 px-4 pb-3 lg:hidden">{['chat', 'wallets', 'analytics'].map(id => <button className="button-text" onClick={() => setTab(id)} key={id}>{id}</button>)}</div><div className="flex min-h-0 flex-1 gap-4 px-4 pb-4"><section className={`relative min-w-0 flex-1 ${tab === 'chat' ? 'chat-surface' : 'overflow-y-auto'}`}>
      {tab === 'chat' && <ChatView messages={messages} isFreshChat goals={goals} balance={8450000} formatRupiah={rupiah} onNavigate={setTab} onSend={text => setMessages(m => [...m, { id: String(m.length), sender: 'user', text: typeof text === 'string' ? text : text.text }])} />}
      {tab === 'wallets' && <WalletsView wallets={wallets} goals={goals} formatRupiah={rupiah} />}
      {tab === 'analytics' && <AnalyticsView analytics={{ totalIncome: 6500000, totalExpense: 2150000, totalSavings: 1000000, netCashflow: 4350000 }} formatRupiah={rupiah} />}
    </section>{tab === 'chat' && <DesktopRightPanel goals={goals} analytics={{ totalIncome: 6500000, totalSavings: 1000000, netCashflow: 4350000 }} onExecuteStrategy={() => {}} />}</div></main>
  </div>
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<ThemeProvider><DesignReview /></ThemeProvider>)
