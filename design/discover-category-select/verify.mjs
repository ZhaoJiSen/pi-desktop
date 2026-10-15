import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const out = new URL('./verified/', import.meta.url)
await mkdir(out, { recursive: true })
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
try {
  for (let run = 1; run <= 3; run++) {
    const language = run === 3 ? 'zh' : 'en'
    const context = await browser.newContext({
      viewport: { width: 1200, height: 900 },
      reducedMotion: 'reduce',
    })
    await context.addInitScript(
      ({ language }) => {
        localStorage.setItem('pi.sidebar-panel-width', '420')
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1']) {
          localStorage.setItem(
            key,
            JSON.stringify({
              state: { language, languageSource: 'user', theme: 'dark', onboardingCompleted: true },
              version: 2,
            }),
          )
        }
      },
      { language },
    )
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('http://127.0.0.1:1420/#/extensions')
    await page.locator('.package-tabs .tabs__tab').nth(1).click()
    const buttons = page.locator('.package-categories .toggle-button')
    const select = page.locator('.package-category-select')
    const trigger = select.locator('.select__trigger')
    const handle = page.locator('.package-workspace > .split-pane-handle')
    await page.locator('.package-categories').waitFor({ state: 'visible' })
    const boxes = await buttons.evaluateAll((items) =>
      items.map((item) => {
        const r = item.getBoundingClientRect()
        return { top: r.top, left: r.left, right: r.right }
      }),
    )
    assert.equal(boxes.length, 5)
    assert(
      boxes.every((box) => Math.abs(box.top - boxes[0].top) < 1),
      'Five categories must remain on one row',
    )
    const group = await page.locator('.package-categories').boundingBox()
    assert(
      boxes.every((box) => box.left >= group.x && box.right <= group.x + group.width + 1),
      'Buttons must fit within the library',
    )
    await buttons.nth(3).click()
    await page.waitForFunction(
      () =>
        document
          .querySelectorAll('.package-categories .toggle-button')[3]
          ?.getAttribute('data-selected') === 'true',
    )
    if (run === 1) await page.screenshot({ path: new URL('english-wide.png', out).pathname })
    await handle.focus()
    await handle.press('Home')
    await select.waitFor({ state: 'visible' })
    assert.equal(await page.locator('.package-categories').isVisible(), false)
    assert.match(await trigger.innerText(), language === 'zh' ? /提示词/ : /Prompts/)
    assert((await trigger.boundingBox()).height <= 36, 'Select stays a compact single row')
    await trigger.click()
    const options = page.getByRole('option')
    assert.equal(await options.count(), 5)
    if (run === 1) {
      await page.locator('[data-slot="select-popover"]').evaluate(async (element) => {
        await Promise.all(
          element.getAnimations({ subtree: true }).map((animation) => animation.finished),
        )
      })
      await page.screenshot({ path: new URL('english-narrow-menu.png', out).pathname })
    }
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.getByRole('option').first().waitFor({ state: 'hidden' })
    assert.match(await trigger.innerText(), language === 'zh' ? /主题/ : /Themes/)
    await handle.focus()
    await handle.press('End')
    await page.locator('.package-categories').waitFor({ state: 'visible' })
    assert.equal(
      await buttons.nth(4).getAttribute('data-selected'),
      'true',
      'Selection survives widening',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await select.waitFor({ state: 'visible' })
    assert.match(await trigger.innerText(), language === 'zh' ? /主题/ : /Themes/)
    await trigger.click()
    await page.keyboard.press('Home')
    await page.keyboard.press('Enter')
    await page.getByRole('option').first().waitFor({ state: 'hidden' })
    assert.match(await trigger.innerText(), language === 'zh' ? /全部/ : /All/)
    const overflow = await select.evaluate(
      (element) => element.scrollWidth > element.clientWidth + 1,
    )
    assert.equal(overflow, false, 'No category control overflow on mobile')
    if (run === 1 || run === 3)
      await page.screenshot({ path: new URL(`${language}-390.png`, out).pathname })
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => {
      document.documentElement.style.zoom = '2'
    })
    await select.waitFor({ state: 'visible' })
    if (run === 1) await page.screenshot({ path: new URL('english-zoom-200.png', out).pathname })
    await page.evaluate(() => {
      document.documentElement.style.zoom = ''
    })
    await page.locator('.package-tabs .tabs__tab').first().click()
    assert.equal(await select.count(), 0, 'Discover filter is absent on Installed')
    await page.locator('.package-tabs .tabs__tab').nth(1).click()
    assert.equal(await buttons.first().getAttribute('data-selected'), 'true')
    assert.deepEqual(errors, [])
    results.push({
      run,
      language,
      result: 'passed',
      checks: [
        'single row',
        'narrow Select',
        'keyboard selection',
        'selection retained across resizing',
        '390px',
        '200% zoom',
        'Installed/Discover isolation',
        'no page errors',
      ],
    })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
  await writeFile(new URL('results.json', out), JSON.stringify(results, null, 2) + '\n')
} finally {
  await browser.close()
}
