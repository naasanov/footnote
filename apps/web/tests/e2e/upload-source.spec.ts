import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Sign in helper — uses Clerk test credentials from env
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

test.describe('Upload source', () => {
  test('upload a small PDF, assert it appears and reaches ready status', async ({ page }) => {
    await signIn(page)

    // Create a notebook
    await page.goto('/')
    await page.getByRole('button', { name: /new notebook/i }).click()
    await page.getByPlaceholder('Notebook name').fill('E2E Upload Test')
    await page.getByRole('button', { name: /create/i }).click()

    // Wait for the notebook to appear and expand it
    await expect(page.getByText('E2E Upload Test')).toBeVisible()
    await page.getByText('E2E Upload Test').click()

    // Create a note
    await page.getByRole('button', { name: /new note/i }).click()
    await page.waitForURL(/\/notebooks\/.+\/notes\/.+/)

    // Get the minimal PDF fixture path
    const pdfPath = path.join(__dirname, '../../..', 'api/tests/fixtures/minimal.pdf')
    expect(fs.existsSync(pdfPath)).toBe(true)

    // Upload the file
    const fileInput = page.locator('input[type="file"]').first()
    await fileInput.setInputFiles(pdfPath)

    // Assert the source appears in the source list
    await expect(page.getByText('minimal.pdf')).toBeVisible({ timeout: 10_000 })

    // Poll until status badge shows "ready" (up to 30 seconds for ingest)
    await expect(page.getByText('ready')).toBeVisible({ timeout: 30_000 })
  })
})
