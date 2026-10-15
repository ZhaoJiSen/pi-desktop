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
      viewport: { width: 1100, height: 700 },
      reducedMotion: 'no-preference',
    })
    await context.addInitScript(
      ({ run }) => {
        for (const key of ['pi-desktop-preview-v1', 'pi-desktop-workspace-v1'])
          if (!localStorage.getItem(key))
            localStorage.setItem(
              key,
              JSON.stringify({
                state: {
                  language: 'zh',
                  languageSource: 'user',
                  theme: run === 1 ? 'dark' : 'light',
                  onboardingCompleted: true,
                  sidebarOpen: false,
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
    await page.goto('http://127.0.0.1:1432/#/', { waitUntil: 'domcontentloaded' })
    const editor = page.locator('.draft-editor'),
      placeholder = page.locator('.draft-placeholder')
    await editor.waitFor()
    async function setDraft(value) {
      await page.evaluate(async (value) => {
        const { useWorkspace } = await import(
          performance
            .getEntriesByType('resource')
            .find((e) => new URL(e.name).pathname === '/src/store/workspace.ts').name
        )
        const state = useWorkspace.getState()
        state.updateSession(state.activeSessionId, { messages: [], draftNodes: value })
      }, value)
    }
    for (const text of ['', '\n', ' \t\n\u00a0']) {
      await setDraft([{ type: 'text', text }])
      await placeholder.waitFor()
      assert.equal(await placeholder.innerText(), '输入消息，或输入 / 使用命令')
      assert.equal(await editor.getAttribute('data-empty'), 'true')
      assert.equal(await editor.textContent(), text)
      await editor.focus()
      await page.locator('.model-trigger').focus()
      assert(await placeholder.isVisible())
      await editor.focus()
    }
    await page.reload({ waitUntil: 'domcontentloaded' })
    await editor.waitFor()
    await placeholder.waitFor()
    assert.equal(
      await editor.textContent(),
      ' \t\n\u00a0',
      'Stored whitespace remains intact while placeholder is visible',
    )
    await editor.fill('Hello Pi')
    await placeholder.waitFor({ state: 'detached' })
    assert.equal(await editor.getAttribute('data-empty'), 'false')
    await editor.press('Meta+a')
    await editor.press('Backspace')
    await placeholder.waitFor()
    // WebKit can leave filler markup after deleting the last character.
    for (const markup of ['<br>', '<div><br></div>']) {
      await editor.evaluate((el, markup) => {
        el.innerHTML = markup
        el.dispatchEvent(
          new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }),
        )
      }, markup)
      await placeholder.waitFor()
      assert.equal(await editor.getAttribute('data-empty'), 'true')
      assert.equal(await editor.textContent(), '\n')
    }
    await editor.fill('/review')
    await placeholder.waitFor({ state: 'detached' })
    await page.locator('.slash-option').first().click()
    assert.equal(await editor.locator('[data-command-id]').count(), 1)
    assert.equal(await placeholder.count(), 0)
    assert.equal(await editor.getAttribute('data-empty'), 'false')
    await editor.press('Meta+a')
    await editor.press('Backspace')
    await placeholder.waitFor()
    assert.equal(await page.locator('.draft-caret').count(), 0)
    assert(
      await page.evaluate(
        () =>
          new Promise((resolve) => {
            const start = performance.now()
            function sample() {
              const el = document.querySelector('.draft-placeholder')
              if (
                !el ||
                getComputedStyle(el).opacity !== '1' ||
                getComputedStyle(el).animationName !== 'none'
              )
                return resolve(false)
              if (performance.now() - start > 1300) return resolve(true)
              requestAnimationFrame(sample)
            }
            sample()
          }),
      ),
    )
    if (run === 1)
      await page.screenshot({
        path: new URL('./placeholder-fixed-dark.png', import.meta.url).pathname,
        animations: 'disabled',
      })
    if (run === 2)
      await page.screenshot({
        path: new URL('./placeholder-fixed-light.png', import.meta.url).pathname,
        animations: 'disabled',
      })
    assert.deepEqual(errors, [])
    results.push({
      run,
      result: 'passed',
      checks: [
        'Empty text, newline, spaces, tabs and NBSP show static placeholder',
        'Stored blank draft survives refresh unchanged',
        'Real text and command tags hide placeholder',
        'Type and delete restores placeholder',
        'WebKit filler BR and DIV/BR reproduction',
        'Focused and blurred placeholder remain visible',
        'No fake caret and no blink over 1300ms',
        'No page errors',
      ],
    })
    console.log(JSON.stringify(results.at(-1)))
    await context.close()
  }
  await writeFile(
    new URL('./placeholder-results.json', import.meta.url),
    JSON.stringify(results, null, 2) + '\n',
  )
} finally {
  await browser.close()
}
