const formatter = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2,
})
export const formatMoney = value => formatter.format(Number(value ?? 0))
