import { expect, test } from '@playwright/test'

test('persists a solved dynamic recipe and marks it stale after profile changes', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'FF14_Moon' })).toBeVisible()
  await page.getByLabel('方案名稱').fill('遊戲畫面')
  await page.getByLabel('職業等級').fill('79')
  await page.getByLabel('作業精度').fill('1555')
  await page.getByLabel('加工精度').fill('1534')
  await page.getByLabel('CP').fill('421')
  await page.getByTestId('save-profile').click()
  await expect(page.getByText('能力值方案已保存。')).toBeVisible()

  await page.getByTestId('recipe-search').fill('宇宙探索用的紡車')
  await page.locator('.search-results button', { hasText: 'ID 36173' }).click()
  await expect(page.getByTestId('recipe-level')).toHaveValue('79')
  await expect(page.getByText('動態配方', { exact: true })).toBeVisible()
  await expect(page.getByText('1197', { exact: true })).toBeVisible()
  await expect(page.getByText('2790', { exact: true })).toBeVisible()

  await page.getByTestId('solve-recipe').click()
  await expect(page.getByTestId('solve-status')).toHaveText('求解與同版本模擬驗證完成。', {
    timeout: 120_000,
  })
  await expect(page.getByTestId('solution-result')).toContainText('與目前設定一致')
  await expect(page.getByTestId('solution-result')).toContainText('剩餘 CP')
  await expect(page.locator('.macro-card pre').first()).toContainText('/ac 掌握 <wait.2>')
  await expect(page.locator('.macro-card pre').first()).not.toContainText('/mlock')

  await page.reload()
  await expect(page.getByTestId('solution-result')).toContainText('Lv.79 解答')
  await expect(page.locator('.saved-recipes > li')).toHaveCount(1)

  await page.getByLabel('作業精度').fill('1556')
  await page.getByTestId('save-profile').click()
  await expect(page.getByTestId('solution-result')).toContainText('使用舊能力值／選項求解')

  await page.getByRole('button', { name: /裁衣/ }).click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(0)
  await page.getByRole('button', { name: /木工/ }).click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(1)

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByTestId('clear-all').click()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.saved-recipes > li')).toHaveCount(0)
})
