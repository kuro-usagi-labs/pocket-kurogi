# Audit Deterministic Conversational Financial Agent

## Ringkasan

Repository sebelumnya sudah mempunyai parser transaksi, grammar guard bahasa
Indonesia, classifier lokal, modul kategori/dompet, hooks Neon, dan RPC ledger
atomik. Bagian tersebut dipertahankan sebagai fondasi dan fallback. Refactor
menambahkan pipeline modular yang menjadi jalur utama untuk intent percakapan
keuangan, tanpa LLM, model generatif, atau API key AI.

## Temuan kode lama

### Dipakai kembali

- `conversationalFinance.js`: parsing transaksi natural, peran uang, dan draft
  yang sudah memiliki corpus test luas.
- `financeIntentClassifier.js`: sinyal tambahan untuk jalur kompatibilitas.
- `localAssistant.js`: query dan aksi lama yang belum masuk intent utama.
- `indonesianFinanceLanguage.js` dan `chatWriteSafety.js`: normalisasi serta
  grammar guard presisi tinggi.
- katalog kategori, entity option resolver, hooks dompet/transaksi/budget/goal,
  dan RPC PostgreSQL atomik.
- metadata pesan chat untuk card transaksi dan konteks lama.

### Diperbaiki

- singkatan `m` tidak pernah dianggap miliar;
- `Rp500` tetap Rp500, bukan Rp500.000;
- kuantitas, tanggal, nomor produk, rencana, pertanyaan, negasi, serta transaksi
  pihak ketiga dipisahkan dari transaksi pengguna;
- normalizer idempoten agar `7 juta` tidak rusak saat dinormalisasi ulang;
- slot dompet disimpan lintas turn;
- correction menolak target item batch yang tidak jelas;
- mutation intent utama selalu membuat pending action server-side;
- query assistant mengambil data aktual lewat Vercel Function.

### Dipisahkan

- executor intent besar dikeluarkan dari `AppShell.jsx` ke
  `useLegacyIntentExecutor.js`;
- helper chat murni dipindahkan ke `appShellChatHelpers.js`;
- state/I/O dipisahkan dari engine murni melalui `useAssistantState.js` dan
  `useDeterministicAssistant.js`;
- engine dipecah menjadi router, extractor/resolver, slot, dialogue, memory,
  insight, response, pending action, dan safety.

### Tidak dihapus

Parser lama belum dihapus karena masih melayani kemampuan kompatibilitas seperti
pengelolaan dompet dan operasi target lanjutan. Ia hanya dijalankan bila engine
baru menyatakan pesan belum ditangani. Penghapusan sekarang akan menjadi rewrite
berisiko dan bertentangan dengan strategi migrasi bertahap.

## Dependensi dan aliran data

```text
Chat UI
  -> useDeterministicAssistant
  -> assistantEngine (pure)
     -> normalizer/entity resolvers
     -> intent router
     -> slot + dialogue manager
     -> safety + insight + response composer
  -> /api/assistant
     -> verifikasi JWT/JWKS + CORS
     -> parameterized query / RPC
     -> Neon RLS + pending action executor
  -> sinkronisasi wallet, transaksi, budget, goal, dan analytics
```

Response composer hanya menerima hasil perhitungan dari data backend. Ia tidak
memiliki akses SQL dan tidak menentukan saldo.

## Batas keamanan

- Subject JWT adalah satu-satunya identitas pengguna yang dipercaya server.
- Tabel state assistant hanya dapat dibaca oleh role `authenticated` milik row
  tersebut; mutation langsung dicabut dan harus lewat RPC.
- Role `anonymous` tidak dapat membaca state maupun menjalankan executor.
- Pending action memakai TTL, payload hash, row lock, transaction, dan
  idempotency key.
- Mutation awal tidak menulis ledger.
- CORS memakai exact allowlist; localhost hanya ditambahkan di mode nonproduction.

## Cakupan pengujian

Unit test mencakup normalizer, router, uang, tanggal, dompet, target, slot,
dialogue, clarification, response, emotional context, memory, insight, pending
action, correction, serta safety. Integration test percakapan mencakup slot
lintas turn dan seluruh contoh kritis pada spesifikasi.

Test database berjalan dalam transaction rollback sebagai owner, lalu mengganti
role ke `authenticated` dan `anonymous` untuk membuktikan RLS, ownership,
atomicity, payload mismatch, koreksi, replay idempoten, dan eksekusi target.
