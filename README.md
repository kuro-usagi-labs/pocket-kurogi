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
| Backend | Neon (Postgres + Auth + Data API + Functions) |
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
# Edit .env.local with your Neon public endpoints

# Configure Neon backend
# - apply SQL migrations in neon/migrations
# - deploy functions in neon/functions
# - set GEMINI_API_KEY in both Neon Functions

# Start development
npm run dev
```

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_NEON_AUTH_URL` | Neon Auth endpoint |
| `VITE_NEON_DATA_API_URL` | Neon Data API endpoint |
| `VITE_NEON_ANALYZE_TRANSACTION_URL` | Analyze transaction function endpoint |
| `VITE_NEON_TRANSCRIBE_VOICE_URL` | Voice transcription function endpoint |

Gemini dipanggil dari Neon Functions, jadi API key tidak pernah disimpan di browser bundle.

## 📂 Project Structure

```
src/
├── lib/          # Neon client, Auth, Data API, dan Gemini
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
