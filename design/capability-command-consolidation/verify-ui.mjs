const assert = (value, message) => {
  if (!value) throw new Error(message)
}
export async function verifyConsolidation(tab, round, report = () => {}) {
  const p = tab.playwright,
    b = (name) => p.getByRole('button', { name, exact: true }),
    input = () => p.locator('.composer-input')
  const snapshot = () => p.domSnapshot(),
    nav = (name) =>
      p
        .getByRole('listbox', { name: 'Settings sections', exact: true })
        .getByRole('option', { name, exact: true })
  const save = () =>
    p
      .locator('.capability-settings-footer')
      .getByRole('button', { name: 'Save changes', exact: true })
  const pinned = () => p.locator('.capability-pinned-list li').allTextContents()
  const body = () => input().evaluate((el) => el.value)
  const logs = async () =>
    JSON.parse((await p.locator('body').getAttribute('data-requests')) || '[]')
  const url = `http://localhost:1420/design/capability-command-consolidation/preview.html?seed=verify-${round}&lang=en&theme=dark&many=1`
  await tab.goto(url)
  await input().waitFor({ state: 'visible' })
  await snapshot()
  report('empty ability send')
  await input().fill('/explain')
  await input().press('Enter')
  await p.locator('.capability-tag').waitFor({ state: 'visible' })
  await snapshot()
  assert((await body()) === '', 'Selecting an ability does not insert prompt text')
  await b('Send').click()
  await p.locator('.user-capability-request').waitFor({ state: 'visible' })
  await p.locator('.capability-tag').waitFor({ state: 'hidden' })
  await snapshot()
  assert(
    (await p.locator('.user-message').innerText()) === 'Explain code',
    'Empty body displays frozen ability name',
  )
  assert((await p.locator('.user-capability-request svg').count()) === 1, 'Ability icon is present')
  const calls = await logs()
  assert(
    calls.some((call) => call.type === 'prompt' && call.message === ''),
    'No display fallback is injected into body',
  )
  assert(
    calls.some(
      (call) =>
        call.type === 'desktop_bridge' &&
        call.call.op === 'prepare' &&
        call.call.submission.task.prompt,
    ),
    'Instructions travel in separate snapshot',
  )
  await tab.reload()
  await p.locator('.user-capability-request').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.user-message').innerText()) === 'Explain code',
    'History restores ability name from receipt',
  )
  report('failed send and Chinese draft')
  await input().fill('/explain 中文草稿')
  await input().press('Enter')
  await p.locator('.capability-tag').waitFor({ state: 'visible' })
  await snapshot()
  await tab.pressKey(null, 'F9')
  await b('Send').click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await p.locator('.send:not([disabled])').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await body()) === '中文草稿' && (await p.locator('.capability-tag').count()) === 1,
    'Failure retains draft and ability',
  )
  await tab.pressKey(null, 'F10')
  await b('Send').click()
  await p.locator('.capability-tag').waitFor({ state: 'hidden' })
  await snapshot()
  assert(
    (await p.locator('.user-message').last().innerText()) === '中文草稿',
    'Normal body stays unchanged',
  )
  report('settings geometry and sorting')
  await b('settings').click()
  await nav('General').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.settings-navigation [role=option]').count()) === 5,
    'Capabilities is no longer duplicated in Settings',
  )
  const geometry = await p.evaluate(() => {
    const root = document.querySelector('.settings-workspace').getBoundingClientRect(),
      n = document.querySelector('.settings-navigation').getBoundingClientRect(),
      first = document.querySelector('.settings-navigation [role=option]').getBoundingClientRect()
    return { inset: n.left - root.left, height: first.height }
  })
  assert(
    geometry.inset <= 32 && geometry.height <= 38,
    'Settings sidebar is left anchored and compact',
  )
  await nav('Shortcuts').click()
  await b('Reorder Review changes').waitFor({ state: 'visible' })
  await snapshot()
  await b('Reorder Review changes').press('ArrowDown')
  await snapshot()
  assert((await pinned())[0].includes('Draft commit message'), 'Keyboard reorders pinned items')
  await p
    .locator('.capability-pinned-list li[style*="transform: none"]')
    .nth(1)
    .waitFor({ state: 'visible' })
  await snapshot()
  const centers = await p.evaluate(() =>
    [...document.querySelectorAll('.capability-drag-handle')].map((el) => {
      const r = el.getBoundingClientRect()
      return [r.x + r.width / 2, r.y + r.height / 2]
    }),
  )
  await tab.drag(centers[1], [centers[0][0], centers[0][1] - 10])
  await snapshot()
  assert((await pinned())[0].includes('Review changes'), 'Pointer dragging reorders pinned items')
  await b('Reorder Review changes').press('ArrowDown')
  await snapshot()
  await b('Manage capabilities').click()
  await p.locator('.capability-command-browser').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.capability-command-browser [role=option]').count()) === 5,
    'Runtime catalog is not duplicated in ability manager',
  )
  assert(await save().isEnabled(), 'Unsaved shortcuts draft survives navigation to Commands')
  await tab.pressKey(null, 'F8')
  await save().click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(await save().isEnabled(), 'Save failure keeps draft dirty')
  await tab.pressKey(null, 'F10')
  await save().click()
  await p.locator('.capability-settings-footer button[disabled]').waitFor({ state: 'visible' })
  await snapshot()
  report('native command configuration')
  await p
    .locator('.command-workspace-navigation')
    .getByRole('button', { name: 'Commands', exact: true })
    .click()
  await p.getByRole('option', { name: /\/review-loop/ }).waitFor({ state: 'visible' })
  await snapshot()
  await p.getByRole('option', { name: /\/review-loop/ }).click()
  await b('Configure shortcut').waitFor({ state: 'visible' })
  await snapshot()
  await b('Pin to shortcuts').click()
  await b('Configure shortcut').click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snapshot()
  await p
    .getByRole('dialog')
    .getByRole('textbox', { name: 'Instructions', exact: true })
    .fill('Keep native invocation. Check boundaries only.')
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snapshot()
  await save().click()
  await p.locator('.capability-settings-footer button[disabled]').waitFor({ state: 'visible' })
  await snapshot()
  await tab.reload()
  await input().waitFor({ state: 'visible' })
  await snapshot()
  await b('settings').click()
  await nav('Shortcuts').click()
  await b('Reorder Review changes').waitFor({ state: 'visible' })
  await snapshot()
  const order = await pinned()
  assert(
    order[0].includes('Draft commit message') &&
      order.some((text) => text.includes('Review & fix')),
    'Saved order and native pin read back after refresh',
  )
  await b('Manage capabilities').click()
  await p.locator('.capability-command-browser').waitFor({ state: 'visible' })
  await snapshot()
  await p
    .locator('.command-workspace-navigation')
    .getByRole('button', { name: 'Commands', exact: true })
    .click()
  await p.getByRole('option', { name: /\/review-loop/ }).click()
  await b('Configure shortcut').click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p
      .getByRole('dialog')
      .getByRole('textbox', { name: 'Instructions', exact: true })
      .evaluate((el) => el.value)) === 'Keep native invocation. Check boundaries only.',
    'Native configuration reads back',
  )
  await p.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await snapshot()
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  assert(!overflow, 'No horizontal viewport overflow')
  return {
    round,
    passed: true,
    emptyBubble: true,
    history: true,
    hiddenInstructions: true,
    failedSend: true,
    chineseDraft: true,
    compactSettings: true,
    keyboardSort: true,
    pointerSort: true,
    crossPageDraft: true,
    saveFailure: true,
    persistence: true,
    nativeDeduplication: true,
    nativeConfiguration: true,
    noOverflow: true,
  }
}
