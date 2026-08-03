import { expect, test } from '@playwright/test'

test('loads the browser WASM probe', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'FF14_Moon' })).toBeVisible()
  await expect(page.getByTestId('wasm-status')).toHaveText(
    'Rust／WASM 工具鏈已載入',
  )
})
