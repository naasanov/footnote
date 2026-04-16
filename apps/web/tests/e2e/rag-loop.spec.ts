import { test, expect } from '@playwright/test'

async function signIn(page: import('@playwright/test').Page) {
  const email = process.env.E2E_CLERK_EMAIL ?? ''
  const password = process.env.E2E_CLERK_PASSWORD ?? ''

  await page.goto('/sign-in')
  await page.getByLabel('Email address').fill(email)
  await page.getByRole('button', { name: /continue/i }).click()
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: /continue/i }).click()
  await page.waitForURL(/\//)
}

test.describe('RAG loop', () => {
  test('typing on canvas surfaces passage cards in the RAG sidebar', async ({ page }) => {
    await signIn(page)

    // Navigate to a note. In a real run, the tester should have pre-created
    // a note with at least one ready source; the URL can be set via env var.
    const noteUrl = process.env.E2E_NOTE_URL
    if (!noteUrl) {
      test.skip(true, 'E2E_NOTE_URL not set — skipping RAG loop test')
      return
    }

    await page.goto(noteUrl)

    // Wait for the canvas to be ready
    await page.waitForSelector('.tl-canvas', { timeout: 15_000 })

    // Select the text tool and type some text on the canvas
    // tldraw toolbar: click the text tool button
    const textToolBtn = page.locator('[data-testid="tools.text"]').or(
      page.getByTitle('Text').first(),
    )
    await textToolBtn.click()

    // Click the center of the canvas and type
    const canvas = page.locator('.tl-canvas')
    const box = await canvas.boundingBox()
    if (!box) throw new Error('Canvas not found')
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.keyboard.type('photosynthesis light reactions thylakoid')
    await page.keyboard.press('Escape')

    // Wait for the RAG sidebar to update (debounce + OCR + RAG takes ~8s)
    // Poll for at least one passage card to appear
    await expect(
      page.locator('[data-testid="passage-card"]').or(page.getByText(/score/i)).first(),
    ).toBeVisible({ timeout: 30_000 })
  })
})
