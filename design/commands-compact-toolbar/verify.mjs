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
      reducedMotion: run === 2 ? 'reduce' : 'no-preference',
    })
    await context.addInitScript(
      ({ run }) => {
        localStorage.setItem('pi.sidebar-panel-width', '280')
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
    await page.goto('http://127.0.0.1:1420/#/commands')
    const toggle = page.locator('.commands-search-toggle'),
      input = page.locator('.commands-search input'),
      select = page.locator('.commands-source-select .select__trigger'),
      refresh = page.locator('.commands-refresh')
    await select.waitFor({ state: 'visible' })
    await page.waitForFunction(() => {
      const s = getComputedStyle(document.querySelector('.commands-view'))
      return Number(s.opacity) === 1 && new DOMMatrix(s.transform).m42 === 0
    })
    const total = await page.locator('.command-row').count()
    assert(total > 1)
    assert.equal(await input.count(), 0)
    assert.equal(await toggle.getAttribute('aria-expanded'), 'false')
    const tb = await toggle.boundingBox(),
      rb = await refresh.boundingBox()
    assert(Math.abs(tb.y - rb.y) < 0.5)
    assert.equal(tb.height, 28)
    assert.equal(rb.height, 28)
    assert(rb.x >= tb.x + tb.width)
    const defaultTop = (await page.locator('.commands-list').boundingBox()).y
    if (run === 1)
      await page.screenshot({ path: new URL('./dark-compact.png', import.meta.url).pathname })
    await toggle.click()
    await page.waitForFunction(() => document.activeElement?.matches('.commands-search input'))
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector('.commands-search-reveal').getBoundingClientRect().height - 44,
        ) < 0.01,
    )
    assert.equal(await toggle.getAttribute('aria-expanded'), 'true')
    const expandedTop = (await page.locator('.commands-list').boundingBox()).y
    assert(Math.abs(expandedTop - defaultTop - 44) < 1)
    assert.equal(
      (await page.locator('.commands-search .search-field__group').boundingBox()).height,
      34,
    )
    await input.fill('settings')
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 1)
    await refresh.click()
    assert.equal(await input.inputValue(), 'settings')
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 1)
    await page.locator('.commands-search .search-field__clear-button').click()
    assert.equal(await input.inputValue(), '')
    await page.waitForFunction(
      (total) => document.querySelectorAll('.command-row').length === total,
      total,
    )
    if (run === 1)
      await page.screenshot({ path: new URL('./dark-search.png', import.meta.url).pathname })
    await input.fill('settings')
    await input.press('Escape')
    await input.waitFor({ state: 'detached' })
    assert(await toggle.evaluate((el) => el === document.activeElement))
    assert.equal(await page.locator('.command-row').count(), total)
    await toggle.click()
    assert.equal(await input.inputValue(), '')
    await toggle.click()
    await input.waitFor({ state: 'detached' })
    // The active source must remain visible and survive opening/closing search.
    await select.click()
    await page.locator('[role=option][data-key=builtin]').click()
    const source = await page.locator('.commands-source-select .select__value').innerText()
    await toggle.click()
    await input.press('Escape')
    await input.waitFor({ state: 'detached' })
    assert.equal(await page.locator('.commands-source-select .select__value').innerText(), source)
    const handle = page.locator('.commands-workspace > .split-pane-handle')
    await handle.focus()
    await handle.press('End')
    await page.locator('.commands-filters').waitFor({ state: 'visible' })
    assert.equal(await page.locator('.commands-filters .toggle-button').count(), 5)
    await page.locator('.commands-browser-title').click()
    await page.mouse.move(1100, 800)
    await page.getByRole('tooltip').waitFor({ state: 'hidden' })
    if (run === 1)
      await page.screenshot({ path: new URL('./dark-wide.png', import.meta.url).pathname })
    if (run === 2)
      await page.screenshot({ path: new URL('./light-wide.png', import.meta.url).pathname })
    await page.setViewportSize({ width: 390, height: 844 })
    await select.waitFor({ state: 'visible' })
    const heading = await page.locator('.commands-browser-heading').boundingBox()
    assert((await refresh.boundingBox()).x + 28 <= heading.x + heading.width + 1)
    await toggle.click()
    await page.waitForFunction(() => document.activeElement?.matches('.commands-search input'))
    await input.fill('model')
    await toggle.click()
    await input.waitFor({ state: 'detached' })
    if (run === 3)
      await page.screenshot({ path: new URL('./zh-390.png', import.meta.url).pathname })
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    await select.waitFor({ state: 'visible' })
    await toggle.click()
    await page.waitForFunction(() => document.activeElement?.matches('.commands-search input'))
    assert.equal(
      (await page.locator('.commands-search .search-field__group').boundingBox()).height,
      68,
    )
    await page.waitForFunction(
      () =>
        Math.abs(
          document.querySelector('.commands-search-reveal').getBoundingClientRect().height - 88,
        ) < 0.01,
    )
    if (run === 1)
      await page.screenshot({ path: new URL('./dark-200.png', import.meta.url).pathname })
    await input.press('Escape')
    await input.waitFor({ state: 'detached' })
    await page.evaluate(() => (document.documentElement.style.zoom = ''))
    await toggle.click()
    await toggle.click()
    await toggle.click()
    await page.waitForFunction(() => document.activeElement?.matches('.commands-search input'))
    await input.press('Escape')
    await input.waitFor({ state: 'detached' })
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      defaultListTop: defaultTop,
      searchListTop: expandedTop,
      reclaimedHeight: expandedTop - defaultTop,
      checks: [
        'compact header alignment',
        'autofocus',
        'query and clear',
        'refresh preserves query',
        'Escape clears and returns focus',
        'toggle clears query',
        'source preserved',
        'wide pills / narrow Select',
        '390px',
        'actual 200% zoom',
        'light/dark/Chinese',
        'motion/reduced motion',
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
