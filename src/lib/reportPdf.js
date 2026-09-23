import { BUCKET_LABELS, reportDate, reportMoney } from './financialReport.js'

// Text-only export: no HTML evaluation, remote assets, or provider requests.
export async function createReportPdf(report) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const doc = new jsPDF({ format: 'a4', compress: true })
  const clean = (value) =>
    String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7e\n]/g, '?')
  const money = (value) => clean(reportMoney(value))
  doc.setProperties({
    title: `Laporan keuangan - ${report.period.label}`,
    author: 'Pocket Kurogi',
  })
  // Monochrome, print-friendly report; the application's theme is independent.
  doc.setDrawColor(40).line(16, 40, 194, 40)
  doc
    .setTextColor(20)
    .setFontSize(10)
    .text('POCKET KUROGI / LAPORAN KEUANGAN PRIBADI', 16, 14)
  doc.setFontSize(23).text('Laporan arus kas', 16, 25)
  doc
    .setFontSize(10)
    .text(clean(`${report.period.label} | Zona waktu WIB`), 16, 33)
  doc
    .setTextColor(40)
    .setFontSize(9)
    .text(
      clean(
        `Dibuat ${reportDate(report.generatedAt)} | ${report.transactions.length} transaksi`
      ),
      16,
      49
    )
  const table = (head, body, startY, options = {}) =>
    autoTable(doc, {
      head: [head],
      body: body.map((row) => row.map(clean)),
      startY,
      margin: { top: 22, left: 16, right: 16, bottom: 20 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        overflow: 'linebreak',
        textColor: 20,
      },
      headStyles: { fillColor: 230, textColor: 0 },
      alternateRowStyles: { fillColor: 248 },
      rowPageBreak: 'avoid',
      ...options,
    })
  table(
    ['ARUS KAS OPERASIONAL', 'IDR'],
    [
      ['Pemasukan', money(report.totals.income)],
      ['Pengeluaran (-)', money(report.totals.expense)],
      ['Surplus / defisit operasional', money(report.totals.operatingNet)],
      ['Setoran tabungan (-)', money(report.totals.savingIn)],
      ['Penarikan tabungan (+)', money(report.totals.savingOut)],
      ['Arus neto setelah tabungan', money(report.totals.afterSavings)],
      [
        'Transfer internal (informasi, tidak menambah arus neto)',
        money(report.totals.transfer),
      ],
      ['Saldo awal tercatat (informasi)', money(report.totals.opening)],
    ],
    55,
    { columnStyles: { 1: { halign: 'right', cellWidth: 55 } } }
  )
  table(
    ['KESIMPULAN & DASAR PENYUSUNAN'],
    [
      ...report.insights.map((text) => [text]),
      [
        'Arus neto bukan saldo akhir dompet. Transfer internal, saldo awal dan koreksi saldo tidak dihitung sebagai pemasukan/pengeluaran operasional. Tabungan disajikan terpisah.',
      ],
      [
        'Kategori mengikuti catatan tersimpan. Belum dikategorikan tetap masuk total. Laporan ini berbasis kas pribadi, bukan laporan perusahaan yang diaudit.',
      ],
    ],
    doc.lastAutoTable.finalY + 8
  )
  doc.addPage()
  table(
    ['KATEGORI', 'JENIS', 'JUMLAH', 'NOMINAL'],
    report.categories.length
      ? report.categories.map((group) => [
          group.name,
          BUCKET_LABELS[group.type],
          group.count,
          money(group.amount),
        ])
      : [['Tidak ada transaksi', '-', '0', money(0)]],
    25,
    { columnStyles: { 3: { halign: 'right', cellWidth: 42 } } }
  )
  doc.addPage()
  table(
    ['TANGGAL', 'KETERANGAN / KATEGORI', 'DOMPET', 'MASUK', 'KELUAR'],
    report.transactions.length
      ? report.transactions.map((row) => [
          reportDate(row.occurredAt),
          `${row.description}\n${row.category} / ${BUCKET_LABELS[row.bucket]}${row.notes && row.notes !== row.description ? `\nCatatan: ${row.notes}` : ''}`,
          row.wallet,
          row.type === 'income' ? money(row.amount) : '-',
          row.type === 'expense' ? money(row.amount) : '-',
        ])
      : [['-', 'Tidak ada transaksi pada periode ini.', '-', '-', '-']],
    25,
    {
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 61 },
        2: { cellWidth: 25 },
        3: { cellWidth: 34, halign: 'right' },
        4: { cellWidth: 34, halign: 'right' },
      },
    }
  )
  const count = doc.getNumberOfPages()
  for (let page = 1; page <= count; page++) {
    doc.setPage(page)
    if (page > 1)
      doc
        .setTextColor(20)
        .setFontSize(9)
        .text(clean(`POCKET KUROGI | ${report.period.label}`), 16, 13)
    doc.setDrawColor(210).line(16, 281, 194, 281)
    doc
      .setTextColor(90)
      .setFontSize(8)
      .text('Pribadi & rahasia | Nilai dalam Rupiah (IDR)', 16, 287)
    doc.text(`${page} / ${count}`, 194, 287, { align: 'right' })
  }
  return doc
}
