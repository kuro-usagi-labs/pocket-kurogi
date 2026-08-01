# Local Finance Assistant

Pocket Kurogi memakai mesin pemahaman keuangan deterministik tanpa model eksternal, API AI, atau API key. Sistem ini khusus untuk domain pencatatan dan analisis keuangan, bukan chatbot pengetahuan umum.

## Cara kerja

Pesan diproses berlapis:

1. Normalisasi bahasa Indonesia informal dan typo umum.
2. Context resolver memulihkan slot dan pertanyaan aktif dari Neon.
3. Intent router memberi skor dari gabungan kata kerja, nominal, waktu, dompet, negasi, pertanyaan, dan pending action.
4. Entity extractor memisahkan nominal, kuantitas, dompet, kategori, merchant, tanggal, kepemilikan, serta bentuk hipotetis.
5. Slot resolver menggabungkan entitas baru dengan slot percakapan sebelumnya.
6. Dialogue manager memilih klarifikasi, query, kalkulasi, atau pending action.
7. Safety validator memblokir pertanyaan, rencana, negasi, transaksi pihak ketiga, mata uang asing, dan interpretasi ambigu.
8. Query keuangan mengambil data aktual melalui Vercel Function.
9. Mutation disimpan sebagai pending action dan baru dijalankan setelah konfirmasi.

Skor intent hanya memberi sinyal routing. Keputusan yang mengubah saldo tetap dijaga aturan deterministik berpresisi tinggi.

## Arsitektur modular

Implementasi utama berada di `src/lib/assistant/`:

- `unifiedAssistantOrchestrator.js` membangun satu semantic frame dan satu
  keputusan final tanpa pemilihan atau fallback antar-engine;
- `semanticFrame.js` menyatukan intent, dialogue act, slot, referensi, safety,
  action, serta provenance executor aktual;
- `referenceResolver.js` menyelesaikan rujukan seperti `yang tadi`, `yang
  biasa`, dan `dompet satunya` hanya ketika konteksnya cukup kuat;
- `assistantEngine.js` mengorkestrasi pipeline tanpa melakukan I/O;
- `intentRouter.js` dan `intentDefinitions.js` menentukan skor dan kontrak slot;
- resolver entity menangani uang, tanggal, dompet, kategori, dan target;
- `dialogueManager.js` serta `conversationContext.js` mengelola percakapan bertahap;
- `pendingActionManager.js` membuat hash payload dan idempotency key;
- `financialInsights.js` menghitung insight hanya dari data backend;
- `responseComposer.js` menyusun respons dan card secara deterministik;
- `assistantMemory.js` hanya menerima jenis preferensi yang diizinkan;
- `memoryLifecycle.js` menjaga alur `observed -> proposed -> confirmed ->
  active`, scope akun, koreksi, pelupaan, dan penolakan pelajaran berbahaya;
- `responsePlanner.js` memilih struktur serta tingkat keringkasan respons tanpa
  mengubah fakta keuangan;
- `financeReasoningEngine.js` menghasilkan rekomendasi hanya dari snapshot
  database dan tidak mengarang saldo atau transaksi;
- `safetyValidator.js` adalah gerbang terakhir sebelum pending action.

`src/hooks/useDeterministicAssistant.js` menghubungkan engine murni dengan
`/api/assistant`. Specialist extractor hanya menghasilkan kandidat beserta
confidence dan evidence; keputusan akhir tetap dibuat oleh policy canonical.

Preferensi yang tampak eksplisit tidak langsung dianggap benar. Asisten
menampilkan pemahamannya, meminta konfirmasi terpisah, dan baru menyimpan
preferensi setelah jawaban afirmatif yang berdiri sendiri. Permintaan sekali
pakai seperti `jelaskan lebih detail` tidak otomatis menjadi kebiasaan permanen.
Aturan istilah seperti `kalau aku bilang kantor, pakai dompet BCA` tetap
dipisahkan dari preferensi dompet default.

## State dan pending action

Dialogue state, memory terkurasi, dan pending action disimpan di Neon. State
memiliki masa berlaku; respons singkat seperti `BCA saja`, `Iya catat`, `Ubah`,
atau `Batal` diselesaikan terhadap state tersebut.

```text
interpretasi -> validasi -> pending -> konfirmasi -> RPC server -> transaction DB
```

Konfirmasi membawa `actionId` dan hash payload. RPC mengunci row pending action,
memvalidasi ownership dari JWT subject, dan mengembalikan hasil lama pada replay
sehingga klik ganda tidak menulis transaksi dua kali.

## Pemahaman Bahasa Indonesia yang aman

Asisten memakai grammar guard sebelum hasil parser boleh menyentuh ledger. Izin menulis hanya diberikan ketika semua syarat berikut terpenuhi:

- ada instruksi pencatatan yang eksplisit;
- transaksi dinyatakan sudah terjadi, bukan rencana, syarat, contoh, atau pertanyaan;
- uang tersebut milik pengguna, bukan dibayar pihak lain;
- nominal final menggunakan IDR dan setiap item mempunyai nominal yang tidak ambigu;
- jenis pemasukan/pengeluaran, waktu, serta dompet dapat ditentukan;
- tidak ada negasi, pilihan `atau`, perkiraan, pengecualian draft, atau referensi tanpa konteks.

Normalisasi lokal memahami variasi informal seperti `ngga`, `jgn`, `catetin`, `pake`, angka-kata seperti `dua puluh ribu` dan `setengah juta`, serta slang nominal stabil seperti `goceng`, `ceban`, dan `gocap`. `Rp20` tetap dibaca literal sebagai dua puluh rupiah; angka `20` tanpa penanda mata uang tidak langsung diasumsikan benar tanpa konfirmasi atau anchor nominal lain di pesan yang sama.

Jika struktur masih ambigu, balasan selalu dimulai dengan status bahwa belum ada transaksi yang dicatat, lalu menyebutkan satu alasan atau pertanyaan yang harus diselesaikan. Classifier boleh membantu routing, tetapi confidence classifier tidak pernah dapat melewati grammar guard.

Draft baru memakai status review versi 2 dan menyimpan evidence serta alasan ambiguitas. Pemilihan dompet saja tidak lagi langsung mendebit saldo; asisten menampilkan pemahaman final dan menunggu instruksi pencatatan.

Gate yang sama berlaku untuk semua mutasi dari chat: transaksi tunggal/batch, transfer antar-dompet, setoran atau pencairan target, pembuatan target/dompet, perubahan dompet, koreksi, dan pembatalan transaksi terakhir. Lapisan UI hanya meneruskan mutasi yang telah menjadi pending action backend dan tetap membutuhkan konfirmasi eksplisit.

Jawaban singkat `Ya` hanya dapat mengonfirmasi satu jenis ambiguitas yang terstruktur, yaitu nominal tanpa satuan yang sebelumnya dirangkum sebagai ribuan rupiah. Mata uang asing, tanggal yang tidak didukung, kalimat contoh/hipotetis, kepemilikan pihak ketiga, subset draft, dan alasan lain tidak dapat dilewati melalui konfirmasi singkat; pengguna harus menulis ulang transaksi final.

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

Asisten menjawab Rp14.000 dan menyimpan konteks di dialogue state backend, tetapi belum mengubah saldo. Pesan berikutnya dapat berupa:

```text
oke, catat pengeluaran tadi
```

Jika dompet belum pasti, asisten meminta dompet lalu melanjutkan state yang sama. State dan pending action tersimpan di backend sehingga tetap dapat dilanjutkan setelah refresh selama belum kedaluwarsa.

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

Migration assistant berikutnya menambahkan state percakapan, memory, pending
action, koreksi payload, dan executor perubahan target tabungan:

- `20260729220000_add_deterministic_assistant_state.sql`
- `20260729230000_add_pending_action_corrections.sql`
- `20260729240000_add_saving_goal_pending_executor.sql`

Endpoint `/api/assistant` memverifikasi JWT memakai JWKS Neon Auth. `userId` dari
body browser diabaikan; seluruh query memakai subject token. Origin diperiksa
terhadap allowlist exact-match dan query SQL selalu diparameterisasi.

## Corpus dan pengembangan

Corpus canonical berada di `src/lib/assistant/indonesianEvaluationCorpus.js`
dan memuat sedikitnya 550 tuturan. Setiap intent memiliki contoh bahasa informal
dan hard negative. Untuk menambah kemampuan:

1. Tambahkan utterance yang benar-benar berbeda, bukan duplikat kecil.
2. Tambahkan hard negative yang mirip tetapi tidak boleh menulis transaksi.
3. Tambahkan test parser untuk nominal, peran uang, kategori, dan keputusan write/no-write.
4. Pertahankan aturan bahwa confidence classifier tidak pernah cukup untuk melewati safety gate.

Corpus regresi dijalankan melalui harness
`indonesianEvaluationHarness.js`. Kasusnya mencakup slang, typo, negasi,
hipotesis, transaksi pihak ketiga, rujukan multi-turn, transaksi jamak,
teaching, forgetting, dan percobaan write yang harus ditolak.

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
