# Fondasi Assistant Kurogi

Dokumen ini mencatat kontrak runtime setelah konsolidasi P0. Tujuannya agar
pengembangan berikutnya tidak menambahkan jalur pengambilan keputusan baru.

## Jalur resmi satu pesan

1. `unifiedAssistantOrchestrator` menyelesaikan referensi percakapan.
2. `semanticFrame` menormalisasi pesan, mengekstrak entitas, memilih candidate
   intent, melengkapi slot, dan menjalankan pemeriksaan keamanan tepat sekali.
3. `assistantDecisionPolicy` menghasilkan satu keputusan final dengan
   `allowFallback: false`.
4. Handler terpilih menjalankan dialogue policy. Pipeline canonical memakai
   hasil ekstraksi dari semantic frame yang sama, bukan mem-parsing pesan lagi.
5. Semua mutasi canonical dibuat sebagai backend pending action. Eksekusi hanya
   dilakukan setelah konfirmasi dengan payload hash dan idempotency key.
6. Balasan canonical selalu disusun oleh `responseComposer`.

## Sumber kebenaran

- `assistant_dialogue_states` adalah sumber utama konteks percakapan.
- `pending_finance_actions` adalah satu-satunya objek canonical yang dapat
  mengeksekusi mutasi finansial.
- State React hanya cache dari backend.
- Draft mutasi lokal sudah dihapus. Hanya pending action backend yang dapat
  dilanjutkan, dikoreksi, dibatalkan, atau dikonfirmasi.

Dialogue state versi 2 menyimpan `conversationId`, `activeFrame`,
`missingSlots`, `pendingActionId`, `lastResolvedIntent`, dan
`referencedTransactionIds`.

## Status P3

- `localAssistant` dan `useLegacyIntentExecutor` sudah dihapus dari runtime;
- pemilihan engine lokal/deterministik dan seluruh fallback antar-engine sudah
  dihapus;
- pengajaran dan penghapusan aturan keyword kini diekstrak oleh specialist
  extractor, dipilih oleh decision policy tunggal, lalu disimpan sebagai aturan
  milik akun;
- aturan kategori dan dompet yang telah dipelajari ikut mengisi slot pada
  semantic frame canonical;
- pesan yang tidak didukung tetap berakhir di jalur canonical dengan
  `allowFallback: false` dan tidak dapat menulis data.

Backend transaksi yang sudah aman tidak ditulis ulang dalam P3. Mutasi tetap
memakai pending action, payload hash, idempotency key, dan konfirmasi yang sama.

## Aturan kontribusi

- Jangan membuat parser yang menentukan respons akhir.
- Extractor baru hanya boleh mengembalikan kandidat entitas beserta confidence
  dan evidence.
- Intent baru wajib masuk ke canonical intent map, dialogue policy, safety
  policy, response composer, dan golden corpus.
- Setiap kegagalan nyata wajib menjadi regression test multi-turn.
- Hapus adapter legacy per kemampuan hanya setelah parity test lulus.

## Status P1

Kemampuan berikut sudah keluar dari adapter dan memakai semantic frame,
dialogue policy, pending action backend, executor atomik, serta response composer
yang sama:

- membuat, mengganti nama, mengarsipkan, dan memulihkan dompet;
- menyetor dana dari dompet ke target dan mencairkan target ke dompet;
- menghitung nilai belanja dari pembayaran dan kembalian;
- melanjutkan hasil perhitungan tersebut menjadi draft pengeluaran multi-turn;
- sapaan dan percakapan dasar.

## Status P2

Pemahaman Bahasa Indonesia memakai specialist candidate extractor yang hanya
menghasilkan kandidat ter-grounding. Router, safety, dialogue, pending action,
dan response composer tetap tunggal. Kemampuan yang sudah canonical:

- transaksi majemuk memisahkan harga item, uang pembayaran, dan kembalian;
- transfer masuk dari pihak ketiga dipahami sebagai pemasukan pengguna bila
  arah kepemilikannya eksplisit;
- angka pada skenario "uang tinggal" dipisahkan dari saldo akun dan selalu
  diberi label sebagai skenario pada saran runway;
- target total dan setoran awal tabungan dipetakan ke field berbeda;
- jawaban kontekstual pendek seperti `BCA`, `iya`, `catat yang tadi`, dan
  `jadi 150rb` dilanjutkan dari state backend;
- setiap kandidat membawa `source`, `confidence`, dan rentang `evidence`;
- semantic frame memisahkan fakta hasil ekstraksi, asumsi bahasa, dan fakta
  akun; hasil yang tidak diproses membawa reason code eksplisit.

Golden corpus sekarang memuat sedikitnya 550 tuturan Indonesia, termasuk typo,
slang, urutan kata bebas, kasus multi-turn, dan kontrak unsafe-write. Tidak ada
lagi kemampuan runtime yang memakai adapter assistant legacy.

## Status P4

- Preferensi eksplisit dan aturan istilah tersimpan dalam scope akun dan hanya
  dapat diubah melalui RPC tervalidasi.
- Settings menyediakan halaman **Yang Kurogi Ingat** untuk melihat, mengubah,
  menghapus satu, atau menghapus seluruh preferensi dan aturan istilah.
- Penghapusan seluruh ingatan mencakup `assistant_memories`, aturan kategori,
  dan aturan dompet tanpa menghapus transaksi atau data keuangan lain.
- Role anonymous tidak mempunyai akses eksekusi ke RPC pengelolaan memori.
- Jika memori menentukan dompet atau kategori suatu interpretasi, balasan
  menjelaskan asumsi tersebut sebelum pengguna mengonfirmasi tindakan.
