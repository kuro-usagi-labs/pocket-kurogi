import { useState, useCallback } from 'react'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useWallets } from '../../hooks/useWallets'
import { useTransactions } from '../../hooks/useTransactions'
import { useCategories } from '../../hooks/useCategories'
import { analyzeTransaction } from '../../lib/gemini'
import BottomDock from './BottomDock'
import ChatView from '../Chat/ChatView'
import HistoryView from '../History/HistoryView'
import WalletsView from '../Wallets/WalletsView'
import AnalyticsView from '../Analytics/AnalyticsView'

export default function AppShell() {
  const { signOut } = useAuth()
  const { wallets, totalBalance, addWallet, deleteWallet, updateBalance } = useWallets()
  const { transactions, totalIncome, totalExpense, addTransaction } = useTransactions()
  const { findCategory } = useCategories()

  const [activeTab, setActiveTab] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Selamat datang kembali. Saya Financial Analyst Anda.\n\nSebutkan transaksi Anda untuk memperbarui portofolio hari ini:\n• "Pengeluaran 45k kopi bca"\n• "Pemasukan gaji 12 juta ke bca"',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    },
  ])

  const formatRupiah = useCallback((number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(number)
  }, [])

  const handleSend = useCallback(
    async (payload) => {
      let text = '';
      let image = null;
      if (typeof payload === 'string') {
        text = payload;
      } else if (payload && typeof payload === 'object') {
        text = payload.text || '';
        image = payload.image || null;
      }

      if ((!text && !image) || isTyping) return

      const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })

      // Add user message
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'user', text, image, time: currentTime },
      ])
      setIsTyping(true)

      try {
        // Analyze with Gemini (or regex fallback)
        const walletNames = wallets.map((w) => w.name)
        const analysis = await analyzeTransaction(text, image, walletNames)

        let botResponse

        if (analysis.type === 'transaction') {
          // Find matching wallet
          const matchedWallet = wallets.find(
            (w) => w.name.toLowerCase() === (analysis.wallet || '').toLowerCase()
          )

          // Find matching category
          const matchedCategory = findCategory(analysis.category)

          // Insert transaction to Supabase
          const { data: newTx } = await addTransaction({
            type: analysis.transactionType,
            amount: analysis.amount,
            desc: analysis.desc,
            walletId: matchedWallet?.id || wallets[0]?.id,
            categoryId: matchedCategory?.id || null,
          })

          // Update wallet balance
          if (matchedWallet) {
            await updateBalance(matchedWallet.id, analysis.amount, analysis.transactionType)
          }

          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text:
              analysis.transactionType === 'income'
                ? `Pemasukan divalidasi. Dana sebesar ${formatRupiah(analysis.amount)} dialokasikan ke ${(analysis.wallet || 'dompet').toUpperCase()}.`
                : `Alokasi dana diproses. ${formatRupiah(analysis.amount)} ditarik dari ${(analysis.wallet || 'dompet').toUpperCase()}.`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            card: {
              type: analysis.transactionType,
              amount: analysis.amount,
              category: analysis.category || 'Lainnya',
              wallet: analysis.wallet || 'Tunai',
              desc: analysis.desc,
            },
          }
        } else if (analysis.type === 'create_wallet') {
          const { data: newWallet } = await addWallet(analysis.name, analysis.initial_balance || 0);
          
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `Dompet **${analysis.name}** berhasil dibuat dengan saldo awal ${formatRupiah(analysis.initial_balance || 0)}. Anda dapat melihatnya di menu Wallets.`,
            time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
          }
        } else {
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: analysis.reply || 'Sistem tidak mengenali format ini.',
            time: currentTime,
          }
        }

        setIsTyping(false)
        setMessages((prev) => [...prev, botResponse])
      } catch (err) {
        console.error('Error processing message:', err)
        setIsTyping(false)
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: 'Maaf, terjadi kesalahan saat memproses transaksi Anda.',
            time: currentTime,
          },
        ])
      }
    },
    [isTyping, wallets, findCategory, addTransaction, updateBalance, formatRupiah]
  )

  const handleAddWallet = async (name, balance) => {
    await addWallet(name, balance)
  }

  const handleDeleteWallet = async (id) => {
    await deleteWallet(id)
  }

  return (
    <div className="h-[100dvh] w-full flex justify-center font-inter bg-champagne overflow-hidden text-midnight selection:bg-gold/20 selection:text-midnight">
      <div className="w-full h-full md:max-w-[420px] bg-champagne flex flex-col relative md:shadow-[0_0_60px_-15px_rgba(15,23,42,0.2)] md:border-x md:border-midnight/5 overflow-hidden">
        {/* Top App Bar */}
        <header className="shrink-0 z-50 relative bg-ivory/90 backdrop-blur-xl border-b border-midnight/5 px-6 py-5 flex justify-between items-center transition-all">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-midnight flex items-center justify-center text-white shadow-md shadow-midnight/20">
              <Sparkles size={16} strokeWidth={2} />
            </div>
            <h1 className="text-[17px] font-bold tracking-tight text-midnight font-jakarta">
              Pocket Kurogi
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-midnight font-jakarta tracking-tight font-bold">
              {formatRupiah(totalBalance)}
            </span>
          </div>
        </header>

        {/* Dynamic Body */}
        <div className="flex-1 relative overflow-hidden bg-transparent">
          {/* Chat */}
          <div className={`absolute inset-0 h-full w-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
            <ChatView
              messages={messages}
              isTyping={isTyping}
              onSend={handleSend}
              formatRupiah={formatRupiah}
            />
          </div>

          {/* History */}
          <div
            className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
              activeTab === 'history' ? 'block' : 'hidden'
            }`}
          >
            <HistoryView transactions={transactions} formatRupiah={formatRupiah} />
          </div>

          {/* Wallets */}
          <div
            className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
              activeTab === 'wallets' ? 'block' : 'hidden'
            }`}
          >
            <WalletsView
              wallets={wallets}
              totalBalance={totalBalance}
              onAddWallet={handleAddWallet}
              onDeleteWallet={handleDeleteWallet}
              formatRupiah={formatRupiah}
            />
          </div>

          {/* Analytics */}
          <div
            className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${
              activeTab === 'analytics' ? 'block' : 'hidden'
            }`}
          >
            <AnalyticsView
              transactions={transactions}
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              formatRupiah={formatRupiah}
            />
          </div>
        </div>

        {/* Bottom Dock */}
        <BottomDock activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  )
}
