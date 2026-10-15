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
    await context.addInitScript(
      ({ theme }) => {
        localStorage.setItem('pi.sidebar-panel-width', '420')
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
          localStorage.setItem(
            key,
            JSON.stringify({
              state: { language: 'en', languageSource: 'user', theme, onboardingCompleted: true },
              version: 2,
            }),
          )
      },
      { theme },
    )
    const page = await context.newPage()
    for (const route of ['commands', 'extensions']) {
      await page.goto(`http://127.0.0.1:1432/#/${route}`, { waitUntil: 'domcontentloaded' })
      console.log(route, 'loaded')
      const pane = page.locator(route === 'commands' ? '.commands-browser' : '.package-library')
      await pane.waitFor()
      await page
        .locator(route === 'commands' ? '.command-row' : '.package-tabs')
        .first()
        .waitFor()
      console.log(route, 'ready')
      const box = await pane.boundingBox()
      await page.screenshot({
        path: new URL(`./${before ? 'before-' : ''}${route}-${theme}.png`, import.meta.url)
          .pathname,
        clip: { x: box.x, y: box.y, width: box.width, height: 300 },
      })
      if (!before) {
        await page.evaluate(() => (document.documentElement.style.zoom = '2'))
        const zoomBox = await pane.boundingBox()
        await page.screenshot({
          path: new URL(`./${route}-${theme}-200.png`, import.meta.url).pathname,
          clip: {
            x: zoomBox.x,
            y: zoomBox.y,
            width: Math.min(zoomBox.width, 1200 - zoomBox.x),
            height: 450,
          },
        })
        await page.evaluate(() => (document.documentElement.style.zoom = ''))
        await pane
          .locator(route === 'commands' ? '.commands-search-toggle' : '.package-search-toggle')
          .click()
        await pane.locator('input[type=search]').waitFor()
        await page.screenshot({
          path: new URL(`./${route}-${theme}-search.png`, import.meta.url).pathname,
          clip: { x: box.x, y: box.y, width: box.width, height: 240 },
        })
        await pane.locator('input[type=search]').press('Escape')
        await pane.locator('input[type=search]').waitFor({ state: 'detached' })
        await page.setViewportSize({ width: 390, height: 844 })
        const narrowBox = await pane.boundingBox()
        await page.screenshot({
          path: new URL(`./${route}-${theme}-390.png`, import.meta.url).pathname,
          clip: { x: narrowBox.x, y: narrowBox.y, width: narrowBox.width, height: 240 },
        })
        await page.setViewportSize({ width: 1200, height: 900 })
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
}
