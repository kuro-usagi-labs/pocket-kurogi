# Next Development Plan

Dokumen ini merangkum audit keseluruhan web app Pocket Kurogi dan daftar pengembangan berikutnya. Fokusnya adalah membuat app terasa lebih cepat, lebih tenang, lebih bisa dipercaya, dan lebih nyaman dipakai berulang, tanpa sekadar menambah style.

## Ringkasan Audit

Pocket Kurogi sudah punya pondasi produk yang kuat. Fitur inti jelas: chat AI untuk mencatat transaksi, transfer antar dompet, target tabungan, analitik, input gambar, dan input suara. Area yang paling perlu disempurnakan berikutnya adalah kualitas pengalaman, struktur kode, confidence bot, dan polish desktop/mobile.

Prioritas utama bukan lagi hanya "membuat tampilan bagus", tetapi:

- Membuat alur finansial lebih aman dan jelas.
- Membuat chat terasa benar-benar pintar dan dapat dipercaya.
- Mengurangi elemen visual atau teks yang tidak membantu user.
- Memisahkan tanggung jawab kode agar fitur baru lebih mudah ditambah.
- Memastikan desktop dan mobile punya pengalaman yang sesuai perangkatnya.

## Prioritas Tinggi

- Pecah `src/components/Layout/AppShell.jsx` yang sudah terlalu besar. Saat ini file ini memegang routing tab, chat intent, dialog konfirmasi, wallet/goal actions, error mapping, dan orchestration data. Lebih sehat dipisah ke modul seperti `useFinancialActions`, `useChatIntentExecutor`, dan `AppRoutes`.
- Perbaiki pengalaman Chat sebagai layar utama. Hero desktop masih bisa dibuat lebih fungsional, dan quick action sebaiknya langsung mengarah ke aksi nyata seperti `Catat keluar`, `Catat masuk`, `Transfer`, dan `Analisa`.
- Tambahkan command suggestions yang kontekstual. Contoh: saat user belum punya dompet, tampilkan prompt untuk tambah dompet; saat saldo kosong, arahkan ke pemasukan; saat banyak kategori `Lainnya`, sarankan rapikan kategori.
- Buat confirmation flow lebih visual. Untuk aksi penting seperti hapus dompet, transfer, kontribusi target, dan transaksi besar, tampilkan ringkasan aksi sebelum eksekusi agar user lebih percaya.
- Perkuat empty states. Dompet kosong, transaksi kosong, goal kosong, dan analytics kosong harus punya CTA yang berbeda dan langsung berguna.
- Rapikan loading dan skeleton. Saat data awal dimuat, gunakan skeleton sesuai halaman, bukan spinner generik.
- Kurangi copywriting di seluruh desktop. Teks harus lebih condong menjadi label data dan aksi, bukan penjelasan panjang.
- Optimalkan bundle utama. Build masih memberi warning chunk besar. Penyebab utamanya kemungkinan `AppShell` dan imports inti. Ini bisa dikurangi dengan memecah logic dan lazy loading yang lebih bersih.
- Tambahkan visual QA desktop/mobile sebelum release. Cek minimal viewport 375px, 430px, 768px, 1024px, dan 1440px.
- Perjelas model mental user: Chat untuk input cepat, Histori untuk koreksi, Dompet untuk struktur uang, Analitik untuk keputusan.

## Polish UI/UX

- Desktop Dompet bisa dibuat lebih seperti workspace: list yang dense, summary kecil di atas, target sebagai side panel, dan card yang tidak terlalu besar.
- Desktop Analitik bisa dibuat lebih seperti dashboard: arus kas, tren, kategori, budget usage, dan rekomendasi singkat. Hindari panel yang berulang dengan right sidebar.
- Mobile perlu audit khusus spacing bawah karena chat input dan bottom dock rawan terasa sempit.
- Tambahkan indikator `last updated` kecil pada analytics agar user tahu data sudah sinkron.
- Tambahkan state `sedang menyimpan` pada transaksi, transfer, goal, rename, dan delete.
- Gunakan icon-only untuk aksi kecil seperti edit/hapus di desktop, dengan tooltip, agar tidak ramai.
- Tombol destructive harus konsisten merah dan selalu lewat dialog konfirmasi.
- Perbaiki hierarchy font. Angka besar sudah cukup kuat, tetapi label kecil perlu lebih konsisten antar halaman.
- Kurangi border/shadow yang berulang di card bertumpuk. Pilih satu pola visual: border halus saja atau shadow halus saja.
- Tambahkan responsive table/list untuk Histori desktop, karena list transaksi desktop sebaiknya lebih padat dan mudah dipindai.

## Fitur Produk

- Undo transaksi terakhir dari UI, bukan hanya lewat chat intent.
- Edit transaksi: amount, dompet, kategori, catatan.
- Filter Histori berdasarkan dompet, kategori, tipe, dan range tanggal.
- Search yang lebih kuat di Histori dan Wallet.
- Budget management UI yang nyata, bukan hanya analytics membaca budget.
- Category management: rename kategori, merge kategori, dan rule otomatis.
- Recurring transaction: gaji bulanan, langganan, cicilan.
- Export data CSV/PDF.
- Import mutasi sederhana dari CSV atau screenshot.
- Insight mingguan/bulanan otomatis.
- Notifikasi saldo rendah atau budget lewat.
- Multi-wallet reconciliation: cek mismatch saldo ledger vs wallet.
- Archive/restore wallet dari UI yang mudah ditemukan.
- Onboarding pertama: buat dompet awal, tambah saldo, coba contoh transaksi.
- Mode `review hari ini` untuk koreksi transaksi sebelum final.

## Kecerdasan Bot

- Tambahkan memory preferensi user: dompet default, kategori default, dan pola merchant.
- Tambahkan confidence score internal untuk parsing. Kalau confidence rendah, bot harus tanya konfirmasi, bukan langsung menyimpan.
- Buat response bot lebih ringkas setelah aksi berhasil. Contoh: `Tercatat: Kopi -Rp25.000 dari BCA.`
- Pisahkan intent `bertanya` vs `mengeksekusi`. Pertanyaan analisis jangan sampai dianggap transaksi.
- Tambahkan parser untuk tanggal natural: `kemarin`, `tadi malam`, `minggu lalu`.
- Tambahkan koreksi natural: `yang tadi harusnya 80rb`, `ganti ke makan`, `hapus transaksi terakhir`.
- Tambahkan batch input: `hari ini makan 30rb, parkir 5rb, kopi 20rb dari tunai`.
- Tambahkan explainability singkat saat kategori otomatis dipilih.
- Tambahkan fallback AI yang lebih ramah saat Neon Function error.
- Simpan learning rule dari koreksi user, bukan hanya dari input awal.

## Kualitas Teknis

- Tambah test untuk action flows di `AppShell`, khususnya delete wallet, transfer, create wallet, dan create goal.
- Tambah test untuk edge cases parsing uang: `1.5jt`, `1,5 juta`, `rp 12.500`, `50k`.
- Tambah test untuk ambiguity wallet: misalnya `BCA` vs `BCA Bisnis`.
- Tambah E2E test minimal: login mock, catat transaksi, pindah tab, cek saldo berubah.
- Buat error boundary per view agar satu halaman error tidak menjatuhkan seluruh app.
- Audit aksesibilitas: aria-label icon button, focus state, keyboard navigation modal/menu.
- Audit keamanan upload gambar dan voice: ukuran, mime, cleanup object URL, dan error state.
- Tambah telemetry lokal untuk error penting, minimal console grouping yang rapi saat development.
- Kurangi penggunaan string panjang langsung di komponen; copy/domain text bisa dipindah ke helper.
- Review Neon RLS policies dan migration consistency, terutama wallet delete/archive.

## Urutan Eksekusi Terbaik

1. Refactor `AppShell` dan action orchestration.
2. Polish Chat UX sebagai core flow.
3. Polish Histori desktop.
4. Tambah edit/undo transaksi dari UI.
5. Perkuat bot confirmation dan correction flow.
6. Optimasi bundle dan loading.
7. Tambah test coverage untuk parsing dan aksi finansial.
8. Final visual QA desktop/mobile.

## Rekomendasi Langkah Berikutnya

Langkah paling berdampak berikutnya adalah kombinasi `AppShell refactor` dan `Chat UX polish`. Dua area ini akan membuat fitur baru lebih mudah ditambah, mengurangi risiko bug di alur finansial, dan langsung menaikkan kualitas pengalaman utama user.
