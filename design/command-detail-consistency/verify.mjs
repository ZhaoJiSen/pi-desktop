import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { chromium } from '/Users/zhaojisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
})
const results = []
const css = async (locator, names) =>
  locator.evaluate(
    (el, names) => Object.fromEntries(names.map((n) => [n, getComputedStyle(el)[n]])),
    names,
  )
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
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
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
    const reference = page.locator('.package-detail')
    await reference.waitFor()
    const padding = await css(reference, [
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
    ])
    const title = await css(reference.locator('.card__title'), [
      'fontSize',
      'fontWeight',
      'lineHeight',
      'letterSpacing',
    ])
    const description = await css(reference.locator('.package-description'), [
      'fontSize',
      'lineHeight',
      'color',
    ])
    const label = await css(reference.locator('.package-source h4'), [
      'fontSize',
      'fontWeight',
      'marginBottom',
    ])
    const chip = await css(reference.locator('.chip').first(), [
      'height',
      'fontSize',
      'paddingLeft',
      'paddingRight',
    ])
    await page.goto('http://127.0.0.1:1432/#/commands', { waitUntil: 'domcontentloaded' })
    const card = page.locator('.command-inspector')
    await card.waitFor()
    assert.deepEqual(
      await css(card, ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft']),
      padding,
    )
    assert.deepEqual(
      await css(card.locator('.card__title'), [
        'fontSize',
        'fontWeight',
        'lineHeight',
        'letterSpacing',
      ]),
      title,
    )
    assert.deepEqual(
      await css(card.locator('.command-summary'), ['fontSize', 'lineHeight', 'color']),
      description,
    )
    assert.deepEqual(
      await css(card.locator('.command-usage h3'), ['fontSize', 'fontWeight', 'marginBottom']),
      label,
    )
    assert.deepEqual(
      await css(card.locator('.command-source'), [
        'height',
        'fontSize',
        'paddingLeft',
        'paddingRight',
      ]),
      chip,
    )
    assert.equal(
      await card
        .locator('.button')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
      '12px',
    )
    const choose = async (name) => {
      await page
        .locator('.command-row')
        .filter({
          has: page.locator('.sidebar-option-title strong', { hasText: new RegExp(`^/${name}$`) }),
        })
        .click()
      await card
        .locator('.card__title')
        .filter({ hasText: `/${name}` })
        .waitFor()
    }
    for (const name of ['review', 'model', 'tree', 'skill:commit']) {
      await choose(name)
      assert.match(await card.locator('.command-syntax').innerText(), new RegExp(`/${name}`))
      assert.equal(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
      assert.equal(
        await card.locator('.card__title').evaluate((el) => getComputedStyle(el).fontSize),
        '19px',
      )
    }
    await page.setViewportSize({ width: 900, height: 900 })
    assert.deepEqual(await css(card, ['paddingTop', 'paddingRight']), {
      paddingTop: '20px',
      paddingRight: '20px',
    })
    await page.setViewportSize({ width: 390, height: 844 })
    await card.scrollIntoViewIfNeeded()
    assert.equal(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    assert.equal(
      await card.locator('.command-origin').evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
    )
    if (run === 3)
      await card.screenshot({ path: new URL('./zh-390.png', import.meta.url).pathname })
    await page.setViewportSize({ width: 1200, height: 900 })
    await page.evaluate(() => (document.documentElement.style.zoom = '2'))
    await card.scrollIntoViewIfNeeded()
    assert.equal(await card.evaluate((el) => el.scrollWidth <= el.clientWidth), true)
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      checks: [
        'detail padding matches Extensions',
        '19px title and 13px description match reference',
        '11px labels and 24px chips match reference',
        '12px action label',
        'command selection and usage stay synchronized',
        'model selector and terminal-only state',
        '900px compact padding',
        '390px long path wrapping',
        'actual CSS 200% zoom',
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
