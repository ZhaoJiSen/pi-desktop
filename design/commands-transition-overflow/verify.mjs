import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
async function monitor(page, action) {
  await page.evaluate(() => {
    window.transitionFrames = []
    window.transitionDone = new Promise((resolve, reject) => {
      const start = performance.now()
      let settled = 0
      function sample() {
        const el = document.querySelector('.commands-detail'),
          card = el?.querySelector('.command-inspector')
        if (card) {
          const style = getComputedStyle(el),
            transform = getComputedStyle(card).transform
          window.transitionFrames.push({
            t: performance.now() - start,
            client: el.clientWidth,
            scroll: el.scrollWidth,
            x: style.overflowX,
            y: style.overflowY,
            transform,
            left: el.scrollLeft,
          })
          const viewStyle = getComputedStyle(document.querySelector('.commands-view'))
          const x = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m41
          const running =
            Math.abs(x) > 0.001 ||
            Number(getComputedStyle(card).opacity) < 1 ||
            Number(viewStyle.opacity) < 1
          settled = running ? 0 : settled + 1
          if (settled >= 4) {
            resolve(window.transitionFrames)
            return
          }
        }
        if (performance.now() - start > 4000) {
          reject(new Error('Transition did not settle'))
          return
        }
        requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
  })
  await action()
  const frames = await page.evaluate(() => window.transitionDone)
  assert(frames.length > 0)
  assert(
    frames.every((f) => f.x === 'hidden' && f.y === 'auto' && f.left === 0),
    'No horizontal scrolling during transition; vertical auto remains',
  )
  return {
    frames: frames.length,
    animatedFrames: frames.filter((f) => f.transform !== 'none' && !f.transform.endsWith(', 0, 0)'))
      .length,
    maxTransientOverflow: Math.max(...frames.map((f) => f.scroll - f.client)),
  }
}
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      reducedMotion: 'no-preference',
    })
    await context.addInitScript(
      ({ run }) => {
        localStorage.setItem('pi.sidebar-panel-width', '420')
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
          localStorage.setItem(
            key,
            JSON.stringify({
              state: {
                language: run === 3 ? 'zh' : 'en',
                languageSource: 'user',
                theme: run === 1 ? 'dark' : 'light',
                onboardingCompleted: true,
              },
              version: 2,
            }),
          )
      },
      { run },
    )
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://127.0.0.1:1432/#/extensions', { waitUntil: 'domcontentloaded' })
    await page.locator('.package-library').waitFor()
    const route = await monitor(page, () => page.locator('.rail-item').nth(2).click())
    assert(route.animatedFrames > 0, 'Normal motion was exercised')
    const selections = []
    for (const name of ['review', 'compact', 'skill:commit']) {
      const row = page.locator('.command-row').filter({
        has: page.locator('.sidebar-option-title strong', { hasText: new RegExp(`^/${name}$`) }),
      })
      selections.push(await monitor(page, () => row.click()))
      assert.equal(await page.locator('.command-inspector .card__title').innerText(), `/${name}`)
    }
    await page
      .locator('.commands-workspace')
      .screenshot({ path: new URL(`./after-${run}.png`, import.meta.url).pathname })
    await page.setViewportSize({ width: 900, height: 260 })
    const detail = page.locator('.commands-detail')
    await detail.evaluate((el) => (el.style.maxHeight = '160px'))
    assert(
      await detail.evaluate((el) => el.scrollHeight > el.clientHeight),
      'Short viewport requires vertical scrolling',
    )
    await detail.evaluate((el) => el.scrollTo({ top: el.scrollHeight }))
    assert(await detail.evaluate((el) => el.scrollTop > 0), 'Vertical scrolling still works')
    await detail.evaluate((el) => (el.style.maxHeight = ''))
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    await page.locator('.command-inspector').scrollIntoViewIfNeeded()
    assert.equal(await detail.evaluate((el) => getComputedStyle(el).overflowX), 'hidden')
    if (run === 1)
      await page.screenshot({ path: new URL('./after-200.png', import.meta.url).pathname })
    await page.evaluate(() => (document.documentElement.style.zoom = ''))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.command-inspector').scrollIntoViewIfNeeded()
    assert(
      await page.locator('.command-inspector').evaluate((el) => el.scrollWidth <= el.clientWidth),
      'Long content wraps on narrow viewport',
    )
    assert.equal(await detail.evaluate((el) => getComputedStyle(el).overflowX), 'hidden')
    if (run === 3)
      await page.screenshot({ path: new URL('./after-390-zh.png', import.meta.url).pathname })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => (location.hash = '/extensions'))
    await page.locator('.package-library').waitFor()
    const reduced = await monitor(page, () => page.locator('.rail-item').nth(2).click())
    assert.deepEqual(errors, [])
    const result = {
      run,
      result: 'passed',
      route,
      selections,
      reduced,
      checks: [
        'normal-motion route entry and both selection directions',
        'horizontal overflow hidden on every sampled transition frame',
        'vertical scrolling remains functional',
        '200% and 390px Chinese long content',
        'reduced motion',
        'no page errors',
      ],
    }
    results.push(result)
    console.log(JSON.stringify(result))
    await context.close()
  }
  await writeFile(
    new URL('./results.json', import.meta.url),
    JSON.stringify(results, null, 2) + '\n',
  )
} finally {
  await browser.close()
}
