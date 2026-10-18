const assert = (value, label) => {
  if (!value) throw new Error(label)
}
export async function verifyRefresh(tab, round, report = () => {}) {
  const p = tab.playwright
  const snap = () => p.domSnapshot()
  const button = (name) => p.getByRole('button', { name, exact: true })
  const input = () => p.locator('.composer-input')
  const body = () => input().evaluate((e) => e.value)
  const search = () => p.getByRole('searchbox', { name: 'Search capabilities…', exact: true })
  const tags = () => p.locator('.capability-tag')
  const nav = (name) =>
    p
      .getByRole('listbox', { name: 'Settings sections', exact: true })
      .getByRole('option', { name, exact: true })
  const requestLog = async () =>
    JSON.parse((await p.locator('body').getAttribute('data-requests')) || '[]')
  const closePicker = async () => {
    await search().fill('')
    await search().press('Escape')
    await p.locator('.capability-picker').waitFor({ state: 'hidden' })
    await snap()
  }
  report('step 13')
  await tab.goto(
    `http://localhost:1420/design/capability-settings-refresh/preview.html?seed=verify-${round}&lang=en&theme=dark&many=1`,
  )
  report('step 14')
  await input().waitFor({ state: 'visible' })
  await input().fill('保留我的草稿')
  await p
    .locator('.composer-prompt-actions')
    .getByRole('button', { name: 'Review changes', exact: true })
    .click()
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert((await body()) === '保留我的草稿', 'shortcut preserves Chinese draft')
  const layout = await p.evaluate(() => {
    let a = document.querySelector('.attach').getBoundingClientRect(),
      b = document.querySelector('.capability-tags').getBoundingClientRect()
    return {
      wide: document.querySelector('.composer').clientWidth > 620,
      sameRow: Math.abs(a.top + a.height / 2 - (b.top + b.height / 2)) < 5,
      right: b.left > a.right,
      above: b.bottom <= a.top,
    }
  })
  assert(
    layout.wide ? layout.sameRow && layout.right : layout.above,
    'tags use wide bottom bar or narrow fallback',
  )
  report('step 18')
  await p.locator('.capability-tag-label').click()
  await p.getByRole('dialog', { name: 'Capability details' }).waitFor({ state: 'visible' })
  await snap()
  assert((await body()) === '保留我的草稿', 'details keeps draft')
  await tab.pressKey(null, 'Escape')
  await p.getByRole('dialog', { name: 'Capability details' }).waitFor({ state: 'hidden' })
  await snap()
  report('step 19')
  await p.getByRole('row', { name: 'Review changes', exact: true }).press('Delete')
  await tags().waitFor({ state: 'hidden' })
  await snap()
  report('step 20')
  await input().fill('/plan 保留我的草稿')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert((await body()) === '保留我的草稿', 'slash selects mode without prompt insertion')
  assert(
    await p.locator('.capability-tag-label').isEnabled(),
    'mode tag enabled after acknowledgment',
  )
  report('step 21')
  await button('More capabilities').click()
  await search().fill('tests')
  await snap()
  assert(
    !(await p.getByRole('option', { name: /Add tests/ }).isEnabled()),
    'plan blocks modifying tasks',
  )
  await closePicker()
  report('step 22')
  await p.locator('.capability-tag-remove').click()
  await tags().waitFor({ state: 'hidden' })
  await snap()
  report('step 23')
  await button('More capabilities').click()
  await search().fill('pi-ui-tools')
  await snap()
  assert(
    (await p.locator('.capability-picker-item').count()) === 12,
    'picker searches plugin origin',
  )
  report('step 24')
  await search().fill('review-loop')
  await search().press('ArrowDown')
  await snap()
  assert(
    await p.evaluate(() => document.activeElement?.getAttribute('role') === 'option'),
    'down arrow moves from search into results',
  )
  await tab.pressKey(null, 'Return')
  await p.locator('.capability-picker').waitFor({ state: 'hidden' })
  await tags().waitFor({ state: 'visible' })
  await snap()
  report('step 25')
  await input().fill('Check the requested diff')
  await tab.pressKey(null, 'F9')
  await button('Send').click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await p.locator('.send:not([disabled])').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await body()) === 'Check the requested diff' && (await tags().count()) === 1,
    'send failure keeps draft and tag',
  )
  report('step 26')
  await tab.pressKey(null, 'F10')
  await button('Send').click()
  await tags().waitFor({ state: 'hidden' })
  await p.locator('.user-message').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await p.locator('.user-message').innerText()) === 'Check the requested diff',
    'native template hides instructions',
  )
  const calls = await requestLog()
  assert(
    calls.some((c) => c.type === 'prompt' && c.message.startsWith('/review-loop ')),
    'native invocation retained',
  )
  report('step 27')
  await button('More capabilities').click()
  await search().waitFor({ state: 'visible' })
  await button('Manage capabilities').click()
  await nav('Capabilities').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await nav('Capabilities').getAttribute('aria-selected')) === 'true',
    'manage deep-links to capability section',
  )
  report('step 28')
  await search().fill('pi-ui-tools')
  await snap()
  assert(
    (await p.locator('.capability-settings-row').count()) === 12,
    'library searches plugin source',
  )
  await button('Built-in').click()
  await snap()
  assert((await p.locator('.capability-settings-row').count()) === 0, 'source and search combine')
  await search().fill('')
  await snap()
  assert(
    (await p.locator('.capability-settings-row').count()) === 5,
    'built-in filter narrows list',
  )
  report('step 29')
  await button('View Review changes').click()
  await p.getByRole('complementary', { name: 'Capability details' }).waitFor({ state: 'visible' })
  await snap()
  await p.getByRole('complementary').getByRole('button', { name: 'Edit', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snap()
  await p.getByRole('textbox', { name: /^Instructions/ }).fill('REVIEW_INSTRUCTIONS_FROZEN')
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snap()
  report('step 30')
  await nav('General').click()
  await p.getByRole('heading', { name: 'General', exact: true }).waitFor({ state: 'visible' })
  await snap()
  await nav('Shortcuts').click()
  await p.locator('.capability-count').getByRole('button').click()
  await p.getByRole('option', { name: '3', exact: true }).click()
  await snap()
  assert(
    (await p.locator('.capability-count .select__value').innerText()) === '3',
    'count changes with Select',
  )
  report('step 31')
  await button('Move up Draft commit message').click()
  await snap()
  assert(
    (await p.locator('.capability-pinned-list').innerText()).startsWith('Draft commit message'),
    'only pinned items reorder',
  )
  report('step 32')
  await tab.pressKey(null, 'F8')
  await button('Save changes').click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snap()
  assert(await button('Save changes').isEnabled(), 'failed save retains unsaved settings')
  assert(
    (await p.locator('.capability-count .select__value').innerText()) === '3',
    'failed save retains count',
  )
  report('step 33')
  await tab.pressKey(null, 'F10')
  await button('Save changes').click()
  await p.getByRole('status').filter({ hasText: 'Changes saved' }).waitFor({ state: 'visible' })
  await snap()
  report('step 34')
  await tab.reload()
  await input().waitFor({ state: 'visible' })
  await button('Settings').click()
  await nav('Shortcuts').click()
  await snap()
  assert(
    (await p.locator('.capability-count .select__value').innerText()) === '3',
    'count persists after reload',
  )
  assert(
    (await p.locator('.capability-pinned-list').innerText()).startsWith('Draft commit message'),
    'pinned order persists',
  )
  report('step 35')
  await nav('Capabilities').click()
  await button('View Review changes').click()
  await snap()
  assert(
    (await p.locator('.capability-instructions').innerText()).includes(
      'REVIEW_INSTRUCTIONS_FROZEN',
    ),
    'instruction edit survives menu switches and reload',
  )
  await p.getByRole('complementary').getByRole('button', { name: 'Close', exact: true }).click()
  await snap()
  report('step 36')
  await button('New capability').click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snap()
  await p
    .getByRole('textbox', { name: /^Name/ })
    .fill('Focused review for API boundaries and error handling')
  await p.getByRole('textbox', { name: /^Slash command/ }).fill('focused-review')
  await p.getByRole('textbox', { name: /^Instructions/ }).fill('Inspect only requested files.')
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await button('Mine').click()
  await snap()
  assert(
    (await p.locator('.capability-settings-row').count()) === 1,
    'custom filter finds new capability',
  )
  const custom = 'Focused review for API boundaries and error handling'
  await button(`Pin ${custom}`).click()
  await button(`Actions for ${custom}`).click()
  await p.getByRole('menuitem', { name: 'Duplicate', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snap()
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snap()
  assert((await p.locator('.capability-settings-row').count()) === 2, 'duplicate via action menu')
  report('step 38')
  await button(`Actions for ${custom} (Duplicate)`).click()
  await p.getByRole('menuitem', { name: 'Delete', exact: true }).click()
  await snap()
  assert(
    (await p.locator('.capability-settings-row').count()) === 1,
    'delete custom via action menu',
  )
  report('step 39')
  await button('Save changes').click()
  await p.getByRole('status').filter({ hasText: 'Changes saved' }).waitFor({ state: 'visible' })
  await snap()
  report('step 40')
  await button('Chat').click()
  await input().fill('/focused-review')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert(
    (await tags().innerText()).includes(custom),
    'custom capability remains available by slash',
  )
  assert((await body()) === '', 'custom instructions stay outside editor')
  await p.locator('.capability-tag-remove').click()
  await tags().waitFor({ state: 'hidden' })
  await input().fill('Line one')
  await input().press('Shift+Enter')
  await input().type('第二行')
  await snap()
  assert((await body()) === 'Line one\n第二行', 'native multiline input retained')
  report('step 41')
  await button('Settings').click()
  await nav('Pi connection').click()
  await snap()
  assert(
    await p.getByRole('textbox', { name: 'pi executable', exact: true }).isVisible(),
    'connection content migrated',
  )
  await nav('General').press('Home')
  await nav('General').press('Enter')
  await snap()
  assert(
    await p.getByRole('heading', { name: 'General', exact: true }).isVisible(),
    'settings keyboard navigation',
  )
  report('step 42')
  await tab.goto(
    `http://localhost:1420/design/capability-settings-refresh/preview.html?seed=narrow-${round}&lang=zh&theme=light&view=settings&section=capabilities&width=380&reduced=1&many=1`,
  )
  await p.getByRole('searchbox', { name: '搜索能力…', exact: true }).waitFor({ state: 'visible' })
  await snap()
  const narrow = await p.evaluate(() => {
    let root = document.querySelector('.fixture-main'),
      box = root.getBoundingClientRect()
    let content = document.querySelector('.settings-content')
    return {
      fits: content.scrollWidth <= content.clientWidth + 1,
      menu: [...document.querySelectorAll('.settings-navigation .list-box-item')].every(
        (e) => e.getBoundingClientRect().width < 150,
      ),
      width: box.width,
      animation: [...document.querySelectorAll('.settings-panel-heading')].map(
        (e) => getComputedStyle(e).opacity,
      ),
    }
  })
  assert(
    narrow.fits && narrow.menu && narrow.animation.every((v) => v === '1'),
    'narrow layout fits and reduced motion visible',
  )
  report('step 45')
  await p.getByRole('button', { name: '查看 审查改动', exact: true }).click()
  await snap()
  assert(
    !(await p.locator('.capability-library-results').isVisible()),
    'narrow detail replaces list',
  )
  await p.getByRole('button', { name: '返回', exact: true }).click()
  await snap()
  assert(await p.locator('.capability-library-results').isVisible(), 'back restores filtered list')
  report('step 46')
  await p
    .getByRole('listbox', { name: '设置分类', exact: true })
    .getByRole('option', { name: '快捷入口', exact: true })
    .click()
  await snap()
  const row = await p.locator('.capability-count-row').evaluate((e) => {
    let a = e.querySelector('.settings-row-text').getBoundingClientRect(),
      b = e.querySelector('.select').getBoundingClientRect()
    return a.right <= b.left && Math.abs(a.top + a.height / 2 - b.top - b.height / 2) < 3
  })
  assert(row, 'narrow count remains right aligned')
  return {
    round,
    passed: true,
    tagPlacement: true,
    tagKeyboardRemoval: true,
    draftPreserved: true,
    modeReadback: true,
    planConflict: true,
    pickerKeyboard: true,
    pluginSearch: true,
    nativeSend: true,
    failurePreservation: true,
    deepLink: true,
    sourceFilter: true,
    details: true,
    unsavedMenuSwitch: true,
    countSelect: true,
    pinnedOrder: true,
    persistence: true,
    saveFailure: true,
    customCrud: true,
    slash: true,
    multiline: true,
    settingsKeyboard: true,
    narrowLayout: true,
    reducedMotion: true,
  }
}
