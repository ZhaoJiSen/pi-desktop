import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { writeFile } from 'node:fs/promises'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
try {
  const context = await browser.newContext({
    viewport: { width: 1200, height: 900 },
    reducedMotion: 'no-preference',
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
            theme: 'dark',
            onboardingCompleted: true,
          },
          version: 2,
        }),
      )
  })
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:1432/#/extensions', { waitUntil: 'domcontentloaded' })
  await page.locator('.package-library').waitFor()
  const frames = await page.evaluate(async () => {
    const frames = []
    location.hash = '/commands'
    const start = performance.now()
    await new Promise((resolve) => {
      function sample() {
        const el = document.querySelector('.commands-detail')
        if (el) {
          const card = el.querySelector('.command-inspector'),
            s = getComputedStyle(el)
          frames.push({
            t: performance.now() - start,
            client: el.clientWidth,
            scroll: el.scrollWidth,
            overflowX: s.overflowX,
            overflowY: s.overflowY,
            transform: card && getComputedStyle(card).transform,
            ancestors: [el.parentElement, el.parentElement?.parentElement].map(
              (p) =>
                p && {
                  class: p.className,
                  client: p.clientWidth,
                  scroll: p.scrollWidth,
                  overflow: getComputedStyle(p).overflow,
                },
            ),
          })
        }
        if (performance.now() - start < 650) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    return frames
  })
  await writeFile(new URL('./before.json', import.meta.url), JSON.stringify(frames, null, 2))
  console.log(JSON.stringify(frames.filter((f) => f.scroll > f.client).slice(0, 8)))
  await page
    .locator('.commands-workspace')
    .screenshot({ path: new URL('./before.png', import.meta.url).pathname })
} finally {
  await browser.close()
}
