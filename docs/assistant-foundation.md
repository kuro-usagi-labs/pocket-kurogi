# Fondasi Local Assistant Kurogi

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
- Bila pending action backend dan draft legacy muncul bersamaan, backend selalu
  menang dan konflik tersebut dicatat pada keputusan handler.

Dialogue state versi 2 menyimpan `conversationId`, `activeFrame`,
`missingSlots`, `pendingActionId`, `lastResolvedIntent`, dan
`referencedTransactionIds`. Field versi lama masih dipertahankan sementara
untuk adapter kompatibilitas.

## Batas adapter legacy

`legacy_adapter` masih menangani kemampuan yang belum dipindahkan:

- aturan pengajaran keyword lokal;

Adapter tersebut adalah tujuan migrasi, bukan tempat menambah fitur. Tidak ada
fallback dari pipeline canonical ke adapter legacy. Kegagalan invariant diblok
dengan aman dan tidak mengubah data.

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

Golden corpus sekarang memuat sedikitnya 100 tuturan Indonesia, termasuk typo,
slang, urutan kata bebas, kasus multi-turn, dan kontrak unsafe-write. Satu-satunya
kemampuan yang masih memakai `legacy_adapter` adalah aturan pengajaran keyword
lokal.
