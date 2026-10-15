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
    await page.goto('http://127.0.0.1:1432/#/extensions', { waitUntil: 'domcontentloaded' })
    await page.locator('.package-library').waitFor()
    await page.evaluate(async () => {
      const { useWorkspace } = await import(
        performance
          .getEntriesByType('resource')
          .find((e) => new URL(e.name).pathname === '/src/store/workspace.ts').name
      )
      useWorkspace.setState({
        packages: [
          {
            source: '/preview/extensions/pi-tools',
            scope: 'global',
            description: 'Tools and commands for your Pi workspace.',
            enabled: true,
          },
        ],
      })
    })
    await page.locator('.package-detail').waitFor()
    await page
      .locator('.package-detail')
      .screenshot({ path: new URL(`./reference-extension-${theme}.png`, import.meta.url).pathname })
    await page.goto('http://127.0.0.1:1432/#/commands', { waitUntil: 'domcontentloaded' })
    await page.locator('.command-inspector').waitFor()
    for (const name of ['compact', 'review']) {
      await page
        .locator('.command-row')
        .filter({
          has: page.locator('.sidebar-option-title strong', { hasText: new RegExp(`^/${name}$`) }),
        })
        .click()
      await page
        .locator('.command-inspector .card__title')
        .filter({ hasText: `/${name}` })
        .waitFor()
      const card = page.locator('.command-inspector')
      await card.screenshot({
        path: new URL(`./${before ? 'before-' : ''}${name}-${theme}.png`, import.meta.url).pathname,
      })
      if (!before && name === 'review') {
        await page.evaluate(() => (document.documentElement.style.zoom = '2'))
        await card.scrollIntoViewIfNeeded()
        const r = await card.boundingBox()
        await page.screenshot({
          path: new URL(`./review-${theme}-200.png`, import.meta.url).pathname,
          clip: {
            x: Math.max(0, r.x),
            y: Math.max(0, r.y),
            width: Math.min(r.width, 1200 - Math.max(0, r.x)),
            height: Math.min(650, 900 - Math.max(0, r.y)),
          },
        })
        await page.evaluate(() => (document.documentElement.style.zoom = ''))
        await page.setViewportSize({ width: 390, height: 844 })
        await card.scrollIntoViewIfNeeded()
        await card.screenshot({
          path: new URL(`./review-${theme}-390.png`, import.meta.url).pathname,
        })
        await page.setViewportSize({ width: 1200, height: 900 })
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
}
