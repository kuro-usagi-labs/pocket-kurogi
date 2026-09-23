export function getSmallTalkReply(text = '') {
  const value = text.trim().toLowerCase().replace(/[!?.,]+$/u, '').trim()
  if (/^(?:hi|hai|halo|hello|hey|hei|pagi|siang|sore|malam|selamat (?:pagi|siang|sore|malam))(?:\s+kurogi)?$/u.test(value)) {
    return 'Hai! Aku Kurogi, siap bantu. Mau mulai dari catat transaksi, cek saldo, atau rencana keuanganmu?'
  }
  if (/^(?:makasih|makasi|terima kasih|thanks|thank you)(?:\s+(?:ya|kurogi))?$/u.test(value)) return 'Sama-sama! Kalau ada transaksi atau rencana lain, ceritakan saja.'
  if (/^(?:apa kabar|gimana kabarmu|kabar kamu)$/u.test(value)) return 'Aku siap bantu. Kamu gimana? Ada yang lagi kamu pikirkan soal keuangan?'
  if (/^(?:kamu siapa|siapa kamu|apa itu kurogi)$/u.test(value)) return 'Aku Kurogi, asisten keuanganmu. Aku membantu mencatat transaksi, mengecek saldo dan budget, serta menghitung rencana tabungan.'
  if (/^(?:help|bantuan|tolong bantu|kamu bisa apa|bisa apa|cara pakai)$/u.test(value)) return 'Kamu bisa coba: “catat makan 25rb dari BCA”, “pengeluaran kemarin berapa?”, atau “cek saldo”. Untuk perubahan uang, aku akan meminta konfirmasi dulu.'
  return null
}
