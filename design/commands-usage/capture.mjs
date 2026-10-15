import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const before = process.argv.includes('--before')
try {
  for (const theme of before ? ['dark'] : ['dark', 'light']) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      reducedMotion: 'reduce',
    })
    await context.addInitScript((theme) => {
      localStorage.setItem('pi.sidebar-panel-width', '280')
      for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
        localStorage.setItem(
          key,
          JSON.stringify({
            state: { language: 'en', languageSource: 'user', theme, onboardingCompleted: true },
            version: 2,
          }),
        )
    }, theme)
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:1420/#/commands')
    await page.locator('.command-syntax').waitFor()
    await page.locator('.commands-list [role=option]').first().click()
    await page
      .locator('.command-inspector')
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
    const name = before ? 'before' : theme
    await page
      .locator('.command-inspector')
      .screenshot({ path: new URL(`./${name}.png`, import.meta.url).pathname })
    console.log(
      name,
      await page.locator('.command-syntax').evaluate((el) => ({
        height: el.getBoundingClientRect().height,
        text: el.textContent,
        icons: el.querySelectorAll('svg').length,
      })),
    )
    if (!before) {
      await page.evaluate(() => (document.documentElement.style.zoom = '2'))
      await page.locator('.command-usage').scrollIntoViewIfNeeded()
      await page
        .locator('.command-usage')
        .screenshot({ path: new URL(`./${name}-200.png`, import.meta.url).pathname })
    }
    await context.close()
  }
} finally {
  await browser.close()
}
