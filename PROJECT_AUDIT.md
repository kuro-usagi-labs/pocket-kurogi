# Pocket Kurogi — Technical Audit

Tanggal audit awal: 29 Juli 2026

## Ringkasan Arsitektur

- Frontend merupakan SPA React 19 + Vite 8 + Tailwind CSS 4 yang di-host di Vercel.
- Tidak ada application server atau Vercel Function aktif. Browser terhubung langsung ke Neon Auth dan Neon Data API melalui `@neondatabase/neon-js`.
- Pemahaman chat dan kalkulasi finansial berjalan secara deterministik di browser. Tidak ada layanan AI eksternal yang aktif.
- `src/components/Layout/AppShell.jsx` adalah pusat routing tab, orkestrasi intent, dialog konfirmasi, dan sinkronisasi data.
- Mutasi finansial utama dijalankan melalui PostgreSQL RPC agar perubahan ledger dan saldo bersifat atomik.

## Fitur Aktif

- Auth email/password: register, login, lupa password, reset password, dan logout.
- Pencatatan pemasukan/pengeluaran melalui chat.
- Transfer antar-dompet.
- Pembuatan, setoran, pencairan, rename, dan penghapusan target.
- Pembuatan, rename, penghapusan, dan pemulihan dompet melalui chat.
- Histori dengan search, filter, edit, delete, undo, dan pagination.
- Analitik arus kas, kategori, tabungan, transfer, dan budget usage.
- Tema light/dark/system dan reset seluruh data user tanpa menghapus akun.
- Lampiran gambar disimpan bersama chat, tetapi tidak dianalisis atau di-OCR.
- Input suara memakai Web Speech Recognition milik browser.

## Model Data Neon

Tabel aplikasi utama:

- `profiles`
- `wallets`
- `categories`
- `transactions`
- `goals`
- `budgets`
- `smart_category_rules`
- `smart_wallet_rules`
- `chat_messages`
- `chat_attachments`
- `schema_migrations`

RPC finansial utama:

- `record_transaction`
- `adjust_wallet_balance`
- `transfer_between_wallets`
- `create_wallet_with_opening_balance`
- `contribute_to_goal`
- `withdraw_from_goal`
- `create_goal_with_contribution`
- `delete_transaction_and_revert_balance`
- `replace_transaction_entry`
- `delete_goal_and_restore_funds`
- `delete_wallet_permanently_safe`
- `reset_current_user_data`

## Temuan Penting

1. `AppShell.jsx` berukuran sekitar 1.928 baris dan menjadi titik risiko utama saat fitur baru ditambahkan.
2. Halaman Analitik menampilkan label "bulan ini", tetapi snapshot default frontend meminta data seluruh waktu.
3. Filter histori, saran, dan deteksi transaksi berulang hanya bekerja atas transaksi yang sudah dimuat; halaman awal memuat 30 transaksi.
4. Budget memiliki hook backend, tetapi belum memiliki UI pengelolaan.
5. `smart_wallet_rules` disimpan dan dibaca, tetapi belum dipakai oleh orkestrasi chat untuk memilih dompet.
6. UI belum menyediakan alur lengkap untuk memilih tipe dompet serta setor/cairkan target; beberapa aksi hanya tersedia melalui chat.
7. Lampiran gambar disimpan sebagai base64 di PostgreSQL hingga 4 MB per gambar. Ini sederhana, tetapi berpotensi mahal untuk storage, transfer, dan memory.
8. Migration baseline menggabungkan sejarah schema sepanjang sekitar 5.685 baris. Migration tracking tersedia, tetapi baseline sulit dipelihara.
9. Audit live mengonfirmasi grant write untuk `categories`, `budgets`, `chat_messages`, dan `chat_attachments`. Mutasi finansial untuk wallet, transaksi, dan goal tetap dibatasi ke RPC.
10. Audit dependency production menemukan advisory transitif pada stack Neon Auth/Better Auth, termasuk satu severity critical. Dampaknya perlu dinilai terhadap fitur auth yang benar-benar digunakan dan upgrade kompatibel perlu diuji.
11. Belum ada component test, hook test, database integration test, E2E test, atau GitHub Actions CI.
12. `@neondatabase/serverless`, `jose`, `DesktopRightPanel`, dan beberapa helper lama tampak tidak dipakai oleh runtime utama.
13. `upload-env.cjs` masih mewajibkan endpoint AI/transkripsi lama yang sudah dihapus dari aplikasi.
14. Manifest PWA tersedia, tetapi service worker sengaja di-unregister sehingga offline caching belum aktif.
15. `nextdevelop.md` tidak sepenuhnya mutakhir karena quick actions, edit transaksi, undo, dan local finance assistant sudah diimplementasikan.

## Verifikasi Lokal

- Unit test: 38/38 lulus.
- ESLint: lulus tanpa error.
- Production build: berhasil.
- Chunk modern Neon sekitar 442 KB (108,5 KB gzip).
- Chunk modern vendor sekitar 324 KB (103,8 KB gzip).
- Sebelum dokumen audit ini dibuat, Git working tree bersih; `node_modules` dan `dist` diabaikan Git.

## Audit Live Neon

Audit dilakukan secara read-only pada 29 Juli 2026 melalui dashboard dan SQL Editor Neon. Tidak ada schema, data, user, grant, atau konfigurasi yang diubah.

### Project Production

- Project: `pocket kurogi` (`young-cloud-55803831`).
- Branch: `production` (`br-red-bread-ax1yj1eq`), satu-satunya branch dan branch default.
- Database: `neondb`, PostgreSQL 18.4.
- Region: AWS US East 2 (Ohio).
- Compute autoscaling: 0,25 sampai 2 CU; compute dapat idle.
- Storage terpakai sekitar 0,03 GB.
- Restore/history retention hanya 6 jam. Ini pendek untuk aplikasi finansial dan meningkatkan risiko kehilangan data jika kesalahan baru diketahui terlambat.

### Isi Database

| Objek | Jumlah |
| --- | ---: |
| User Neon Auth | 1 |
| Profile | 1 |
| Wallet | 1 |
| Category | 17 |
| Transaction | 0 |
| Goal | 0 |
| Budget | 0 |
| Smart category rule | 0 |
| Smart wallet rule | 0 |
| Chat message | 0 |
| Chat attachment | 0 |

Database masih dalam keadaan hampir kosong. Pemeriksaan orphan record untuk semua relasi utama bernilai nol. Tidak ditemukan profile tanpa auth user, auth user tanpa profile, transaksi dengan owner/wallet/category yang salah, budget dengan owner category yang salah, duplicate normalized category, duplicate active wallet, amount transaksi tidak valid, goal progress tidak valid, atau budget limit tidak valid.

### RLS, Grant, Function, dan Constraint

- Sepuluh tabel aplikasi utama ada dan RLS aktif pada semuanya: `profiles`, `wallets`, `categories`, `transactions`, `goals`, `budgets`, dua tabel smart rule, serta dua tabel chat.
- Tidak ada anonymous write grant dan tidak ada role publik yang mempunyai `CREATE` pada schema `public`.
- Policy user ownership tersedia untuk seluruh tabel utama. RLS tidak memakai `FORCE ROW LEVEL SECURITY`; ini normal untuk owner/service role, tetapi berarti owner tetap dapat bypass RLS.
- Grant tabel sesuai arsitektur: kategori, budget, chat, dan attachment dapat ditulis user terautentikasi; perubahan wallet/transaksi/goal diarahkan ke RPC.
- RPC finansial kritis memakai `SECURITY DEFINER` dengan `search_path` eksplisit. Tidak ditemukan RPC kritis dengan `search_path` yang hilang.
- Constraint penting tersedia: amount transaksi dan target/budget harus positif, enum/status dibatasi, foreign key memakai aturan delete yang jelas, nama category unik secara normalized per user, budget unik per category/user, serta active wallet dan active goal dilindungi unique index.
- Index utama tersedia untuk transaksi berdasarkan user/waktu, bucket/waktu, dan wallet; chat berdasarkan user/waktu; goal/wallet aktif; serta smart rules berdasarkan user/keyword.

### Migration

- Terdapat 9 migration terdaftar. Migration terbaru adalah `20260728100000_harden_category_integrity.sql`.
- Delapan migration setelah baseline memiliki checksum database yang cocok dengan isi repo setelah line ending dinormalisasi ke LF.
- Checksum `20260727160000_neon_baseline.sql` tidak cocok walaupun sudah dinormalisasi ke LF. Ini menunjukkan baseline saat ini berbeda dari versi yang dicatat di production, atau checksum production pernah direkam dari isi lain.
- Migration runner menghitung hash dari isi file mentah. Pada checkout Windows dengan CRLF, semua checksum lokal berbeda dari checksum production LF. Artinya workflow migration saat ini tidak stabil lintas OS dan dapat menolak migration yang sebenarnya tidak berubah.

### Temuan Keamanan Live

1. **Tinggi — `schema_migrations` dapat dimodifikasi user terautentikasi.** Tabel ini tidak memakai RLS dan role `authenticated` memiliki `SELECT`, `INSERT`, `UPDATE`, dan `DELETE`. Melalui Data API, user aplikasi yang login secara teori dapat memalsukan atau menghapus catatan migration dan mengganggu deployment berikutnya. Aplikasi tidak membutuhkan akses ini.
2. **Tinggi — migration baseline drift dan checksum sensitif line ending.** Kondisi ini dapat memblokir penerapan migration baru dan membuat hasil audit berbeda antara Windows dan Linux.
3. **Sedang — Neon Auth menerima signup publik tanpa verifikasi email.** Dashboard menyatakan siapa pun di web dapat mendaftar; `Sign-up with Email` aktif dan `Verify at Sign-up` nonaktif. Ini membuka risiko akun palsu, spam, dan penyalahgunaan resource.
4. **Sedang — localhost diizinkan pada Auth production.** `Allow Localhost` masih aktif, padahal dashboard sendiri menyarankan hanya mengaktifkannya untuk local development.
5. **Sedang — trusted domain terlalu banyak.** Selain domain utama, beberapa deployment preview Vercel lama masih dipercaya. Domain yang sudah tidak dipakai sebaiknya dilepas.
6. **Sedang — CORS Data API belum memiliki allowlist eksplisit.** Field `CORS allowed origins` kosong pada konfigurasi production. Perilaku default perlu dipastikan dan sebaiknya dibatasi ke origin aplikasi yang aktif.
7. **Sedang — restore window hanya 6 jam.** Untuk ledger finansial, periode ini terlalu pendek bila terjadi bug destructive, credential compromise, atau kesalahan user yang terlambat diketahui.
8. **Rendah — Data API mengekspos seluruh schema `public`.** Ini mencakup `schema_migrations`; OpenAPI memang nonaktif dan anonymous write grant kosong, tetapi schema internal yang tidak dibutuhkan frontend sebaiknya tidak diberi akses aplikasi.

### Prioritas Perbaikan Backend

1. Buat migration baru yang mencabut seluruh privilege `authenticated`/`anonymous` dari `public.schema_migrations`; sisakan akses hanya untuk role migration/owner. Jangan mengedit migration lama yang sudah diterapkan.
2. Tetapkan strategi untuk baseline checksum yang drift, lalu ubah runner agar menormalisasi `CRLF` ke `LF` sebelum hashing. Tambahkan test checksum lintas OS.
3. Aktifkan verifikasi email, matikan `Allow Localhost` pada branch production, dan bersihkan trusted Vercel preview domains yang sudah tidak aktif.
4. Batasi CORS Data API ke domain production yang benar-benar digunakan.
5. Evaluasi retention/backup yang lebih panjang sebelum aplikasi menyimpan transaksi nyata.
6. Tambahkan integration test database yang menguji RLS sebagai `authenticated` dan `anonymous`, bukan hanya sebagai database owner.

Status keseluruhan: schema aplikasi dan integritas relasi dalam kondisi sehat, tetapi hardening migration tracking dan konfigurasi Auth/Data API harus diselesaikan sebelum aplikasi dibuka lebih luas.

## Remediasi 29 Juli 2026

Perbaikan berikut sudah diterapkan:

- Migration `20260729120000_harden_migration_tracking.sql` diterapkan ke branch production. Seluruh privilege `PUBLIC`, `anon`, `anonymous`, `authenticated`, dan `service_role` pada `public.schema_migrations` sudah dicabut; hanya database owner yang tersisa.
- Migration production tercatat dengan checksum normalized `1f2661bfde282afb1b2b9335f6aecb4d0bad108ccfe9c67546786bcb32de54ef`.
- Migration runner dan backend auditor memakai normalisasi `CRLF`/`CR` ke `LF` sebelum SHA-256.
- Drift baseline ditangani dengan compatibility pair yang memerlukan kecocokan exact antara checksum production lama dan baseline repo saat ini. Catatan production tidak ditulis ulang dan migration lama tidak diedit.
- Test checksum lintas line ending dan pin baseline ditambahkan.
- Integration test PostgreSQL ditambahkan untuk role `authenticated` dan `anonymous`, termasuk skenario JWT subject asing. Uji manual production mengonfirmasi user terautentikasi hanya melihat row miliknya dan tidak melihat profile asing, sedangkan anonymous mendapat `SQLSTATE 42501`.
- `Verify at Sign-up` aktif menggunakan verification code dan `Allow Localhost` nonaktif pada Auth production.
- Lima trusted Vercel preview domains dihapus. Trusted domain yang tersisa hanya `https://pocket.kurousagi.web.id` dan `https://pocket-kurogi-olive.vercel.app`.
- Allowlist CORS Data API disimpan untuk dua origin production tersebut. Namun verifikasi preflight sesudah propagasi masih mengembalikan `Access-Control-Allow-Origin: *` untuk origin valid maupun origin palsu. Konfigurasi dashboard sudah benar, tetapi enforcement efektif pada endpoint Neon Data API Beta belum terbukti.

### Keputusan retention/backup

- Plan Free hanya menyediakan history window maksimal 6 jam.
- Backup & Restore mendukung snapshot manual, tetapi schedule snapshot membutuhkan upgrade.
- Paid plan menyediakan history window hingga 30 hari. Plan Launch sudah mencukupi dan pada saat evaluasi menampilkan harga usage-based `$0.106/CU-hour`, `$0.35/GB-month` database storage, dan `$0.20/GB-month` instant restore.
- Rekomendasi: gunakan minimal 7 hari selama beta tertutup dan 30 hari sebelum menerima transaksi finansial nyata. Pada ukuran database saat ini sekitar 0,03 GB, komponen instant-restore storage sangat kecil; biaya compute usage tetap perlu dipantau.
- Upgrade belum dilakukan karena memerlukan aktivasi billing. Selama masih di Free Plan, buat snapshot manual sebelum setiap migration atau perubahan destructive penting dan simpan backup logical terenkripsi di luar Neon secara berkala.

Status setelah remediasi: temuan keamanan migration tracking, verifikasi email, localhost production, dan trusted preview domains sudah ditutup. Dua pekerjaan operasional masih tersisa sebelum penggunaan nyata: aktivasi paid retention/backup dan penyelesaian wildcard CORS pada endpoint, baik melalui perbaikan Neon maupun gateway backend yang menegakkan allowlist.
