# Local Finance Assistant

Pocket Kurogi memakai mesin pemahaman keuangan lokal tanpa model eksternal, API AI, atau API key. Mesin ini memang dilatih untuk domain pencatatan keuangan, bukan chatbot pengetahuan umum.

## Cara kerja

Pesan diproses berlapis:

1. Normalisasi bahasa Indonesia informal dan typo umum.
2. Classifier Naive Bayes lokal mengenali dialogue act dari corpus bawaan.
3. Semua nominal diekstrak beserta posisi dan perannya: harga item, uang bayar, atau kembalian.
4. Klausa diubah menjadi satu atau beberapa draft transaksi.
5. Constraint solver memeriksa aritmetika dan kelengkapan dompet.
6. Safety gate memastikan pertanyaan tidak menulis ledger tanpa maksud pencatatan.
7. Transaksi multi-item dikirim ke RPC PostgreSQL yang atomik dan idempoten.

Classifier hanya memberi sinyal intent. Keputusan yang mengubah saldo tetap dijaga aturan deterministik berpresisi tinggi.

## Percakapan yang didukung

### Multi-item

```text
tadi beli bensin 20 dan makanan 10 pakai uang 50rb, tolong catat
```

Hasilnya adalah dua pengeluaran, Rp20.000 untuk Bensin dan Rp10.000 untuk Makan. Rp50.000 dikenali sebagai uang bayar dan Rp20.000 sebagai kembalian tersirat.

### Hitung lalu catat

```text
tadi ke Alfamart jajan pakai uang 50rb, kembali 36rb, berarti habis berapa?
```

Asisten menjawab Rp14.000 dan menyimpan draft, tetapi belum mengubah saldo. Pesan berikutnya dapat berupa:

```text
oke, catat pengeluaran tadi
```

Jika dompet belum pasti, asisten meminta dompet lalu melanjutkan draft yang sama. Draft tersimpan di metadata chat sehingga tetap bisa dipulihkan setelah refresh selama belum kedaluwarsa.

### Runway saldo

```text
dompet tinggal 200rb buat sebulan, sebaiknya gimana?
```

Asisten menghitung runway, menahan cadangan kebutuhan, dan memprioritaskan makan dasar, bensin/transport kerja, kesehatan, serta tagihan wajib. Pada kondisi ketat, Jajan, Kopi, dan Hiburan disarankan untuk dihentikan sementara.

## Jaminan backend

Migration `20260729210000_add_atomic_assistant_transaction_batches.sql` menambahkan:

- `record_transactions_batch(request_id, items)` untuk commit seluruh item dalam satu transaksi database;
- validasi kepemilikan dompet dan kategori;
- batas 1–20 item dengan nominal positif;
- idempotency ledger privat agar retry request yang sama tidak mendebit ulang;
- privilege eksekusi hanya untuk `authenticated` dan `service_role`;
- penolakan akses langsung ke idempotency ledger untuk role aplikasi.

Migration harus diterapkan sebelum frontend yang memakai transaksi batch dideploy.

## Corpus dan pengembangan

Corpus berada di `src/lib/financeIntentClassifier.js`. Setiap intent memiliki contoh bahasa informal dan hard negative. Untuk menambah kemampuan:

1. Tambahkan utterance yang benar-benar berbeda, bukan duplikat kecil.
2. Tambahkan hard negative yang mirip tetapi tidak boleh menulis transaksi.
3. Tambahkan test parser untuk nominal, peran uang, kategori, dan keputusan write/no-write.
4. Pertahankan aturan bahwa confidence classifier tidak pernah cukup untuk melewati safety gate.

## Verifikasi

```bash
npm test
npm run lint
npm run build
```

Integration test database dijalankan terhadap branch Neon yang sudah menerima migration:

```bash
TARGET_DATABASE_URL=... npm run test:db
```

Test database mencakup commit multi-item, rollback penuh saat saldo tidak cukup, replay idempoten, payload mismatch, privilege tabel privat, dan penolakan role anonymous.
