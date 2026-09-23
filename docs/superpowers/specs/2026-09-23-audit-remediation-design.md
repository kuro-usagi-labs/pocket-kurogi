# Rancangan perbaikan menyeluruh Pocket Kurogi

## Tujuan dan cakupan

Menindaklanjuti seluruh temuan audit 23 September 2026: membuat data keuangan dapat dipercaya, percakapan konsisten, dan perubahan aplikasi dapat diuji sebelum rilis. Pengguna meminta seluruh temuan diperbaiki. Stack React, Vercel, Neon, dan Gemini dipertahankan; tidak ada perpindahan layanan, pembelian layanan, atau penambahan fitur di luar audit.

Rancangan ini menunggu tinjauan pengguna. Belum merupakan implementasi atau klaim bahwa masalah sudah selesai.

## Pendekatan

Pilihan yang direkomendasikan adalah perbaikan bertahap pada sistem yang ada: bug data terlebih dahulu, kontrak pemahaman bahasa berikutnya, kemudian UI dan pengamanan rilis. Menambal pola kalimat saja lebih kecil tetapi mempertahankan penafsiran ganda. Menulis ulang seluruh aplikasi lebih berisiko dan tidak diperlukan.

Setiap tahap harus tetap dapat dijalankan dan diuji sendiri. Migrasi database harus kompatibel dengan aplikasi yang masih berjalan selama rollout. Tidak mengubah saldo atau menghapus data pengguna untuk pengujian.

## 1. Keakuratan data dan jadwal

### Laporan

Pisahkan status loading, success-empty, success-data, stale, dan error. Kegagalan request tidak boleh menghasilkan angka nol seolah data berhasil dimuat. Simpan snapshot sukses terakhir beserta waktu sinkronisasinya untuk pengguna yang sama; tampilkan peringatan dan tombol coba lagi ketika refresh gagal. Jika belum pernah berhasil, tampilkan keadaan gagal, bukan angka finansial.

Respons terlambat dari sesi sebelumnya tidak boleh menimpa data sesi baru. Logout atau perubahan pengguna menghapus snapshot lokal. Ringkasan dan chat tidak boleh memberikan kesimpulan finansial dari data gagal atau tidak lengkap.

### Riwayat

Pagination menggunakan pasangan unik `(created_at, id)` dengan pengurutan konsisten. Halaman selanjutnya mengambil timestamp lebih lama, atau timestamp sama dengan ID lebih kecil. Pertahankan deduplikasi dan cegah request halaman lama menimpa refresh baru. Antarmuka membedakan riwayat kosong dari gagal dimuat.

### Jadwal bulanan

Hitung setiap tanggal dari tanggal acuan jadwal, bukan hasil bulan sebelumnya. Tanggal 31 Januari menjadi 28 Februari, 31 Maret, 30 April. Tanggal 30 Januari menjadi 28 Februari, 30 Maret. Tidak otomatis mengubah tanggal 28 menjadi aturan akhir bulan. Uji tahun kabisat, pergantian tahun, jadwal mingguan, dan tanggal lokal.

## 2. Kontrak pemahaman bahasa

Pisahkan pemrosesan chat dari komponen tata letak AppShell. Komponen hanya mengoordinasikan input, tampilan, dan hasil; modul percakapan memiliki jalur keputusan yang dapat diuji.

Gemini menghasilkan proposal terstruktur, bukan kalimat perintah yang diparsing ulang. Proposal berisi intent yang diizinkan, kutipan nominal/tanggal dari pesan, referensi dompet/tabungan, dan informasi yang masih kurang. Backend memetakan referensi ke data milik pengguna dan membentuk perintah domain yang juga dipakai mesin deterministik.

Daftar kemampuan dibagikan antara interpreter dan mesin, termasuk set_wallet_balance. Tidak menerima SQL, nama fungsi bebas, atau klaim keberhasilan dari model. Nilai angka harus dibuktikan dari pesan; referensi tidak jelas meminta klarifikasi. Nominal, kepemilikan, jenis kategori, tanggal, negasi, dan ambiguitas diperiksa kembali sebelum staging dan eksekusi.

Konteks Gemini dibatasi pada ringkasan percakapan yang relevan: intent aktif, field terisi, field yang kurang, referensi entitas, dan beberapa giliran terbaru. Jangan mengirim seluruh riwayat, kredensial, atau data finansial yang tidak diperlukan. Teks pengguna dan nama entitas tetap data tidak tepercaya.

Perintah deterministik yang sudah jelas dapat langsung menghasilkan proposal tanpa menunggu Gemini. Gemini membantu bahasa bebas dan klarifikasi lanjutan. Kedua jalur melewati validasi, draft tersimpan, konfirmasi, dan eksekutor yang sama. Konfirmasi setelah koreksi harus memperlihatkan nilai terbaru; draft lama tidak boleh dieksekusi ulang. Fallback tetap bekerja tanpa Gemini.

## 3. Kuota dan pemulihan Gemini

Pisahkan pembatasan per pengguna, kapasitas provider, dan cooldown kegagalan. Satu request pengguna tidak boleh otomatis membuat seluruh pengguna kehilangan AI selama 24 jam.

Untuk limit sementara dan kegagalan server, gunakan jeda bertahap dengan jitter dan batas percobaan; hormati informasi retry provider yang valid dengan batas atas aman. Kuota harian menggunakan masa pemulihan yang berbeda. Kesalahan konfigurasi tidak dicoba berulang setiap pesan dan dicatat sebagai status operasional.

Jika detail provider tidak cukup untuk menentukan jenis limit, gunakan cooldown konservatif yang terbatas, bukan menyimpulkan kuota harian. Setiap giliran tetap memperoleh balasan fallback. Pembatasan dipersistenkan agar konsisten antarkerja Vercel. Pengguna mendapat pesan ringkas tentang keterbatasan bila memengaruhi kemampuan, tanpa pesan teknis atau kunci API.

## 4. Konfirmasi, status chat, dan audit saldo

Sediakan kartu konfirmasi sesuai aksi. Pemasukan/pengeluaran menampilkan nominal, dompet, kategori, keterangan, dan tanggal. Transfer menampilkan sumber serta tujuan. Penyesuaian saldo menampilkan saldo sebelum, sesudah, dan selisih dengan penjelasan bahwa ini bukan pemasukan/pengeluaran. Nol dan pecahan rupiah tetap terlihat benar.

Pisahkan status pesan (mengirim, tersimpan, gagal) dari status aksi finansial (menunggu konfirmasi, diproses, berhasil, gagal, kedaluwarsa). Timeout tidak dianggap bukti bahwa transaksi gagal: periksa hasil dengan identitas aksi yang sama sebelum mencoba lagi. Retry tidak membuat transaksi ganda. Kegagalan penyimpanan balasan setelah transaksi berhasil tidak boleh meminta pencatatan ulang.

Tambahkan riwayat penyesuaian pada dompet dengan waktu, saldo lama, saldo baru, dan selisih. Daftar hanya memuat data pengguna yang masuk dan memakai pagination. Tidak menambahkan penyesuaian ke pendapatan atau pengeluaran. Tidak menyediakan undo otomatis yang dapat menimpa transaksi lebih baru; koreksi dilakukan sebagai penyesuaian baru dengan konfirmasi saldo terbaru.

Gunakan satu formatter nominal untuk nilai finansial yang presisi, maksimal dua desimal dan tanpa desimal tambahan jika tidak ada. Format ringkas hanya untuk konteks yang diberi label jelas. Pertahankan warna putih-hijau, dark mode, keyboard focus, ukuran sentuh, reduced-motion, dan tampilan mobile tanpa overflow.

## 5. Keamanan, pengujian, dan rilis

Telusuri temuan dependency ke paket induknya. Perbarui tooling ke versi kompatibel yang sudah ditambal, atau keluarkan deployment CLI dari dependency aplikasi jika tidak diperlukan saat build. Jangan memakai audit fix --force tanpa pemeriksaan kompatibilitas. Temuan yang belum bisa dihilangkan harus dilaporkan beserta paparan dan alasan, bukan ditutup sebagai selesai.

Tambahkan CI untuk clean install, lint, unit/regression test, build, dan browser end-to-end. Pengujian database menggunakan database/branch khusus dengan data sintetis, bukan production. Job integrasi wajib membedakan tidak dikonfigurasi, dilewati, gagal, dan berhasil; jangan menghitung tes yang dilewati sebagai cakupan lulus. Secret CI harus berasal dari pengaturan layanan, tidak dari git.

Pengujian browser lokal menggunakan fixture terkontrol. Uji integrasi backend dan alur autentikasi nyata dilakukan di lingkungan pengujian ketika akses tersedia. Jika konfigurasi lingkungan tersebut belum tersedia, tulis kebutuhan konfigurasi dan laporkan bagian yang belum diverifikasi secara eksplisit.

Telemetry mencatat request ID, tahap kegagalan, latensi, pemakaian fallback, dan hasil aksi tanpa teks percakapan, token, atau rincian finansial sensitif. Bukti keberhasilan finansial berasal dari hasil database.

## Kriteria penerimaan

- Error laporan tidak ditampilkan sebagai angka nol; retry dan perubahan sesi aman.
- Seluruh transaksi bertimestamp sama dapat diakses tanpa hilang atau berulang.
- Jadwal bulanan mempertahankan tanggal acuannya setelah Februari.
- Bahasa bebas dan mesin memakai satu kontrak perintah; tidak ada reparsing teks hasil Gemini pada jalur baru.
- Klarifikasi lintas giliran, pergantian intent, negasi, dompet ambigu, nominal nol, serta pembatalan memiliki regression test.
- Dua pengguna tidak saling memblokir tanpa alasan kapasitas provider; fallback dan cooldown diuji tanpa memanggil API berbayar.
- Setiap aksi menampilkan ringkasan terbaru dan hanya dieksekusi sesuai konfirmasi.
- Riwayat penyesuaian dapat dilihat tanpa mencemari laporan transaksi.
- Pengiriman ulang setelah timeout tidak menggandakan transaksi.
- CI, clean install, lint, build, serta tes yang tersedia berhasil; batasan lingkungan dan temuan keamanan tersisa dijelaskan.

## Urutan pelaksanaan

1. Perbaikan data laporan, pagination, jadwal, dan regresinya.
2. Kontrak perintah bersama, pemisahan alur chat, konteks Gemini, dan kebijakan kuota.
3. Kartu konfirmasi, status terpisah, formatter, dan riwayat penyesuaian.
4. Dependency, CI, integrasi database pengujian, browser QA, review, dan rilis terverifikasi.

## Asumsi dan batas

Penghapusan permanen akun tetap mengikuti kebijakan pengguna; rancangan ini tidak memperkenalkan penyimpanan data tanpa batas. Detail akses branch Neon pengujian dan secret CI perlu diverifikasi saat pelaksanaan. Tidak menganggap izin deploy sebagai izin membeli layanan, mengubah paket berbayar, atau menghapus data produksi. Hasil akhir melaporkan setiap butir secara terpisah sebagai selesai, terverifikasi, atau terhalang konfigurasi.
