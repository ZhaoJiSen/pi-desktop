import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    reducedMotion: 'reduce',
  })
  await context.addInitScript(() => {
    localStorage.setItem('pi.sidebar-panel-width', '420')
    for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
      localStorage.setItem(
        key,
        JSON.stringify({
          state: {
            language: 'en',
            languageSource: 'user',
            theme: 'light',
            onboardingCompleted: true,
          },
          version: 2,
        }),
      )
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:1420/#/commands')
  await page.locator('.commands-filters .toggle-button').first().waitFor({ state: 'visible' })
  const commandRadius = await page
    .locator('.commands-filters .toggle-button')
    .first()
    .evaluate((el) => getComputedStyle(el).borderRadius)
  assert(parseFloat(commandRadius) >= 13, 'Use HeroUI default pill radius')
  await page.screenshot({ path: new URL('./light-commands.png', import.meta.url).pathname })
  await page.goto('http://127.0.0.1:1420/#/extensions')
  await page.locator('.package-tabs .tabs__tab').nth(1).click()
  const buttons = page.locator('.package-categories .toggle-button')
  await buttons.first().waitFor({ state: 'visible' })
  const radii = await buttons.evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).borderRadius),
  )
  assert.equal(radii.length, 5)
  assert(
    radii.every((radius) => radius === commandRadius),
    JSON.stringify({ commandRadius, radii }),
  )
  await page.screenshot({ path: new URL('./light-all.png', import.meta.url).pathname })
  await buttons.nth(1).click()
  await page.waitForFunction(
    () =>
      document
        .querySelectorAll('.package-categories .toggle-button')[1]
        ?.getAttribute('data-selected') === 'true',
  )
  await page.screenshot({ path: new URL('./light-extensions.png', import.meta.url).pathname })
  const result = { commandRadius, categoryRadii: radii, result: 'passed' }
  await writeFile(new URL('./result.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
  console.log(result)
} finally {
  await browser.close()
}
