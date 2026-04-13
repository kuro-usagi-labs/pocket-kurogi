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
import DesktopSidebar from './DesktopSidebar'
import DesktopHeader from './DesktopHeader'
import DesktopRightPanel from './DesktopRightPanel'

export default function AppShell() {
  const { signOut } = useAuth()
  const { wallets, totalBalance, addWallet, deleteWallet, hardDeleteWallet, clearAllWallets, updateBalance } = useWallets()
  const { transactions, totalIncome, totalExpense, addTransaction, deleteTransaction, clearTransactionsInRange, clearAllTransactions } = useTransactions()
  const { findCategory } = useCategories()

  const [activeTab, setActiveTab] = useState('chat')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
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

      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'user', text, image, time: currentTime },
      ])
      setIsTyping(true)

      try {
        const walletNames = wallets.map((w) => w.name)
        const analysis = await analyzeTransaction(text, image, walletNames)
        let botResponse

        // 1. Handle Pending Confirmation
        if (pendingAction) {
          const isConfirmed = analysis.type === 'confirm' || text.toLowerCase().match(/^(ya|iy|yes|ok|siap|betul|benar)/i);
          
          if (isConfirmed) {
            const { type, payload } = pendingAction;

            if (type === 'delete_wallet') {
              await hardDeleteWallet(payload.id);
            } else if (type === 'bulk_delete_wallets') {
              await clearAllWallets();
            } else if (type === 'bulk_delete_transactions') {
              if (payload.startDate && payload.endDate) {
                await clearTransactionsInRange(payload.startDate, payload.endDate);
              } else {
                await clearAllTransactions();
              }
            }
            
            botResponse = {
              id: Date.now() + 1,
              sender: 'bot',
              text: `✅ Berhasil. ${pendingAction.successMessage}`,
              time: currentTime
            };
          } else {
            botResponse = {
              id: Date.now() + 1,
              sender: 'bot',
              text: "❌ Operasi dibatalkan. Data Anda tetap aman.",
              time: currentTime
            };
          }
          setPendingAction(null);
        } 
        // 2. Handle New Requests
        else if (analysis.type === 'transaction') {
          const matchedWallet = wallets.find(
            (w) => w.name.toLowerCase() === (analysis.wallet || '').toLowerCase()
          )
          const matchedCategory = findCategory(analysis.category)
          let finalWalletId = matchedWallet?.id;
          let isNewWallet = false;

          if (!finalWalletId && analysis.wallet && analysis.wallet.toLowerCase() !== 'tunai') {
            const { data: newWallet, error: wError } = await addWallet(analysis.wallet.toUpperCase(), 0, 'bank');
            if (!wError && newWallet) {
              finalWalletId = newWallet.id;
              isNewWallet = true;
            }
          }
          if (!finalWalletId) finalWalletId = wallets[0]?.id;
          if (!finalWalletId) throw new Error("Sistem tidak menemukan dompet di akun Anda.");

          const { error: txError } = await addTransaction({
            type: analysis.transactionType,
            amount: analysis.amount,
            desc: analysis.desc,
            walletId: finalWalletId,
            categoryId: matchedCategory?.id || null,
          })
          if (txError) throw txError;
          await updateBalance(finalWalletId, analysis.amount, analysis.transactionType);

          const walletDisplayName = (analysis.wallet || 'Dompet').toUpperCase();
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: (analysis.transactionType === 'income'
                ? `Pemasukan divalidasi. Dana sebesar ${formatRupiah(analysis.amount)} dialokasikan ke ${walletDisplayName}.`
                : `Alokasi dana diproses. ${formatRupiah(analysis.amount)} ditarik dari ${walletDisplayName}.`) + (isNewWallet ? `\n\n*(Catatan: Dompet **${walletDisplayName}** baru saja dibuat otomatis)*` : ''),
            time: currentTime,
            card: { type: analysis.transactionType, amount: analysis.amount, category: analysis.category || 'Lainnya', wallet: analysis.wallet || 'Tunai', desc: analysis.desc },
          }
        } else if (analysis.type === 'undo_transaction') {
          if (transactions.length === 0) throw new Error('Tidak ada transaksi yang bisa dibatalkan.');
          const lastTx = transactions[0];
          await updateBalance(lastTx.walletId, lastTx.amount, lastTx.type === 'expense' ? 'income' : 'expense');
          await deleteTransaction(lastTx.id);
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `Transaksi terakhir (**${lastTx.desc}**) telah dibatalkan dan saldo dikembalikan.`,
            time: currentTime
          };
        } else if (analysis.type === 'delete_wallet') {
          const walletToDelete = wallets.find(w => w.name.toLowerCase() === (analysis.wallet || '').toLowerCase());
          if (!walletToDelete) throw new Error(`Dompet **${analysis.wallet}** tidak ditemukan.`);
          
          setPendingAction({
            type: 'delete_wallet',
            payload: { id: walletToDelete.id },
            successMessage: `Dompet **${walletToDelete.name}** telah dihapus secara permanen.`
          });
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `⚠️ **Konfirmasi**: Anda yakin ingin menghapus dompet **${walletToDelete.name}** secara permanen? Seluruh data riwayat di dompet ini akan hilang.\n\nKetik **"Ya"** untuk mengonfirmasi.`,
            time: currentTime
          };
        } else if (analysis.type === 'bulk_delete_wallets') {
          setPendingAction({
            type: 'bulk_delete_wallets',
            payload: {},
            successMessage: "Seluruh dompet Anda telah dikosongkan."
          });
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: "⚠️ **WARNING**: Anda yakin ingin menghapus **SEMUA** dompet? Tindakan ini tidak dapat dibatalkan.\n\nKetik **\"Ya\"** untuk konfirmasi.",
            time: currentTime
          };
        } else if (analysis.type === 'bulk_delete_transactions') {
          const rangeInfo = analysis.startDate && analysis.endDate ? `periode **${analysis.startDate}** hingga **${analysis.endDate}**` : "seluruh riwayat";
          setPendingAction({
            type: 'bulk_delete_transactions',
            payload: { startDate: analysis.startDate, endDate: analysis.endDate },
            successMessage: `Riwayat transaksi ${rangeInfo} telah dihapus.`
          });
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `⚠️ **Konfirmasi**: Hapus ${rangeInfo}? Saldo dompet tidak akan terpengaruh oleh penghapusan riwayat massal ini.\n\nKetik **\"Ya\"** untuk konfirmasi.`,
            time: currentTime
          };
        } else if (analysis.type === 'check_balance') {
          if (analysis.target === 'all') {
            botResponse = {
              id: Date.now() + 1,
              sender: 'bot',
              text: `Total gabungan saldo Anda saat ini adalah **${formatRupiah(totalBalance)}**.`,
              time: currentTime
            };
          } else {
            const matchedWallet = wallets.find(w => w.name.toLowerCase().includes(analysis.target.toLowerCase()));
            if (matchedWallet) {
              botResponse = {
                id: Date.now() + 1,
                sender: 'bot',
                text: `Saldo di dompet **${matchedWallet.name}** adalah **${formatRupiah(matchedWallet.balance || 0)}**.`,
                time: currentTime
              };
            } else {
              botResponse = { id: Date.now() + 1, sender: 'bot', text: `Saya tidak menemukan dompet bernama "${analysis.target}".`, time: currentTime };
            }
          }
        } else if (analysis.type === 'create_wallet') {
          await addWallet(analysis.name, analysis.initial_balance || 0);
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: `Dompet **${analysis.name}** berhasil dibuat.`,
            time: currentTime
          };
        } else {
          botResponse = {
            id: Date.now() + 1,
            sender: 'bot',
            text: analysis.reply || "Maaf, saya tidak mengerti instruksi tersebut.",
            time: currentTime
          };
        }

        if (botResponse) {
          setMessages((prev) => [...prev, botResponse]);
        }
      } catch (error) {
        console.error('Chat Error:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'bot',
            text: `⚠️ Maaf, terjadi kesalahan: ${error.message || 'Gagal memproses permintaan.'}`,
            time: currentTime,
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [wallets, transactions, totalBalance, findCategory, addTransaction, updateBalance, hardDeleteWallet, clearAllWallets, clearTransactionsInRange, clearAllTransactions, addWallet, formatRupiah, pendingAction, isTyping, deleteTransaction]
  )

  const handleAddWallet = async (name, balance) => {
    await addWallet(name, balance)
  }

  const handleDeleteWallet = async (id) => {
    await deleteWallet(id)
  }

  return (
    <div className="bg-champagne font-inter text-midnight overflow-hidden h-[100dvh] flex selection:bg-gold/20 selection:text-midnight">
      <DesktopSidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 min-w-0 flex flex-col h-[100dvh] overflow-hidden">
        <DesktopHeader />

        <div className="flex-1 flex overflow-hidden">
          <section className="flex-1 flex overflow-hidden relative bg-champagne">
            <div className="w-full h-full flex flex-col relative overflow-hidden">
              {/* Top App Bar (Mobile Only) */}
              <header className="md:hidden shrink-0 z-50 relative bg-ivory/90 backdrop-blur-xl border-b border-midnight/5 px-6 py-5 flex justify-between items-center transition-all">
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
          </section>

          <DesktopRightPanel />
        </div>
      </main>
    </div>
  )
}
