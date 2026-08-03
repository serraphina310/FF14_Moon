import { expect, test } from '@playwright/test'

test('recent-query removal is immediate while detail removal requires confirmation', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('recipe-search').fill('宇宙探索用的紡車')
  await page.locator('.search-results button', { hasText: 'ID 36173' }).click()
  await page.getByTestId('recipe-search').fill('宇宙探索用的紡車')
  await page.locator('.search-results button', { hasText: 'ID 36206' }).click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(2)

  let recentRemovalDialogCount = 0
  page.on('dialog', async (dialog) => {
    recentRemovalDialogCount += 1
    await dialog.dismiss()
  })
  await page.getByTestId('remove-saved-recipe-36173').click()
  await page.removeAllListeners('dialog')
  expect(recentRemovalDialogCount).toBe(0)
  await expect(page.locator('.saved-recipes > li')).toHaveCount(1)
  await expect(page.getByTestId('remove-saved-recipe-36206')).toBeVisible()

  await page.getByTestId('recipe-search').fill('宇宙探索用的紡車')
  await page.locator('.search-results button', { hasText: 'ID 36173' }).click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(2)

  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByTestId('remove-recipe').click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(2)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('remove-recipe').click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(1)
  await expect(page.locator('.saved-recipes')).toContainText('宇宙探索用的紡車')

  await page.reload()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(1)

  await page.getByTestId('recipe-search').fill('統一規格的壓縮纖維板')
  await page.locator('.search-results button', { hasText: 'ID 36183' }).click()
  await expect(page.getByTestId('cosmic-action')).toContainText('奇蹟之材')
  await expect(page.getByTestId('cosmic-action')).toContainText('最多可用 3 次')
  await expect(page.getByTestId('cosmic-action')).toContainText('不會自動加入巨集')
})
