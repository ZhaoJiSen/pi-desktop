import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
async function state(page, patch) {
  await page.evaluate(async (patch) => {
    const { useWorkspace } = await import(
      performance
        .getEntriesByType('resource')
        .find((e) => new URL(e.name).pathname === '/src/store/workspace.ts').name
    )
    const s = useWorkspace.getState()
    s.updateSession(s.activeSessionId, patch)
  }, patch)
}
async function settled(page, selector) {
  await page.waitForFunction((selector) => {
    const el = document.querySelector(selector)
    return (
      el &&
      getComputedStyle(el).opacity === '1' &&
      [...el.querySelectorAll('.model-popover-content')].every(
        (c) => getComputedStyle(c).opacity === '1',
      )
    )
  }, selector)
}
async function bounds(page, selector) {
  await settled(page, selector)
  await page.waitForFunction((selector) => {
    const el = document.querySelector(selector)
    if (!el) return false
    const r = el.getBoundingClientRect(),
      b = document.querySelector('.main').getBoundingClientRect()
    return r.top >= b.top + 23.5 && r.bottom <= Math.min(b.bottom, innerHeight) - 23.5
  }, selector)
  const metric = await page.locator(selector).evaluate((el) => {
    const r = el.getBoundingClientRect(),
      b = document.querySelector('.main').getBoundingClientRect()
    return {
      top: r.top,
      bottom: r.bottom,
      left: r.left,
      right: r.right,
      height: r.height,
      boundaryTop: b.top,
      boundaryBottom: b.bottom,
      viewport: innerHeight,
      placement: el.dataset.placement,
    }
  })
  assert(metric.top >= metric.boundaryTop + 23.5, JSON.stringify(metric))
  assert(
    metric.bottom <= Math.min(metric.boundaryBottom, metric.viewport) - 23.5,
    JSON.stringify(metric),
  )
  assert(metric.left >= 0 && metric.right <= 1200, JSON.stringify(metric))
  return metric
}
async function scrollWorks(page, selector) {
  const el = page.locator(selector)
  assert(
    await el.evaluate((el) => el.scrollHeight > el.clientHeight),
    'List must have constrained overflow',
  )
  await el.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await page.waitForFunction((selector) => document.querySelector(selector).scrollTop > 0, selector)
  await el.evaluate((el) => (el.scrollTop = 0))
}
try {
  for (let run = 1; run <= 3; run++) {
    const context = await browser.newContext({
      viewport: { width: 1100, height: 560 },
      deviceScaleFactor: run === 3 ? 2 : 1,
      reducedMotion: run === 3 ? 'no-preference' : 'reduce',
    })
    await context.addInitScript(
      ({ run }) => {
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1']) {
          if (!localStorage.getItem(key))
            localStorage.setItem(
              key,
              JSON.stringify({
                state: {
                  language: run === 3 ? 'zh' : 'en',
                  languageSource: 'user',
                  theme: run === 1 ? 'dark' : 'light',
                  onboardingCompleted: true,
                  sidebarOpen: false,
                },
                version: 2,
              }),
            )
        }
      },
      { run },
    )
    const page = await context.newPage(),
      errors = [],
      cases = []
    await page.routeWebSocket(/.*/, (socket) => socket.close())
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('http://127.0.0.1:1432/#/', { waitUntil: 'domcontentloaded' })
    await page.locator('.draft-editor').waitFor()
    await state(page, { messages: [], draft: '', draftNodes: [] })
    await page.locator('.chat-page.is-empty').waitFor()
    const editor = page.locator('.draft-editor')
    assert.equal(await editor.innerText(), '')
    assert.equal(
      await page.locator('.draft-caret').count(),
      0,
      'No decorative fake caret or default slash',
    )
    const placeholder = page.locator('.draft-placeholder')
    assert.equal(await placeholder.evaluate((el) => getComputedStyle(el).animationName), 'none')
    assert.equal(
      await editor.evaluate((el) => getComputedStyle(el).caretColor === 'rgba(0, 0, 0, 0)'),
      false,
    )
    assert(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const start = performance.now(),
              samples = []
            function sample() {
              samples.push(getComputedStyle(document.querySelector('.draft-placeholder')).opacity)
              if (performance.now() - start > 1300) return resolve(samples.every((v) => v === '1'))
              requestAnimationFrame(sample)
            }
            sample()
          }),
      ),
      'Placeholder remains visible through old blink cycle',
    )
    if (run === 1)
      await page.screenshot({
        path: new URL('./empty-dark.png', import.meta.url).pathname,
        animations: 'disabled',
      })
    for (const native of [false, true]) {
      await page
        .locator('.app-shell')
        .evaluate((el, native) => el.classList.toggle('native', native), native)
      for (const height of [480, 560, 800]) {
        await page.setViewportSize({ width: 1100, height })
        await page.locator('.model-trigger').click()
        const model = await bounds(page, '.model-popover')
        await scrollWorks(page, '.model-options')
        const search = page.locator('.model-popover input')
        await search.fill('sonnet')
        await page.waitForFunction(() => document.querySelectorAll('.model-row').length === 1)
        await search.fill('')
        await page.waitForFunction(() => document.querySelectorAll('.model-row').length > 1)
        if (run === 1 && height === 480 && native)
          await page.screenshot({
            path: new URL('./model-short-dark.png', import.meta.url).pathname,
            animations: 'disabled',
          })
        await page.keyboard.press('Escape')
        await page.locator('.model-popover').waitFor({ state: 'detached' })
        await editor.fill('/')
        await page.locator('.slash-panel').waitFor()
        const slash = await bounds(page, '.slash-panel')
        assert(
          await editor.evaluate((el) => document.activeElement === el),
          'Slash menu preserves editor focus',
        )
        if (height < 800) await scrollWorks(page, '.slash-options')
        await editor.press('ArrowDown')
        assert.equal(
          await page.locator('.slash-option').nth(1).getAttribute('aria-selected'),
          'true',
        )
        if (run === 1 && height === 480 && native)
          await page.screenshot({
            path: new URL('./slash-short-dark.png', import.meta.url).pathname,
            animations: 'disabled',
          })
        if (run === 2 && height === 560 && native)
          await page.screenshot({
            path: new URL('./slash-light.png', import.meta.url).pathname,
            animations: 'disabled',
          })
        await editor.press('Escape')
        await page.locator('.slash-panel').waitFor({ state: 'detached' })
        assert.equal(await editor.innerText(), '/')
        await editor.fill('')
        cases.push({ native, height, model, slash })
      }
    }
    await page.setViewportSize({ width: 1100, height: 1200 })
    await page.locator('.model-trigger').click()
    assert.equal((await bounds(page, '.model-popover')).placement, 'bottom')
    await page.keyboard.press('Escape')
    await page.locator('.model-popover').waitFor({ state: 'detached' })
    await editor.fill('/')
    await page.locator('.slash-panel').waitFor()
    assert.equal((await bounds(page, '.slash-panel')).placement, 'bottom')
    await page.setViewportSize({ width: 1100, height: 480 })
    await bounds(page, '.slash-panel')
    await editor.press('Escape')
    await page.locator('.slash-panel').waitFor({ state: 'detached' })
    await editor.fill('')
    await page.setViewportSize({ width: 1100, height: 800 })
    // Window resize while the same menu is open must update its constrained height.
    await page.locator('.model-trigger').click()
    await page.setViewportSize({ width: 1100, height: 480 })
    await bounds(page, '.model-popover')
    await page.keyboard.press('Escape')
    await page.locator('.model-popover').waitFor({ state: 'detached' })
    await editor.fill('/review')
    await page.locator('.slash-option').waitFor()
    await page.locator('.slash-option').first().click()
    assert.equal(await editor.locator('[data-command-id]').count(), 1)
    assert(await editor.evaluate((el) => document.activeElement === el))
    await editor.fill('/thinking')
    await page.locator('.slash-option').waitFor()
    await editor.press('Enter')
    assert.equal(await editor.locator('[data-command-id]').count(), 1)
    await editor.press('Enter')
    await page.locator('.thinking-popover').waitFor()
    await bounds(page, '.thinking-popover')
    await page.keyboard.press('Escape')
    await page.locator('.thinking-popover').waitFor({ state: 'detached' })
    // Both placement directions, including an existing conversation at the bottom.
    await state(page, {
      messages: [
        {
          id: 'preview-message',
          role: 'user',
          timestamp: Date.now(),
          blocks: [{ type: 'text', text: 'Review this project.' }],
        },
      ],
      draftNodes: [],
    })
    await page.locator('.chat-page:not(.is-empty)').waitFor()
    await editor.fill('/')
    await page.locator('.slash-panel').waitFor()
    assert.equal((await bounds(page, '.slash-panel')).placement, 'top')
    await editor.press('Escape')
    await page.locator('.slash-panel').waitFor({ state: 'detached' })
    await editor.fill('')
    await state(page, { messages: [], draftNodes: [] })
    // 2x reading-size capture: a 550x600 CSS viewport rendered into 1100x1200 physical pixels.
    // Use Chromium viewport metrics rather than CSS zoom, which changes geometry measured by overlays.
    await page.setViewportSize({ width: 550, height: 600 })
    await page.locator('.model-trigger').click()
    await bounds(page, '.model-popover')
    if (run === 3)
      await page.screenshot({
        path: new URL('./model-200-zh.png', import.meta.url).pathname,
        animations: 'disabled',
      })
    await page.keyboard.press('Escape')
    await page.locator('.model-popover').waitFor({ state: 'detached' })
    await editor.fill('/')
    await page.locator('.slash-panel').waitFor()
    const zoom = await bounds(page, '.slash-panel')
    if (run === 3)
      await page.screenshot({
        path: new URL('./slash-200-zh.png', import.meta.url).pathname,
        animations: 'disabled',
      })
    await editor.press('Escape')
    await page.locator('.slash-panel').waitFor({ state: 'detached' })
    await editor.fill('')
    await page.setViewportSize({ width: 1100, height: 800 })
    // A real draft is retained, including an intentional slash; never clear user data to fix appearance.
    await editor.fill('/my-existing-draft')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await editor.waitFor()
    assert.equal(await editor.innerText(), '/my-existing-draft')
    await page.evaluate(() => {
      window.originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function () {
        throw new Error('Preview storage failure')
      }
    })
    await editor.fill('Draft stays visible if saving fails')
    assert.equal(await editor.innerText(), 'Draft stays visible if saving fails')
    await page.evaluate(() => (Storage.prototype.setItem = window.originalSetItem))
    assert.deepEqual(errors, [])
    const result = {
      run,
      result: 'passed',
      cases,
      zoom,
      checks: [
        'Empty draft, no fake caret or default slash',
        'Static placeholder over 1300ms',
        'Model/slash safe top and bottom gaps in 480/560/800px native and framed windows',
        'Internal list scrolling and search',
        'Live window resize',
        'Slash keyboard and pointer selection preserve focus',
        'Thinking popup and existing-conversation top placement',
        '2x reading-size rendering with a 550x600 CSS viewport',
        'Persisted slash draft survives reload',
        'Save failure preserves visible draft',
        'No page errors',
      ],
    }
    results.push(result)
    console.log(JSON.stringify({ run, result: 'passed', cases: cases.length, zoom }))
    await context.close()
  }
  await writeFile(
    new URL('./results.json', import.meta.url),
    JSON.stringify(results, null, 2) + '\n',
  )
} finally {
  await browser.close()
}
