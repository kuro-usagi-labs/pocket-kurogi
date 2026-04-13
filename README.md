# Pocket Kurogi

> Your private financial analyst. Intelligent. Minimal. Elegant.

**Pocket Kurogi** adalah aplikasi pencatatan keuangan pribadi berbasis AI Chatbot dengan visual premium ala Private Banking.

## ✨ Fitur

- **Smart Chat Input** — Cukup ketik "Makan siang 85k tunai" dan AI akan otomatis mengekstrak nominal, kategori, dan dompet
- **Multi-Wallet Management** — Kelola berbagai akun: Bank, E-Wallet, Tunai
- **Transaction History** — Riwayat transaksi dengan kategorisasi otomatis
- **Analytics Dashboard** — Ringkasan arus kas dan kategori pengeluaran terbesar
- **Premium Design** — Midnight Sapphire + Champagne color scheme, glassmorphism, micro-animations

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) |
| Styling | Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth) |
| AI/NLP | Gemini 2.5 Flash API |
| Icons | Lucide React |

## 🚀 Getting Started

```bash
# Clone & Install
git clone https://github.com/kuro-usagi-labs/pocket-kurogi.git
cd pocket-kurogi
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Start development
npm run dev
```

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `VITE_GEMINI_API_KEY` | Google Gemini 2.5 Flash API key |

## 📂 Project Structure

```
src/
├── lib/          # Supabase client & Gemini API
├── contexts/     # Auth context (React Context API)
├── hooks/        # Custom hooks (wallets, transactions, categories)
└── components/
    ├── Auth/     # Login page
    ├── Chat/     # Chat interface (messages, input, bubbles)
    ├── History/  # Transaction history
    ├── Wallets/  # Wallet management
    ├── Analytics/ # Dashboard & analytics
    ├── Layout/   # AppShell, BottomDock
    └── shared/   # CategoryIcon, WalletIcon
```

## 📄 License

Private — Kuro Usagi Labs
