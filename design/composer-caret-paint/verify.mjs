export async function verifyCaretPaint(tab, run = 1, zoom = 1) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  await tab.goto(
    `http://localhost:1420/design/composer-caret-paint/preview.html?state=empty&seed=paint-${run}&zoom=${zoom}`,
  )
  const editor = tab.playwright.locator('.draft-editor')
  await editor.waitFor({ state: 'visible' })
  await editor.fill('')
  const measure = () =>
    tab.playwright.evaluate(() => {
      const e = document.querySelector('.draft-editor'),
        f = e.closest('.draft-field'),
        s = window.getSelection(),
        r = s.getRangeAt(0)
      const c =
          r.getClientRects()[0] || e.querySelector('[data-editor-tail]')?.getBoundingClientRect(),
        b = f.getBoundingClientRect()
      return {
        text: e.textContent,
        focused: document.activeElement === e,
        caret: c ? { top: c.top, bottom: c.bottom, height: c.height } : null,
        view: { top: b.top, bottom: b.bottom },
        scroll: f.scrollTop,
        max: f.scrollHeight - f.clientHeight,
        pageScroll: document.scrollingElement.scrollTop,
      }
    })
  const visible = (m) =>
    assert(
      m.focused &&
        m.caret?.height >= 16 * zoom &&
        m.caret.top >= m.view.top &&
        m.caret.bottom <= m.view.bottom,
      'Focused caret line must remain fully inside scrollport',
    )
  const boundaries = []
  // Native input keeps the existing focus, unlike locator.press() which can refocus.
  for (let n = 1; n <= 40; n++) {
    await tab.pressKey(null, 'shift+Return')
    if ([6, 7, 8, 16, 24, 40].includes(n)) {
      await tab.getAXState({ emit: false })
      const m = await measure()
      visible(m)
      assert(m.text === '\n'.repeat(n), 'Newlines must survive exactly')
      assert(
        m.max - m.scroll <= 8 && m.pageScroll === 0,
        'Only the editor should scroll to reveal the final line',
      )
      boundaries.push(m)
    }
  }
  await tab.pressKey(null, 'x')
  await tab.getAXState({ emit: false })
  const typing = await measure()
  visible(typing)
  assert(typing.text.endsWith('\nx'), 'Continued typing must stay at the end')
  await tab.pressKey(null, 'super+z')
  await tab.getAXState({ emit: false })
  const undo = await measure()
  visible(undo)
  assert(undo.text === '\n'.repeat(40), 'Undo restores blank last line')
  await tab.pressKey(null, 'super+shift+z')
  await tab.getAXState({ emit: false })
  const redo = await measure()
  visible(redo)
  assert(redo.text.endsWith('x'), 'Redo restores typed character')
  for (let n = 0; n < 41; n++) await tab.pressKey(null, 'Left')
  await tab.pressKey(null, 'a')
  await tab.getAXState({ emit: false })
  const start = await measure()
  visible(start)
  assert(
    start.text.startsWith('a\n') && start.scroll <= 8,
    'Editing at the top must stay at the top',
  )
  await tab.reload()
  await editor.waitFor({ state: 'visible' })
  await tab.getAXState({ emit: false })
  const restored = await measure()
  visible(restored)
  assert(restored.text === start.text, 'Saved draft survives reload')
  await tab.pressKey(null, 'F7')
  await tab.pressKey(null, 'x')
  await tab.getAXState({ emit: false })
  const failed = await measure()
  visible(failed)
  assert(
    (await tab.playwright.locator('body').getAttribute('data-storage-error')) === 'true',
    'Failure fixture must report actual save error',
  )
  assert(failed.text.endsWith('x'), 'Save failure must retain live input')
  await tab.pressKey(null, 'F8')
  await tab.pressKey(null, 'y')
  await tab.getAXState({ emit: false })
  const recovered = await measure()
  visible(recovered)
  await tab.reload()
  await editor.waitFor({ state: 'visible' })
  await tab.getAXState({ emit: false })
  assert((await measure()).text === recovered.text, 'Recovery must persist new draft')
  return {
    run,
    zoom,
    boundaries,
    typing,
    undo,
    redo,
    start,
    restored,
    saveFailureRetained: true,
    recoveryPersisted: true,
  }
}
