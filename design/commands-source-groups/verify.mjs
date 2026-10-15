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
      viewport: { width: 1200, height: 1320 },
      reducedMotion: run === 2 ? 'reduce' : 'no-preference',
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
    await page.goto('http://127.0.0.1:1432/#/commands')
    const rows = page.locator('.command-row'),
      groups = page.locator('.commands-source-group'),
      headings = page.locator('.commands-group-heading'),
      input = page.locator('.commands-search input')
    await rows.first().waitFor()
    await page.waitForFunction(() => {
      const s = getComputedStyle(document.querySelector('.commands-view'))
      return Number(s.opacity) === 1 && new DOMMatrix(s.transform).m42 === 0
    })
    assert.equal(await groups.count(), 4)
    assert.equal(await rows.count(), 14)
    assert.deepEqual(await page.locator('.commands-group-count').allTextContents(), [
      '9',
      '2',
      '2',
      '1',
    ])
    assert.equal(await page.locator('.command-source-badge').count(), 0)
    assert.equal(await groups.first().getAttribute('role'), 'group')
    const labelId = await groups.first().getAttribute('aria-labelledby')
    assert(labelId)
    assert((await page.locator(`[id="${labelId}"]`).innerText()).length > 0)
    await rows.nth(8).click()
    await rows.nth(8).press('ArrowDown')
    await page.waitForFunction(() =>
      document.querySelector('.command-row[data-selected=true]')?.textContent.includes('/review'),
    )
    assert.match(await page.locator('.command-inspector .card__title').innerText(), /review/)
    await rows.nth(9).press('ArrowUp')
    await page.waitForFunction(() =>
      document.querySelector('.command-row[data-selected=true]')?.textContent.includes('/hotkeys'),
    )
    await page.locator('.commands-search-toggle').click()
    await input.fill('review')
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 1)
    assert.equal(await groups.count(), 1)
    assert.equal(await page.locator('.commands-group-count').innerText(), '1')
    await input.fill('___no_matching_command___')
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 0)
    assert.equal(await groups.count(), 0)
    assert(await page.locator('.commands-scroll .utility-empty').isVisible())
    await input.press('Escape')
    await input.waitFor({ state: 'detached' })
    await page.locator('.commands-filters .toggle-button').nth(1).click()
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 9)
    assert.equal(await groups.count(), 0)
    await page.locator('.commands-filters .toggle-button').first().click()
    await page.waitForFunction(
      () => document.querySelectorAll('.commands-source-group').length === 4,
    )
    await rows.first().click()
    await page
      .locator('.commands-scroll .package-scroll-viewport')
      .evaluate((el) => (el.scrollTop = 0))
    await page
      .locator('.command-inspector')
      .evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)))
    await page.locator('.commands-browser').screenshot({
      path: new URL(`./${run === 1 ? 'dark' : run === 2 ? 'light' : 'zh'}.png`, import.meta.url)
        .pathname,
    })
    await page.setViewportSize({ width: 1000, height: 900 })
    await page.locator('.commands-workspace > .split-pane-handle').focus()
    await page.locator('.commands-workspace > .split-pane-handle').press('Home')
    await page.locator('.commands-source-select .select__trigger').waitFor({ state: 'visible' })
    await rows.first().waitFor()
    assert.equal(await groups.count(), 4)
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    await headings.first().scrollIntoViewIfNeeded()
    assert.equal((await headings.first().boundingBox()).height, 64)
    assert.equal(await headings.first().evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    if (run === 1)
      await page.screenshot({
        path: new URL('./dark-200.png', import.meta.url).pathname,
        clip: { x: 0, y: 0, width: 540, height: 900 },
      })
    await page.evaluate(() => (document.documentElement.style.zoom = ''))
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await headings.first().evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    assert.equal(
      await page.locator('.commands-browser').evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    )
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      checks: [
        'four source groups and counts',
        '14 commands retained',
        'no repeated row labels',
        'accessible section headers',
        'keyboard crosses sections and updates detail',
        'search count and empty groups',
        'single-source flat list',
        'wide pills and narrow Select',
        'Chinese and English',
        'light and dark',
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
