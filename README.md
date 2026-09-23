# Pocket Kurogi

Dokumentasi mesin percakapan finansial lokal: [Local Finance Assistant](docs/LOCAL_FINANCE_ASSISTANT.md).

> Your private financial analyst. Intelligent. Minimal. Elegant.

**Pocket Kurogi** adalah aplikasi pencatatan keuangan pribadi berbasis percakapan dengan mesin aturan lokal yang privat dan dapat diprediksi.

## ✨ Fitur

- **Smart Chat Input** — Cukup ketik "Makan siang 85k tunai" untuk mengekstrak nominal, kategori, dan dompet tanpa layanan AI
- **Local Financial Assistant** — Cek kemampuan membeli, budget harian, proyeksi target, pengeluaran rutin, dan ringkasan arus kas tanpa API key
- **Indonesian Grammar Guard** — Memahami angka-kata dan slang umum, lalu meminta klarifikasi untuk negasi, rencana, pilihan, nominal perkiraan, kepemilikan pihak lain, atau referensi ambigu sebelum ledger ditulis
- **Multi-Wallet Management** — Kelola berbagai akun: Bank, E-Wallet, Tunai
- **Transaction History** — Riwayat transaksi dengan kategorisasi otomatis
- **Analytics Dashboard** — Ringkasan arus kas dan kategori pengeluaran terbesar
- **Premium Design** — Midnight Sapphire + Champagne color scheme, glassmorphism, micro-animations

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React (Vite) |
| Styling | Tailwind CSS v4 |
| Backend | Vercel Functions + Neon Postgres/Auth |
| Smart parser | Aturan deterministik, intent scoring, slot filling, dan dialogue state |
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
| `DATABASE_URL` | Koneksi owner/server Neon; hanya untuk Vercel Function |
| `NEON_AUTH_JWKS_URL` | JWKS Neon Auth untuk verifikasi signature JWT |
| `NEON_AUTH_ISSUER` | Issuer JWT yang diharapkan (opsional, direkomendasikan) |
| `NEON_AUTH_AUDIENCE` | Audience JWT yang diharapkan (opsional, direkomendasikan) |
| `ASSISTANT_ALLOWED_ORIGINS` | Allowlist origin production, dipisahkan koma |

Tidak diperlukan API key AI. Interpretasi bahasa berjalan deterministik di aplikasi, sedangkan query, pending action, otorisasi, idempotensi, dan mutation dijalankan oleh Vercel Function dengan Neon sebagai sumber kebenaran.

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

Audit refactor dan keputusan reuse modul lama tersedia di
[Deterministic Assistant Audit](docs/DETERMINISTIC_ASSISTANT_AUDIT.md).

Private — Kuro Usagi Labs

## Pemeriksaan sebelum rilis

Jalankan `npm ci`, `npm run lint`, `npm test -- --maxWorkers=1 --pool=threads`,
`npm run build`, `npm audit`, lalu `npx playwright install chromium` dan `npm run test:e2e`.
Tes browser menggunakan `design-preview.html` dengan data sintetis, bukan akun atau database nyata.

Set `TARGET_DATABASE_URL` ke **branch Neon pengujian terpisah** yang berisi skema aplikasi
dan pengguna uji, kemudian jalankan `npm run test:db:required`. Jangan gunakan production.
Tes yang dilewati pada unit suite bukan bukti integrasi lulus. CI job `database` sengaja gagal
jika secret tersebut belum diisi pada environment GitHub `test`.

Sebelum mengaktifkan rilis ini, uji migrasi `20260923030000_provider_fairness.sql` di branch
pengujian, kemudian terapkan migrasi additive yang sama ke production. Provider akan memakai
fallback jika fungsi pembatas kuota belum tersedia. Interpreter lama tetap tersedia selama rollout.
CLI Vercel tidak lagi menjadi dependency aplikasi; deployment GitHub → Vercel tetap digunakan.
API key Gemini hanya disimpan pada environment server Vercel, tidak di git atau variabel `VITE_`.
