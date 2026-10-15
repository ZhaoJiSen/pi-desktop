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
    localStorage.setItem('pi.sidebar-panel-width', '280')
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
  async function measure(selector) {
    return page.locator(selector).evaluateAll((els) =>
      els.map((el) => {
        const rect = el.getBoundingClientRect(),
          s = getComputedStyle(el)
        return {
          class: el.className,
          height: rect.height,
          minHeight: s.minHeight,
          padding: s.padding,
          fontSize: s.fontSize,
          lineHeight: s.lineHeight,
        }
      }),
    )
  }
  await page.goto('http://127.0.0.1:1420/#/commands')
  await page.locator('.commands-source-select').waitFor({ state: 'visible' })
  console.log(
    await measure(
      '.commands-search .search-field__group,.commands-search input,.commands-refresh,.commands-source-select .select__trigger',
    ),
  )
  await page.screenshot({ path: new URL('./before.png', import.meta.url).pathname })
  await page.goto('http://127.0.0.1:1420/#/extensions')
  await page.locator('.package-tabs .tabs__tab').nth(1).click()
  await page.locator('.package-search-toggle').click()
  await page.locator('.package-search').waitFor({ state: 'visible' })
  console.log(
    await measure(
      '.package-search .search-field__group,.package-search input,.package-category-select .select__trigger',
    ),
  )
} finally {
  await browser.close()
}
