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
        localStorage.setItem('pi.sidebar-panel-width', '280')
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
          localStorage.setItem(
            key,
            JSON.stringify({
              state: {
                language: run === 3 ? 'zh' : 'en',
                languageSource: 'user',
                theme: run === 2 ? 'dark' : 'light',
                onboardingCompleted: true,
              },
              version: 2,
            }),
          )
      },
      { run },
    )
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://127.0.0.1:1420/#/commands')
    const search = page.locator('.commands-search .search-field__group')
    const input = page.locator('.commands-search input')
    const select = page.locator('.commands-source-select .select__trigger')
    await select.waitFor({ state: 'visible' })
    const searchBox = await search.boundingBox(),
      selectBox = await select.boundingBox(),
      refreshBox = await page.locator('.commands-refresh').boundingBox()
    assert.equal(searchBox.height, 34)
    assert(Math.abs(searchBox.height - selectBox.height) < 0.5)
    assert.equal(refreshBox.height, 34)
    await input.fill('settings')
    await page.waitForFunction(() => document.querySelectorAll('.command-row').length === 1)
    const clear = page.locator('.commands-search .search-field__clear-button')
    await clear.click()
    assert.equal(await input.inputValue(), '')
    for (const el of [input, page.locator('.commands-search .search-field__search-icon')]) {
      const box = await el.boundingBox()
      assert(
        Math.abs(box.y + box.height / 2 - searchBox.y - searchBox.height / 2) < 1,
        'Input and icon vertically centered',
      )
      assert(box.y >= searchBox.y && box.y + box.height <= searchBox.y + searchBox.height)
    }
    if (run === 1) await page.screenshot({ path: new URL('./after.png', import.meta.url).pathname })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal((await search.boundingBox()).height, 34)
    await input.fill('settings')
    await clear.click()
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    assert.equal((await search.boundingBox()).height, 68)
    if (run === 1)
      await page.screenshot({ path: new URL('./after-200.png', import.meta.url).pathname })
    await page.evaluate(() => (document.documentElement.style.zoom = ''))
    await page.goto('http://127.0.0.1:1420/#/extensions')
    await page.locator('.package-search-toggle').click()
    await page.locator('.package-search').waitFor({ state: 'visible' })
    const extensionHeight = (
      await page.locator('.package-search .search-field__group').boundingBox()
    ).height
    assert.equal(extensionHeight, searchBox.height)
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      commandSearch: searchBox.height,
      extensionSearch: extensionHeight,
      select: selectBox.height,
      refresh: refreshBox.height,
      checks: [
        'matching heights',
        'centered input and icon',
        'search and clear',
        '390px',
        '200% zoom',
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
