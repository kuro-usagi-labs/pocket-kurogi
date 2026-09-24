import { test, expect } from '@playwright/test'

test('bulk draft edits preserve rupiah and require a compatible category', async ({ page }, testInfo) => {
  await page.goto('/design-preview.html?draft=1')
  const dialog = page.getByRole('dialog', { name: 'Edit draft transaksi' })
  await dialog.getByLabel('Nominal', { exact: true }).first().fill('8.000')
  await dialog.getByRole('combobox', { name: 'Jenis', exact: true }).nth(1).selectOption('expense')
  await dialog.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Pilih kategori')
  await dialog.getByRole('combobox', { name: 'Kategori', exact: true }).nth(1).selectOption('food')
  await page.screenshot({ path: testInfo.outputPath('bulk-draft.png'), animations: 'disabled' })
  await dialog.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(page.locator('output')).toContainText('"amount":8000')
  await expect(page.getByText('Belum ada transaksi dicatat.')).toBeVisible()
})
