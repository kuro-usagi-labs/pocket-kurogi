# Audit chat dan penyesuaian saldo — 23 September 2026

## Perbaikan

- Kategori transaksi lama tidak lagi terbawa ketika intent berganti. Reproduksi: pengeluaran kategori Jajan, kemudian pemasukan dengan klarifikasi lanjutan. Fallback kategori juga mengikuti jenis transaksi.
- Saldo akhir dapat disesuaikan melalui Dompet → Sesuaikan saldo atau chat, misalnya `edit saldo Tunai menjadi 400rb`. Nilai lama dan baru ditampilkan sebelum konfirmasi, termasuk dua angka desimal.
- Koreksi draft saldo menolak instruksi negatif, ambigu, hipotetis, beberapa nominal, serta presisi berlebih. Draft lama tidak diubah saat koreksi tidak aman.
- RPC saldo memeriksa pemilik, dompet aktif, saldo awal yang masih cocok, dan idempotency key; penyesuaian disimpan pada audit tersendiri, bukan transaksi pemasukan/pengeluaran.
- Composer langsung dikosongkan, mencegah pengiriman ganda, serta memulihkan draft gagal tanpa menimpa ketikan baru.
- Chat membuka pesan terbaru, mengikuti pengiriman sendiri, mempertahankan posisi baca saat melihat pesan lama, dan menyediakan tombol kembali ke bawah. Animasi menghormati reduced-motion.
- Modal saldo mendukung fokus keyboard, Escape, dan mencegah penutupan/pengiriman ulang saat penyimpanan berjalan.

## Verifikasi

- `npm test -- --maxWorkers=1 --pool=threads`: 1.005 lulus, 23 dilewati (integrasi yang memerlukan koneksi database khusus).
- `npm run lint` dan `npm run build`: berhasil.
- `npm ci --dry-run --ignore-scripts --no-audit`: berhasil; peringatan peer dependency upstream Neon Auth masih ada.
- `npm audit --omit=dev`: 0 kerentanan setelah pembaruan lockfile non-breaking.
- Audit lengkap masih melaporkan 31 temuan pada tooling pengembangan/deployment (1 low, 10 moderate, 19 high, 1 critical). Tidak menerapkan `--force` karena mengusulkan perubahan breaking pada Vercel CLI.
- Migrasi `20260923020000_wallet_balance_adjustments.sql` diterapkan di Neon production. Uji SQL fixture dengan rollback berhasil untuk saldo akhir, nol, replay, stale balance, kepemilikan, izin audit, dan pemisahan analitik. Saldo pengguna tidak dipakai sebagai objek mutasi uji.
- Browser lokal: teks langsung kosong saat balasan tertunda; modal memperlihatkan Rp400.000,01 dan menyimpan fixture; Escape saat sibuk diabaikan; fokus kembali ke menu dompet; scroll awal tepat di bawah dan scroll naik tidak dipaksa kembali; lebar mobile 390px tanpa overflow horizontal; mode gelap diperiksa.

## Batasan

- Ini audit terarah pada alur chat, kategori, saldo, dan build, bukan jaminan seluruh aplikasi bebas bug.
- Pengujian UI menggunakan data demo lokal, bukan perubahan saldo akun produksi. Pengujian SQL produksi dibatalkan melalui rollback.
- Draft transaksi lama yang telanjur menyimpan kategori salah tidak diputar ulang otomatis; batalkan draft tersebut dan kirim permintaan baru.
- Log penyesuaian tersimpan di database; belum ada halaman riwayat penyesuaian khusus.
