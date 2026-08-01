# Audit Deterministic Conversational Financial Agent

## Ringkasan

Dokumen ini merekam audit awal sebelum konsolidasi P0-P3. Repository sudah
mempunyai parser transaksi, grammar guard bahasa Indonesia, modul
kategori/dompet, hooks Neon, dan RPC ledger atomik. Setelah P3, seluruh pesan
runtime memakai satu orchestrator dan decision policy tanpa fallback ke engine
assistant lama, tetap tanpa LLM, model generatif, atau API key AI.

## Temuan kode lama

### Dipakai kembali

- parser transaksi dan classifier lama dipakai sebagai referensi parity selama
  migrasi, lalu dihapus setelah corpus canonical lulus;
- `localAssistant.js`: dahulu menangani query dan aksi kompatibilitas; modul ini
  sudah dihapus setelah kemampuan tersisa dimigrasikan.
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

- executor intent besar dahulu dikeluarkan dari `AppShell.jsx` ke
  `useLegacyIntentExecutor.js`; setelah migrasi selesai, hook tersebut dihapus;
- helper chat murni dipindahkan ke `appShellChatHelpers.js`;
- state/I/O dipisahkan dari engine murni melalui `useAssistantState.js` dan
  `useDeterministicAssistant.js`;
- engine dipecah menjadi router, extractor/resolver, slot, dialogue, memory,
  insight, response, pending action, dan safety.

### Status setelah P3

Parser dan executor assistant lama sudah dihapus setelah pengelolaan dompet,
operasi target, kalkulasi, percakapan dasar, memory, dan keyword learning masuk
ke jalur canonical. Backend transaksi tidak ditulis ulang: konfirmasi, pending
action, payload hash, idempotency, dan executor atomik tetap dipertahankan.

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
