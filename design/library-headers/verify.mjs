import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      reducedMotion: 'reduce',
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
      errors = [],
      metrics = []
    page.on('pageerror', (e) => errors.push(e.message))
    for (const route of ['commands', 'extensions']) {
      const command = route === 'commands'
      await page.goto(`http://127.0.0.1:1432/#/${route}`, { waitUntil: 'domcontentloaded' })
      const pane = page.locator(command ? '.commands-browser' : '.package-library')
      const heading = pane.locator(
        command ? '.commands-browser-heading' : '.package-library-heading',
      )
      const title = heading.locator('h2'),
        buttons = heading.locator('button')
      await buttons.first().waitFor()
      const metric = await title.evaluate((el) => {
        const s = getComputedStyle(el),
          r = el.getBoundingClientRect()
        return { size: s.fontSize, weight: s.fontWeight, line: s.lineHeight, x: r.x, y: r.y }
      })
      assert.equal(metric.size, '16px')
      assert.equal(metric.weight, '600')
      assert.equal(metric.line, '24px')
      assert.equal(await buttons.count(), 2)
      for (const button of await buttons.all()) {
        const b = await button.boundingBox(),
          t = await title.boundingBox()
        assert.equal(b.width, 28)
        assert.equal(b.height, 28)
        assert(Math.abs(b.y + b.height / 2 - t.y - t.height / 2) < 1)
      }
      metrics.push(metric)
      await buttons.first().click()
      const input = pane.locator('input[type=search]')
      await input.waitFor()
      await input.fill('model')
      await input.press('Escape')
      await input.waitFor({ state: 'detached' })
      assert.equal(await buttons.first().getAttribute('aria-expanded'), 'false')
      if (!command) {
        await pane.locator('.package-tabs .tabs__tab').nth(1).click()
        assert(await pane.locator('.package-categories').isVisible())
        assert.equal(await heading.locator('button').count(), 2)
        await pane.locator('.package-tabs .tabs__tab').first().click()
      }
      await page.setViewportSize({ width: 390, height: 844 })
      assert.equal(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
      assert.equal(await pane.evaluate((el) => getComputedStyle(el).paddingTop), '16px')
      await page.setViewportSize({ width: 1200, height: 900 })
      await page.evaluate(() => (document.documentElement.style.zoom = '2'))
      assert.equal(await heading.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
      await page.evaluate(() => (document.documentElement.style.zoom = ''))
      await page.setViewportSize({ width: 1200, height: 900 })
    }
    assert.deepEqual(metrics[0], metrics[1], 'Peer titles align and share typography')
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      language: run === 3 ? 'zh' : 'en',
      checks: [
        'same title typography and position',
        '28px title-row tools',
        'search open and Escape close',
        'Installed/Discover controls',
        '390px and actual 200% zoom',
        'no page errors',
      ],
    })
    console.log(results.at(-1))
    await context.close()
  }
  await writeFile(
    new URL('./results.json', import.meta.url),
    JSON.stringify(results, null, 2) + '\n',
  )
} finally {
  await browser.close()
}
