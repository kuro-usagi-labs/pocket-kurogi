# Pocket Kurogi

Dokumentasi mesin percakapan finansial lokal: [Local Finance Assistant](docs/LOCAL_FINANCE_ASSISTANT.md).

> Your private financial analyst. Intelligent. Minimal. Elegant.

**Pocket Kurogi** adalah aplikasi pencatatan keuangan pribadi berbasis percakapan dengan mesin aturan lokal yang privat dan dapat diprediksi.

## ✨ Fitur

- **Smart Chat Input** — Cukup ketik "Makan siang 85k tunai" untuk mengekstrak nominal, kategori, dan dompet tanpa layanan AI
- **Local Financial Assistant** — Cek kemampuan membeli, budget harian, proyeksi target, pengeluaran rutin, dan ringkasan arus kas tanpa API key
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
| Smart parser | Aturan deterministik lokal + pembelajaran preferensi user |
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

# Start development
npm run dev
```

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_NEON_AUTH_URL` | Neon Auth endpoint |
| `VITE_NEON_DATA_API_URL` | Neon Data API endpoint |

Tidak diperlukan API key AI. Pemahaman chat dan perhitungan finansial berjalan secara lokal; Neon hanya dipakai untuk autentikasi dan penyimpanan data.

## Neon migrations and RLS tests

Jalankan seluruh migration secara berurutan menggunakan koneksi database owner:

```bash
TARGET_DATABASE_URL="postgresql://..." node scripts/apply-neon-schema.mjs
```

Checksum migration dinormalisasi ke line ending LF agar identik di Windows dan Linux. Migration yang sudah diterapkan tidak boleh diedit. Baseline production lama memakai satu pasangan checksum kompatibilitas yang dipin di `scripts/migration-checksum.mjs`; perubahan pada salah satu sisi pasangan tersebut akan tetap ditolak.

Audit dan integration test backend membutuhkan koneksi owner agar test dapat melakukan `SET LOCAL ROLE` di dalam transaction yang selalu di-rollback:

```bash
TARGET_DATABASE_URL="postgresql://..." npm run audit:backend
TARGET_DATABASE_URL="postgresql://..." npm run test:db
```

Integration test memverifikasi visibility sebagai `authenticated`, isolasi JWT subject lain, penolakan role `anonymous`, dan tidak adanya akses aplikasi ke `public.schema_migrations`.

## 📂 Project Structure

```
src/
├── lib/          # Neon client, parser lokal, dan kalkulator finansial
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
