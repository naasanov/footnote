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

test.describe('Citation drag-and-drop', () => {
  test('dragging a passage card onto the canvas creates a citation chip', async ({ page }) => {
    await signIn(page)

    const noteUrl = process.env.E2E_NOTE_URL
    if (!noteUrl) {
      test.skip(true, 'E2E_NOTE_URL not set — skipping citation test')
      return
    }

    await page.goto(noteUrl)
    await page.waitForSelector('.tl-canvas', { timeout: 15_000 })

    // Wait for at least one passage card to be visible in the RAG sidebar
    // (assumes the note already has RAG results from a previous session or the
    // test environment has pre-populated results)
    const passageCard = page
      .locator('[data-testid="passage-card"]')
      .or(page.locator('.passage-card'))
      .first()

    await expect(passageCard).toBeVisible({ timeout: 30_000 })

    // Drag the passage card onto the canvas
    const canvas = page.locator('.tl-canvas')
    const canvasBox = await canvas.boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')

    const cardBox = await passageCard.boundingBox()
    if (!cardBox) throw new Error('Passage card not found')

    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2, { steps: 10 })
    await page.mouse.up()

    // Assert a citation chip shape exists on the canvas
    // Citation chips render with a specific data attribute or class
    const citationChip = page
      .locator('[data-shape-type="citation-chip"]')
      .or(page.locator('.tl-shape[data-shape-type="citation-chip"]'))
      .first()

    await expect(citationChip).toBeVisible({ timeout: 5_000 })
  })
})
