import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, Plus, Sparkles, 
  Receipt, MessageSquare, Clock, Wallet, 
  Coffee, ShoppingBag, Car, Landmark, Smartphone, Target,
  ChevronRight, BarChart3, ShoppingCart, X, TrendingUp, TrendingDown,
  ArrowUp, MoreHorizontal, Mic
} from 'lucide-react';

// =====================================================================
// 🚀 PERSIAPAN INTEGRASI (SUPABASE & GEMINI)
// =====================================================================
// Nanti uncomment dan setup Supabase di sini:
// import { createClient } from '@supabase/supabase-js';
// const supabaseUrl = 'https://xyzcompany.supabase.co';
// const supabaseKey = 'public-anon-key';
// const supabase = createClient(supabaseUrl, supabaseKey);

const GEMINI_API_KEY = ''; // Kosongkan dulu, nanti isi dengan API Key Gemini 2.5

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');

  // Dummy Initial Data (Nanti ini diisi dari hasil fetch Supabase di useEffect)
  const initialTransactions = [
    { id: 101, type: 'expense', amount: 45000, desc: 'Blue Bottle Coffee', category: 'kopi', wallet: 'gopay', time: '09:15', date: 'Hari Ini' },
    { id: 102, type: 'expense', amount: 85000, desc: 'Makan Siang Bisnis', category: 'makan', wallet: 'tunai', time: '12:30', date: 'Hari Ini' },
    { id: 103, type: 'expense', amount: 350000, desc: 'Whole Foods Market', category: 'belanja', wallet: 'bca', time: '19:45', date: 'Kemarin' },
    { id: 104, type: 'expense', amount: 150000, desc: 'Isi Bensin Kendaraan', category: 'bensin', wallet: 'tunai', time: '08:00', date: 'Kemarin' },
    { id: 105, type: 'income', amount: 12500000, desc: 'Pencairan Gaji', category: 'gaji', wallet: 'bca', time: '07:00', date: '1 Apr' },
  ];

  const [transactions, setTransactions] = useState(initialTransactions);
  const [wallets, setWallets] = useState([
    { id: 'w1', name: 'BCA Private', balance: 14500000 },
    { id: 'w2', name: 'Gopay', balance: 850000 },
    { id: 'w3', name: 'Tunai', balance: 450000 }
  ]);
  
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletData, setNewWalletData] = useState({ name: '', balance: '' });
  
  const totalBalance = wallets.reduce((acc, curr) => acc + curr.balance, 0);
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);

  // Nanti fungsi ini panggil supabase.from('wallets').insert()
  const handleAddWalletSubmit = (e) => {
    e.preventDefault();
    if (!newWalletData.name.trim()) return;
    const newWallet = {
      id: Date.now().toString(),
      name: newWalletData.name.trim(),
      balance: parseFloat(newWalletData.balance) || 0
    };
    setWallets(prev => [...prev, newWallet]);
    setShowAddWallet(false);
    setNewWalletData({ name: '', balance: '' });
  };

  // Nanti fungsi ini panggil supabase.from('wallets').delete()
  const handleDeleteWallet = (id) => {
    setWallets(prev => prev.filter(w => w.id !== id));
  };

  // Dynamic Analytics Calculation
  const expenseTransactions = transactions.filter(t => t.type === 'expense');
  const categoryTotals = expenseTransactions.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + curr.amount;
    return acc;
  }, {});
  const topCategories = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Selamat datang kembali. Saya Financial Analyst Anda.\n\nSebutkan transaksi Anda untuk memperbarui portofolio hari ini:\n• "Pengeluaran 45k kopi bca"\n• "Pemasukan gaji 12 juta ke bca"',
      time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, activeTab]);

  const formatRupiah = (number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(number);
  };

  // Refactored to avoid parser bugs with inline JSX
  const getCategoryIcon = (cat, size = 18) => {
    let Icon = Receipt;
    switch(cat.toLowerCase()) {
      case 'kopi': Icon = Coffee; break;
      case 'makan': case 'jajan': Icon = ShoppingBag; break;
      case 'belanja': Icon = ShoppingCart; break;
      case 'bensin': case 'transport': Icon = Car; break;
      case 'gaji': Icon = Landmark; break;
      default: Icon = Receipt; break;
    }
    return <Icon size={size} strokeWidth={2} />;
  };

  // Refactored to avoid parser bugs with inline JSX
  const getWalletIcon = (walletName) => {
    const lower = walletName.toLowerCase();
    let Icon = Wallet;
    if (['bca', 'mandiri', 'bni', 'bri', 'bank', 'private'].some(w => lower.includes(w))) Icon = Landmark;
    else if (['gopay', 'ovo', 'dana', 'shopee', 'linkaja', 'pay'].some(w => lower.includes(w))) Icon = Smartphone;
    return <Icon size={20} strokeWidth={2} />;
  };

  // =====================================================================
  // 🧠 FUNGSI ANALISIS CERDAS (DISIAPKAN UNTUK GEMINI API)
  // =====================================================================
  const analyzeTextAI = async (text, currentWallets) => {
    
    // 💡 JIKA API KEY GEMINI SUDAH DIISI, GUNAKAN KODE INI:
    if (GEMINI_API_KEY) {
      try {
        const walletList = currentWallets.map(w => w.name).join(', ');
        const prompt = `
          Kamu adalah AI asisten keuangan pencatat pengeluaran dan pemasukan.
          Ekstrak informasi dari teks berikut: "${text}"
          Daftar dompet yang tersedia: ${walletList}, Tunai. (pilih yang paling cocok, default: Tunai).
          
          Kembalikan HANYA dalam format JSON valid seperti ini tanpa markdown:
          {
            "type": "transaction", // atau "greeting", "unknown", "help"
            "transactionType": "expense", // atau "income"
            "amount": 50000, // angka murni
            "desc": "Nama transaksi bersih",
            "category": "Kategori singkat (misal: Makan, Bensin, Gaji)",
            "wallet": "Nama dompet yang cocok",
            "reply": "Balasan ramah singkat jika bukan transaksi"
          }
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        const data = await response.json();
        const result = JSON.parse(data.candidates[0].content.parts[0].text);
        return result;

      } catch (error) {
        console.error("Gemini API Error:", error);
      }
    }

    // 💡 FALLBACK: LOGIKA LOKAL (REGEX) JIKA API BELUM TERSEDIA
    await new Promise(resolve => setTimeout(resolve, 800));

    let normalizedText = text.toLowerCase().trim();

    if (/^(halo|hai|hi|pagi|siang|sore|malam)/.test(normalizedText) && !/\d/.test(normalizedText)) {
      return { type: 'greeting', reply: 'Sistem aktif. Silakan instruksikan pencatatan pengeluaran atau pemasukan Anda hari ini.' };
    }

    normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); 
    normalizedText = normalizedText.replace(/(\d)\.(\d{3})(?!\d)/g, '$1$2'); 

    const moneyRegex = /(?:rp\s*)?(\d+(?:[.,]\d+)?)\s*(k|rb|ribu|jt|juta|m)?/i;
    const match = normalizedText.match(moneyRegex);

    if (!match) return { type: 'unknown', reply: 'Sistem membutuhkan nominal spesifik untuk memproses ledger. Contoh: "Beli kopi 50k tunai"' };

    let amount = parseFloat(match[1].replace(',', '.'));
    const multiplier = match[2];

    if (multiplier) {
      if (['k', 'rb', 'ribu'].includes(multiplier)) amount *= 1000;
      else if (['jt', 'juta'].includes(multiplier)) amount *= 1000000;
    } else if (amount > 0 && 1000 > amount) { 
      // Fixed: Using '1000 > amount' instead of '<' to prevent JSX parser bugs
      amount *= 1000; 
    }

    const walletNamesList = currentWallets.map(w => w.name.toLowerCase());
    walletNamesList.push('tunai', 'cash');
    const walletRegex = new RegExp(`\\b(${walletNamesList.join('|')})\\b`, 'i');
    let walletMatch = normalizedText.match(walletRegex)?.[1]?.toLowerCase();
    if (walletMatch === 'tunai' || walletMatch === 'cash') walletMatch = 'tunai';
    
    let wallet = walletMatch || (currentWallets.length > 0 ? currentWallets[0].name.toLowerCase() : 'tunai');
    let category = normalizedText.match(/\b(kopi|makan|minum|bensin|transport|belanja|gaji|bonus|jajan|listrik)\b/i)?.[1]?.toLowerCase() || 'lainnya';

    let desc = text.replace(match[0], '').trim();
    desc = desc.replace(new RegExp(`\\b${wallet}\\b`, 'i'), '');
    desc = desc.replace(new RegExp(`\\b${category}\\b`, 'i'), '');
    desc = desc.replace(/^(beli|bayar|buat|dari|terima|dapat|pake|pakai|-|\+)\s+/gi, '').trim();
    
    if (!desc) desc = category.charAt(0).toUpperCase() + category.slice(1);
    let isIncome = /(gaji|dapat|terima|masuk|bonus|topup|pemasukan|\+)/i.test(normalizedText);

    return {
      type: 'transaction',
      transactionType: isIncome ? 'income' : 'expense',
      amount,
      desc: desc.charAt(0).toUpperCase() + desc.slice(1),
      category: category,
      wallet: wallet
    };
  };

  const handleSend = async (e, customText = null) => {
    if (e) e.preventDefault();
    const userText = customText || inputValue.trim();
    if (!userText) return;

    const currentTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [...prev, { id: Date.now(), sender: 'user', text: userText, time: currentTime }]);
    setInputValue('');
    setIsTyping(true);

    const analysis = await analyzeTextAI(userText, wallets);
    let botResponse = {};

    if (analysis.type === 'transaction') {
      
      // ==========================================================
      // 🚀 NANTI TAMBAHKAN SUPABASE INSERT DI SINI
      // ==========================================================
      
      setWallets(prev => prev.map(w => {
        if (w.name.toLowerCase() === analysis.wallet.toLowerCase()) {
          return {
            ...w, balance: analysis.transactionType === 'income' ? w.balance + analysis.amount : w.balance - analysis.amount
          };
        }
        return w;
      }));

      const newTransaction = {
        id: Date.now(), type: analysis.transactionType, amount: analysis.amount, desc: analysis.desc, category: analysis.category, wallet: analysis.wallet, time: currentTime, date: 'Hari Ini'
      };

      setTransactions(prev => [newTransaction, ...prev]);

      botResponse = {
        id: Date.now() + 1,
        sender: 'bot',
        text: analysis.transactionType === 'income' 
          ? `Pemasukan divalidasi. Dana sebesar ${formatRupiah(analysis.amount)} dialokasikan ke ${analysis.wallet.toUpperCase()}.` 
          : `Alokasi dana diproses. ${formatRupiah(analysis.amount)} ditarik dari ${analysis.wallet.toUpperCase()}.`,
        time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        card: { ...newTransaction }
      };
    } else {
      botResponse = { id: Date.now() + 1, sender: 'bot', text: analysis.reply || 'Sistem tidak mengenali format ini.', time: currentTime };
    }

    setIsTyping(false);
    setMessages(prev => [...prev, botResponse]);
  };

  const quickSuggestions = [
    { icon: "☕", text: "45k Kopi Tunai" },
    { icon: "⛽", text: "150k Bensin BCA" },
    { icon: "💰", text: "5jt Gaji BCA" }
  ];

  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'history', icon: Clock, label: 'Histori' },
    { id: 'wallets', icon: Wallet, label: 'Dompet' },
    { id: 'analytics', icon: BarChart3, label: 'Analisa' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
        .font-jakarta { font-family: 'Plus Jakarta Sans', sans-serif; }
        .font-inter { font-family: 'Inter', sans-serif; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        body { background-color: #FDFCF7; }
        
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeSlideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
      
      <div className="h-[100dvh] w-full flex justify-center font-inter bg-[#FDFCF7] overflow-hidden text-[#0F172A] selection:bg-[#775a19]/20 selection:text-[#0F172A]">
        <div className="w-full h-full md:max-w-[420px] bg-[#FDFCF7] flex flex-col relative md:shadow-[0_0_60px_-15px_rgba(15,23,42,0.2)] md:border-x md:border-[#0F172A]/5 overflow-hidden">
          
          {/* ================= TOP APP BAR ================= */}
          <header className="shrink-0 z-50 relative bg-[#FAF9F4]/90 backdrop-blur-xl border-b border-[#0F172A]/5 px-6 py-5 flex justify-between items-center transition-all">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#0F172A] flex items-center justify-center text-white shadow-md shadow-[#0F172A]/20">
                <Sparkles size={16} strokeWidth={2} />
              </div>
              <h1 className="text-[17px] font-bold tracking-tight text-[#0F172A] font-jakarta">The Vault</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[#0F172A] font-jakarta tracking-tight font-bold">{formatRupiah(totalBalance)}</span>
            </div>
          </header>

          {/* ================= DYNAMIC BODY AREA ================= */}
          <div className="flex-1 relative overflow-hidden bg-transparent">
            
            {/* ================= 1. CHAT VIEW ================= */}
            <div className={`absolute inset-0 h-full w-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}>
              
              <div className="absolute bottom-[80px] left-0 w-full h-[180px] bg-gradient-to-t from-[#FDFCF7] via-[#FDFCF7]/90 to-transparent z-30 pointer-events-none"></div>

              <div className="absolute inset-0 overflow-y-auto px-5 pt-6 pb-[260px] scroll-smooth no-scrollbar z-20">
                <div className="flex justify-center mb-8">
                  <span className="px-4 py-1.5 rounded-full bg-[#F5F2E8] text-[#0F172A]/60 text-[10px] font-extrabold uppercase tracking-[0.25em] font-jakarta shadow-sm">Today</span>
                </div>

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col w-full mb-6 animate-fade-in ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`relative max-w-[85%] px-5 py-4 text-[14.5px] leading-relaxed transition-all duration-300 ${
                        msg.sender === 'user' 
                          ? 'bg-[#0F172A] text-white rounded-[22px] rounded-br-[6px] shadow-[0_8px_20px_rgba(15,23,42,0.15)]' 
                          : 'bg-white text-[#0F172A] rounded-[22px] rounded-bl-[6px] border border-[#0F172A]/5 shadow-[0_8px_32px_rgba(15,23,42,0.04)]'
                      }`}>
                      <div className="whitespace-pre-wrap font-medium">{msg.text}</div>

                      {msg.card && (
                        <div className="mt-4 bg-[#FAF9F4] rounded-[14px] p-4 border border-[#0F172A]/5">
                          <div className="flex items-center gap-3 mb-3.5">
                            <div className="w-10 h-10 rounded-full bg-[#0F172A] text-white flex items-center justify-center shadow-inner">
                              {getCategoryIcon(msg.card.category)}
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-extrabold text-[#45464D] uppercase tracking-widest">{msg.card.wallet}</p>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-[12.5px] font-bold text-[#0F172A] uppercase tracking-wider">{msg.card.category}</span>
                                <span className={`text-[12px] font-bold ${msg.card.type === 'income' ? 'text-[#775a19]' : 'text-[#0F172A]'}`}>
                                  Tercatat
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-[#EBE7D9] h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#0F172A] h-full w-full rounded-full opacity-90"></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <span className="text-[9.5px] font-bold text-[#45464D]/50 uppercase tracking-[0.1em] mt-2.5 mx-1.5 font-jakarta">
                      {msg.sender === 'bot' ? 'Financial Analyst' : 'You'} • {msg.time}
                    </span>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex w-full mb-6 items-start animate-fade-in">
                    <div className="bg-white border border-[#0F172A]/5 shadow-[0_8px_32px_rgba(15,23,42,0.04)] rounded-[22px] rounded-bl-[6px] px-5 py-4 flex gap-1.5 items-center justify-center h-[46px]">
                      <div className="w-1.5 h-1.5 bg-[#0F172A]/40 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#0F172A]/40 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-1.5 h-1.5 bg-[#0F172A]/40 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Floating Input Area */}
              <div className="absolute bottom-[110px] left-0 w-full px-5 flex flex-col items-center z-40 pointer-events-none">
                <div className="flex gap-3 w-full max-w-sm mb-4 overflow-x-auto no-scrollbar pb-2 pt-1 pointer-events-auto px-1">
                  {quickSuggestions.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => handleSend(null, item.text)} 
                      disabled={isTyping} 
                      className="shrink-0 flex items-center gap-2.5 bg-white/90 backdrop-blur-xl border border-[#0F172A]/10 shadow-[0_4px_12px_rgba(15,23,42,0.04)] pl-1.5 pr-4 py-1.5 rounded-full hover:bg-white hover:border-[#0F172A]/20 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(15,23,42,0.08)] active:scale-95 transition-all duration-300 group"
                    >
                      <div className="w-7 h-7 rounded-full bg-[#F5F2E8] border border-[#0F172A]/5 flex items-center justify-center shadow-inner group-hover:bg-[#EBE7D9] transition-colors">
                        <span className="text-[12px] transform group-hover:scale-110 transition-transform duration-300">{item.icon}</span>
                      </div>
                      <span className="text-[11.5px] font-extrabold text-[#0F172A] font-jakarta tracking-tight">
                        {item.text}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="w-full max-w-sm bg-white/95 backdrop-blur-3xl p-2 rounded-[28px] shadow-[0_20px_50px_rgba(15,23,42,0.1)] flex items-center gap-2.5 border border-[#0F172A]/10 pointer-events-auto">
                  <button type="button" className="w-11 h-11 flex items-center justify-center text-[#0F172A] bg-[#F5F2E8] rounded-full hover:bg-[#EBE7D9] transition-all shrink-0">
                    <Plus size={22} strokeWidth={2} />
                  </button>
                  <form onSubmit={(e) => handleSend(e)} className="flex-1 flex items-center">
                    <input type="text" className="w-full bg-transparent border-none focus:ring-0 text-[#0F172A] font-inter placeholder:text-[#0F172A]/30 px-2 text-[14.5px] outline-none font-medium" placeholder="Instruksikan transaksi..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} autoComplete="off" />
                    <button type="button" className="mr-2 text-[#0F172A]/30 hover:text-[#0F172A]/70 transition-colors p-1">
                       <Mic size={20} strokeWidth={2} />
                    </button>
                    <button type="submit" disabled={!inputValue.trim() || isTyping} className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shrink-0 ${inputValue.trim() && !isTyping ? 'bg-[#0F172A] text-white shadow-lg shadow-[#0F172A]/20 active:scale-95' : 'bg-[#FAF9F4] text-[#0F172A]/20'}`}>
                      <ArrowUp size={20} strokeWidth={2} />
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* ================= 2. HISTORY VIEW ================= */}
            <div className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${activeTab === 'history' ? 'block' : 'hidden'}`}>
              <div className="pt-8 px-6 pb-[140px]">
                <div className="relative flex items-center bg-white border border-[#0F172A]/10 shadow-[0_8px_30px_rgba(15,23,42,0.03)] rounded-2xl p-1.5 mb-8">
                  <div className="px-3 text-[#45464D]">
                    <Sparkles size={18} strokeWidth={2} />
                  </div>
                  <input className="w-full bg-transparent border-none focus:ring-0 text-[#0F172A] placeholder:text-[#45464D]/40 py-2.5 px-1 font-jakarta font-semibold text-[14.5px] outline-none" placeholder="Cari transaksi portofolio..." type="text"/>
                </div>

                <div className="space-y-8">
                  <div>
                    <h2 className="text-[#0F172A]/50 text-[10px] font-extrabold uppercase tracking-[0.25em] mb-4 px-1 font-jakarta">Riwayat Eksekusi</h2>
                    <div className="space-y-3.5">
                      {transactions.length === 0 ? (
                        <p className="text-sm text-center text-[#45464D] py-10 font-medium">Belum ada aktivitas terekam.</p>
                      ) : (
                        transactions.map((t) => (
                          <div key={t.id} className="bg-white p-5 rounded-[20px] flex items-center justify-between border border-[#0F172A]/5 hover:shadow-[0_8px_30px_rgba(15,23,42,0.04)] hover:-translate-y-0.5 transition-all duration-300">
                            <div className="flex items-center gap-4">
                              <div className="w-[50px] h-[50px] rounded-2xl bg-[#FAF9F4] flex items-center justify-center text-[#0F172A] border border-[#0F172A]/5 shadow-sm">
                                {getCategoryIcon(t.category, 22)}
                              </div>
                              <div>
                                <h3 className="font-bold text-[#0F172A] font-jakarta text-[14.5px] capitalize tracking-tight">{t.desc}</h3>
                                <p className="text-[11.5px] font-medium text-[#45464D]/60 mt-0.5">{t.date} • {t.time}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-jakarta font-extrabold text-[15.5px] tracking-tight ${t.type === 'income' ? 'text-[#775a19]' : 'text-[#0F172A]'}`}>
                                {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
                              </p>
                              <p className="text-[9.5px] text-[#45464D]/50 uppercase font-extrabold tracking-widest mt-1">{t.wallet}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ================= 3. WALLETS VIEW ================= */}
            <div className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${activeTab === 'wallets' ? 'block' : 'hidden'}`}>
              <div className="pt-8 px-6 pb-[140px]">
                <div className="mb-8 pl-1">
                  <h2 className="text-[10px] font-extrabold text-[#45464D] uppercase tracking-[0.25em] mb-2 font-jakarta opacity-80">Total Likuiditas</h2>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[38px] font-extrabold text-[#0F172A] font-jakarta tracking-tighter leading-tight drop-shadow-sm">
                      {formatRupiah(totalBalance)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-10">
                  {wallets.map(w => (
                    <div key={w.id} className="bg-white border border-[#0F172A]/5 rounded-[24px] p-5 shadow-[0_8px_30px_rgba(15,23,42,0.03)] relative group hover:border-[#0F172A]/10 transition-colors">
                      <button onClick={() => handleDeleteWallet(w.id)} className="absolute top-3 right-3 p-1.5 text-[#45464D]/30 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                        <X size={14} strokeWidth={2} />
                      </button>
                      <div className="w-11 h-11 bg-[#FAF9F4] rounded-full flex items-center justify-center text-[#0F172A] mb-4 border border-[#0F172A]/5 shadow-sm">
                        {getWalletIcon(w.name)}
                      </div>
                      <p className="text-[10px] font-extrabold text-[#45464D] uppercase tracking-widest truncate">{w.name}</p>
                      <p className="text-[16px] font-extrabold text-[#0F172A] mt-1 font-jakarta">{formatRupiah(w.balance)}</p>
                    </div>
                  ))}
                  
                  <div onClick={() => setShowAddWallet(true)} className="border border-dashed border-[#0F172A]/20 bg-[#FAF9F4]/40 hover:bg-[#FAF9F4] rounded-[24px] p-5 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[130px] group">
                    <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm mb-3 group-hover:scale-105 transition-transform">
                       <Plus size={20} className="text-[#0F172A]/60" strokeWidth={2} />
                    </div>
                    <p className="text-[10.5px] font-extrabold text-[#0F172A]/60 font-jakarta uppercase tracking-widest text-center leading-relaxed">Tambah<br/>Portofolio</p>
                  </div>
                </div>

                <div className="bg-[#0F172A] p-8 rounded-[32px] flex flex-col justify-between items-start text-white shadow-2xl shadow-[#0F172A]/30 relative overflow-hidden">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-6 border border-white/5">
                    <Target size={26} className="text-white" strokeWidth={1.5} />
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-[22px] font-jakarta font-bold mb-2.5 leading-tight tracking-tight">Rencanakan Milestone</h3>
                    <p className="text-white/60 text-[13.5px] font-inter leading-relaxed mb-8 font-medium">Tetapkan target untuk akuisisi properti, perjalanan, atau pertumbuhan jangka panjang.</p>
                    <button className="bg-[#FDFCF7] text-[#0F172A] px-7 py-3.5 rounded-full font-jakarta font-extrabold text-[11px] tracking-[0.15em] uppercase hover:opacity-90 hover:scale-105 active:scale-95 transition-all w-full shadow-lg shadow-black/20">
                      Buat Target Baru
                    </button>
                  </div>
                  <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-[#775a19]/20 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="absolute -top-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                </div>
              </div>
            </div>

            {/* ================= 4. ANALYTICS VIEW ================= */}
            <div className={`absolute inset-0 h-full w-full overflow-y-auto no-scrollbar animate-fade-in ${activeTab === 'analytics' ? 'block' : 'hidden'}`}>
              <div className="pt-8 px-6 pb-[140px] space-y-7">
                
                {/* Weekly Summary (Dark Bento) */}
                <div className="bg-[#0F172A] text-white rounded-[32px] p-8 relative overflow-hidden shadow-2xl shadow-[#0F172A]/20">
                  <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold font-jakarta mb-1.5 tracking-tight">Ringkasan Arus Kas</h3>
                    <p className="text-white/40 text-[10px] font-extrabold mb-8 tracking-widest uppercase font-jakarta">Siklus Berjalan</p>
                    <div className="space-y-5">
                      <div className="flex justify-between items-center border-b border-white/10 pb-5">
                        <span className="text-[13.5px] font-medium text-white/60">Pemasukan Kotor</span>
                        <span className="text-[19px] font-extrabold font-jakarta">+{formatRupiah(totalIncome)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-[13.5px] font-medium text-white/60">Pengeluaran Inti</span>
                        <span className="text-[19px] font-extrabold font-jakarta text-[#775a19]">{formatRupiah(totalExpense)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Spending by Category */}
                <div className="bg-white rounded-[32px] p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-[#0F172A]/5">
                  <div className="flex justify-between items-center mb-8">
                    <h3 className="text-[17px] font-bold font-jakarta text-[#0F172A] tracking-tight">Kategori Terbesar</h3>
                  </div>
                  <div className="space-y-7">
                    {topCategories.length > 0 ? (
                      topCategories.map(([cat, amount], idx) => {
                        const percentage = ((amount / totalExpense) * 100).toFixed(0);
                        return (
                          <div key={cat} className="space-y-3.5 group">
                            <div className="flex items-center gap-4">
                              <div className="w-[52px] h-[52px] rounded-2xl bg-[#FAF9F4] border border-[#0F172A]/5 flex items-center justify-center text-[#0F172A] shadow-sm group-hover:scale-105 transition-transform">
                                {getCategoryIcon(cat, 22)}
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-extrabold text-[#45464D] uppercase tracking-widest opacity-60 capitalize">{cat}</p>
                                <p className="text-[16px] font-bold font-jakarta text-[#0F172A] mt-0.5">{formatRupiah(amount)}</p>
                              </div>
                              <span className="text-[13px] font-extrabold font-jakarta text-[#0F172A]">{percentage}%</span>
                            </div>
                            <div className="w-full h-2 bg-[#F5F2E8] rounded-full overflow-hidden">
                              {/* Accent color for the biggest category */}
                              <div className={`h-full rounded-full transition-all duration-1000 ${idx === 0 ? 'bg-[#775a19]' : idx === 1 ? 'bg-[#0F172A]/70' : 'bg-[#0F172A]/40'}`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="text-[14px] text-[#45464D] text-center py-6 font-medium">Belum ada analisis data.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* ================= BOTTOM NAV BAR (Floating Minimalist Dock) ================= */}
          <div className="absolute bottom-6 left-0 w-full px-6 flex justify-center z-50 pointer-events-none">
            <nav className="w-full max-w-[340px] bg-white/90 backdrop-blur-3xl border border-[#0F172A]/5 shadow-[0_20px_40px_-10px_rgba(15,23,42,0.1)] rounded-[24px] p-2 flex justify-between items-center pointer-events-auto transition-all duration-500">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-center rounded-[18px] transition-all duration-500 ease-out overflow-hidden ${
                      isActive 
                        ? 'bg-[#0F172A] text-white px-4 py-2.5 shadow-md shadow-[#0F172A]/20' 
                        : 'bg-transparent text-[#45464D]/50 hover:text-[#0F172A] p-2.5 hover:bg-[#FAF9F4]'
                    }`}
                  >
                    <Icon size={20} strokeWidth={isActive ? 3 : 2} className="shrink-0" />
                    <span 
                      className={`font-jakarta text-[10.5px] font-bold uppercase tracking-[0.15em] whitespace-nowrap transition-all duration-500 ease-out flex items-center ${
                        isActive ? 'max-w-[80px] opacity-100 ml-2.5' : 'max-w-0 opacity-0 ml-0'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ADD WALLET MODAL */}
          {showAddWallet && (
            <div className="fixed inset-0 z-50 bg-[#0F172A]/40 backdrop-blur-md flex items-center justify-center p-4 transition-opacity animate-fade-in">
              <div className="bg-[#FDFCF7] rounded-[32px] p-7 w-full max-w-[340px] shadow-2xl border border-white/20">
                <div className="flex justify-between items-center mb-7">
                  <h2 className="text-[19px] font-bold text-[#0F172A] font-jakarta tracking-tight">Portofolio Baru</h2>
                  <button 
                    onClick={() => setShowAddWallet(false)} 
                    className="text-[#45464D] hover:text-[#0F172A] bg-[#FAF9F4] border border-[#0F172A]/5 rounded-full p-2 hover:bg-[#EBE7D9] transition-colors"
                  >
                    <X size={16} strokeWidth={2} />
                  </button>
                </div>
                <form onSubmit={handleAddWalletSubmit}>
                  <div className="mb-5">
                    <label className="block text-[10.5px] font-extrabold text-[#45464D] uppercase mb-2 tracking-[0.15em] font-jakarta">Institusi / Nama</label>
                    <input required type="text" placeholder="Cth: Mandiri, Investasi..." className="w-full bg-[#FAF9F4] border border-[#0F172A]/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F172A]/40 font-inter transition-all" value={newWalletData.name} onChange={(e) => setNewWalletData({...newWalletData, name: e.target.value})} />
                  </div>
                  <div className="mb-8">
                    <label className="block text-[10.5px] font-extrabold text-[#45464D] uppercase mb-2 tracking-[0.15em] font-jakarta">Likuiditas Awal (Rp)</label>
                    <input required type="number" placeholder="500000" className="w-full bg-[#FAF9F4] border border-[#0F172A]/10 rounded-2xl px-4 py-3.5 text-[14.5px] font-semibold text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F172A]/40 font-inter transition-all" value={newWalletData.balance} onChange={(e) => setNewWalletData({...newWalletData, balance: e.target.value})} />
                  </div>
                  <button 
                    type="submit" 
                    className="w-full bg-[#0F172A] text-white font-bold font-jakarta text-[13px] uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-[#0F172A]/20 hover:opacity-90 active:scale-95 transition-all"
                  >
                    Inisialisasi
                  </button>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}