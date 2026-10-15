import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
async function noTooltip(page, label) {
  await page.mouse.move(1100, 700)
  await page.getByRole('tooltip').waitFor({ state: 'detached' })
  await label.hover()
  assert(
    await page.evaluate(
      () =>
        new Promise((resolve) => {
          const start = performance.now()
          function check() {
            if (document.querySelector('[role=tooltip]')) return resolve(false)
            if (performance.now() - start > 700) return resolve(true)
            requestAnimationFrame(check)
          }
          check()
        }),
    ),
    'Untruncated label must not show tooltip',
  )
}
async function metrics(page) {
  const m = await page.locator('.package-sort .tabs__tab').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect(),
        s = getComputedStyle(el),
        text = el.querySelector('.package-sort-text')
      return {
        width: r.width,
        left: r.left,
        right: r.right,
        paddingLeft: s.paddingLeft,
        paddingRight: s.paddingRight,
        text: text.textContent,
        truncated: text.scrollWidth > text.clientWidth,
      }
    }),
  )
  assert(Math.abs(m[0].width - m[1].width) < 0.1, 'Tabs have equal widths')
  assert(
    m.every((v) => v.paddingLeft === v.paddingRight),
    'Symmetric tab padding',
  )
  assert(
    await page
      .locator('.package-sort .tabs__list')
      .evaluate((el) => el.scrollWidth <= el.clientWidth),
    'No horizontal overflow',
  )
  return m
}
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      reducedMotion: 'reduce',
    })
    await context.addInitScript(
      ({ run }) => {
        localStorage.setItem('pi.sidebar-panel-width', '480')
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
          localStorage.setItem(
            key,
            JSON.stringify({
              state: {
                language: 'en',
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
    await page.routeWebSocket(/.*/, (socket) => socket.close())
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:1432/#/extensions', { waitUntil: 'domcontentloaded' })
    await page.locator('.package-tabs .tabs__tab').nth(1).click()
    const tabs = page.locator('.package-sort .tabs__tab'),
      labels = page.locator('.package-sort-label'),
      handle = page.locator('.split-pane-handle')
    const wide = await metrics(page)
    assert(wide.every((v) => !v.truncated))
    await noTooltip(page, labels.first())
    await noTooltip(page, labels.nth(1))
    await handle.press('Home')
    await page.waitForFunction(() => {
      const t = document.querySelectorAll('.package-sort-text')[1]
      return t.scrollWidth > t.clientWidth
    })
    const narrow = await metrics(page)
    assert.equal(narrow[0].truncated, false)
    assert.equal(narrow[1].truncated, true)
    await noTooltip(page, labels.first())
    await labels.nth(1).hover()
    await page.getByRole('tooltip').waitFor()
    assert.equal(await page.getByRole('tooltip').innerText(), 'Recently published')
    if (run === 1)
      await page
        .locator('.package-library-controls')
        .screenshot({ path: new URL('./narrow-tooltip-dark.png', import.meta.url).pathname })
    await handle.press('End')
    await page.getByRole('tooltip').waitFor({ state: 'detached' })
    await noTooltip(page, labels.nth(1))
    await handle.press('Home')
    await page.mouse.move(1100, 700)
    await page.waitForFunction(() => {
      const t = document.querySelectorAll('.package-sort-text')[1]
      return t.scrollWidth > t.clientWidth
    })
    await labels.nth(1).hover()
    await page.getByRole('tooltip').waitFor()
    await tabs.nth(1).click()
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true')
    await page.mouse.move(1100, 700)
    await page.getByRole('tooltip').waitFor({ state: 'detached' })
    await tabs.nth(1).focus()
    await page.keyboard.press('ArrowLeft')
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true')
    await tabs.first().press('ArrowRight')
    assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true')
    if (run === 2)
      await page
        .locator('.package-library-controls')
        .screenshot({ path: new URL('./narrow-selected-light.png', import.meta.url).pathname })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    await metrics(page)
    if (run === 1)
      await page
        .locator('.package-library-controls')
        .screenshot({ path: new URL('./zoom-200.png', import.meta.url).pathname })
    await page.evaluate(() => (document.documentElement.style.zoom = ''))
    await page.setViewportSize({ width: 390, height: 844 })
    await metrics(page)
    if (run === 2)
      await page
        .locator('.package-library-controls')
        .screenshot({ path: new URL('./390-light.png', import.meta.url).pathname })
    await page.setViewportSize({ width: 1200, height: 800 })
    await handle.press('Home')
    await page.evaluate(async () => {
      const { useWorkspace } = await import(
        performance
          .getEntriesByType('resource')
          .find((e) => new URL(e.name).pathname === '/src/store/workspace.ts').name
      )
      useWorkspace.setState({ language: 'zh', languageSource: 'user' })
    })
    await page.waitForFunction(
      () => document.querySelectorAll('.package-sort-text')[1]?.textContent === '最近发布',
    )
    const chinese = await metrics(page)
    assert(chinese.every((v) => !v.truncated))
    await noTooltip(page, page.locator('.package-sort-label').nth(1))
    if (run === 3)
      await page
        .locator('.package-library-controls')
        .screenshot({ path: new URL('./narrow-zh.png', import.meta.url).pathname })
    assert.deepEqual(errors, [])
    const result = {
      run,
      result: 'passed',
      wide,
      narrow,
      chinese,
      checks: [
        'Equal widths and symmetric padding',
        'Ellipsis only when text overflows',
        'Tooltip only for truncated text',
        'Resize closes tooltip when text fits and re-enables on shrink',
        'Mouse selection and arrow keyboard navigation',
        'Light/dark, Chinese, 390px, actual CSS 200% zoom',
        'No page errors',
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
