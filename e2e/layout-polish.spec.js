import { test, expect } from '@playwright/test'

test('planning and correction dialog remain readable in both themes', async ({ page }, testInfo) => {
  await page.goto('/design-preview.html?layout=1')
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Aktifkan mode gelap' }).click()
    await expect(page.getByText('Lihat arah uang sebelum tanggalnya tiba.')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`planning-${theme}.png`), animations: 'disabled' })
    await page.getByRole('button', { name: 'Koreksi contoh' }).click()
    const dialog = page.getByRole('dialog', { name: 'Koreksi transaksi' })
    await expect(dialog.getByLabel('Nominal')).toHaveValue('8.000')
    await expect(dialog).toContainText('8.000')
    await expect(dialog.getByRole('button', { name: 'Simpan koreksi' })).toBeDisabled()
    await page.screenshot({ path: testInfo.outputPath(`correction-${theme}.png`), animations: 'disabled' })
    await dialog.getByLabel('Nominal').fill('9.000')
    await dialog.getByRole('button', { name: 'Simpan koreksi' }).click()
    await expect(page.getByText('Nominal tersimpan: 9000')).toBeVisible()
  }
})

test('wallet menu labels stay on one line', async ({ page }, testInfo) => {
  await page.goto('/design-preview.html')
  const desktop = page.getByRole('button', { name: 'Dompet', exact: true })
  await (await desktop.isVisible() ? desktop : page.getByRole('button', { name: 'wallets', exact: true })).click()
  await page.getByRole('button', { name: /aksi.*Tunai/i }).click()
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  expect(await menu.getByRole('menuitem').evaluateAll(items => items.every(item => item.scrollWidth <= item.clientWidth && item.clientHeight <= 48))).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('wallet-menu.png'), animations: 'disabled' })
})
