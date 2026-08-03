import { expect, test } from '@playwright/test'

test('loads the browser WASM probe', async ({ page }) => {
  await page.goto('/?technical-validation=1')

  await expect(page.getByRole('heading', { name: 'FF14_Moon' })).toBeVisible()
  await expect(page.getByTestId('wasm-status')).toHaveText(
    'Rust／WASM 工具鏈已載入',
  )
})

test('passes the Recipe 36173 Lv.79 Worker/WASM technical gate', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/?technical-validation=1')
  await page.getByRole('button', { name: '執行技術驗證' }).click()

  await expect(page.getByTestId('validation-status')).toHaveText('技術驗證通過', {
    timeout: 120_000,
  })
  await expect(page.getByText('宇宙探索用的紡車（ID 36173）')).toBeVisible()
  await expect(page.getByText('418', { exact: true })).toBeVisible()
  await page.getByTestId('macro-sections').getByText(/查看繁中巨集/).click()

  const sections = page.locator('.macro-section pre')
  await expect(sections.first()).toContainText('/ac ')
  const sectionTexts = await sections.allTextContents()
  expect(sectionTexts.length).toBeGreaterThan(0)
  for (const section of sectionTexts) {
    const lines = section.split(/\r?\n/)
    expect(lines.length).toBeLessThanOrEqual(15)
    expect(lines).not.toContain('/mlock')
  }
})
