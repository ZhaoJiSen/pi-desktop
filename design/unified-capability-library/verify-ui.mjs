const assert = (value, message) => {
  if (!value) throw new Error(message)
}
export async function verifyLibrary(tab, round, report = () => {}) {
  const p = tab.playwright
  const b = (name) => p.getByRole('button', { name, exact: true })
  const rows = () => p.locator('.library-browser .command-row')
  const row = (name) => p.locator('.library-browser').getByRole('option', { name })
  const snapshot = () => p.domSnapshot()
  const editor = () => p.locator('.library-editor')
  const field = (name) => editor().getByRole('textbox', { name })
  const body = () => p.locator('.composer-input')
  const requests = async () =>
    JSON.parse((await p.locator('body').getAttribute('data-requests')) || '[]')
  const search = async (value) => {
    if (!(await p.locator('.commands-search input').isVisible()))
      await b('Search commands, descriptions or sources').click()
    await p.locator('.commands-search input').fill(value)
    await snapshot()
  }
  await tab.goto(
    `http://localhost:1420/design/unified-capability-library/preview.html?view=commands&seed=verify-${round}&many=1&lang=en`,
  )
  await row(/^\/compact /).waitFor({ state: 'visible' })
  await snapshot()
  assert((await rows().count()) === 156, 'All 156 entries share one catalog')
  assert(
    (await p.locator('.command-workspace-navigation').count()) === 0 &&
      (await p.locator('.commands-view > .capability-settings-footer').count()) === 0,
    'No second catalog tab or second Save bar',
  )
  report('catalog and filters')
  await search('api-design')
  assert((await rows().count()) === 1, 'Skill searchable with other resources')
  assert(
    (await p.locator('.library-detail').innerText()).includes('Skill'),
    'Skill type is visible',
  )
  await search('')
  await p.locator('.library-filter-row .select__trigger').nth(0).click()
  await p.getByRole('option', { name: 'Plugins', exact: true }).click()
  await snapshot()
  assert((await rows().count()) === 144, 'Source filter isolates plugin resources')
  await p.locator('.library-filter-row .select__trigger').nth(0).click()
  await p.getByRole('option', { name: 'All sources', exact: true }).click()
  await p.locator('.library-filter-row .select__trigger').nth(1).click()
  await p.getByRole('option', { name: 'Skill', exact: true }).click()
  await snapshot()
  assert((await rows().count()) === 1, 'Type filter selects skills')
  await p.locator('.library-filter-row .select__trigger').nth(1).click()
  await p.getByRole('option', { name: 'All types', exact: true }).click()
  await snapshot()
  report('inline create, focus and save failure')
  await b('New capability').click()
  await p.getByRole('menuitem', { name: 'New prompt capability', exact: true }).click()
  await field(/^Name/).fill('API review 中文')
  await field(/^Slash command/).fill('api-check')
  await field(/^Instructions/).fill('Check public API contracts only.')
  await field(/^Slash command/).fill('login')
  await b('Save changes').click()
  await editor().getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    await editor().isVisible(),
    'Native command aliases cannot be overwritten by a custom prompt',
  )
  await field(/^Slash command/).fill('api-check')
  await field(/^Instructions/).click()
  const focus = await field(/^Instructions/).evaluate((el) => {
    const style = getComputedStyle(el)
    return {
      offset: style.outlineOffset,
      width: style.outlineWidth,
      box: el.getBoundingClientRect().width,
    }
  })
  assert(
    focus.offset === '-2px' && focus.width === '2px' && focus.box > 200,
    'Complete inset keyboard focus stays within field surface',
  )
  await b('commands').press('F8')
  await b('Save changes').click()
  await editor().getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await field(/^Name/).evaluate((el) => el.value)) === 'API review 中文',
    'Failed save retains editor input',
  )
  await b('commands').press('F10')
  await b('Save changes').click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  await tab.reload()
  await row(/API review 中文/).waitFor({ state: 'visible' })
  await search('API review 中文')
  await b('Edit').click()
  await field(/^Instructions/).fill('Keep this unsaved 中文 draft.')
  await search('')
  await row(/^Review changes /).click()
  await row(/API review 中文/).click()
  await snapshot()
  assert(
    (await field(/^Instructions/).evaluate((el) => el.value)) === 'Keep this unsaved 中文 draft.',
    'Switching objects retains unsaved item draft',
  )
  await b('Save changes').click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  report('disable, rollback, refresh and keyboard filters')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await p
    .locator('.library-feedback')
    .getByText('Changes saved', { exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  assert(!(await b('Add to composer').isEnabled()), 'Disabled task cannot be selected')
  await p.getByRole('radio', { name: 'Disabled', exact: true }).click()
  await snapshot()
  assert((await rows().count()) === 1, 'Disabled entries remain discoverable')
  await b('chat').click()
  await body().fill('/api-check')
  await body().press('Enter')
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await body().evaluate((el) => el.value)) === '/api-check',
    'Disabled typed shortcut is blocked without clearing body',
  )
  await body().fill('')
  await b('commands').click()
  await search('API review 中文')
  await b('commands').press('F8')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p
      .getByRole('switch', { name: 'Enable in Desktop', exact: true })
      .evaluate((el) => el.checked)) === false,
    'Failed toggle restores prior state',
  )
  await b('commands').press('F10')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await p.getByRole('radio', { name: 'All', exact: true }).click()
  await snapshot()
  await row(/API review 中文/).click()
  await b('Pin to shortcuts').click()
  await snapshot()
  await search('')
  report('native command execution and disable')
  await row(/^\/compact /).click()
  await b('Compact context').click()
  await p.getByText('Context compacted', { exact: true }).waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await requests()).filter((item) => item.type === 'compact').length === 1,
    'Native command remains native and executes once',
  )
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await snapshot()
  assert(!(await b('Compact context').isEnabled()), 'Native desktop disable prevents action')
  await tab.reload()
  await row(/^\/compact /).click()
  await snapshot()
  assert(!(await b('Compact context').isEnabled()), 'Native desktop disable reads back')
  await b('chat').click()
  await body().fill('/compact')
  await body().press('Enter')
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await body().evaluate((el) => el.value)) === '/compact',
    'Disabled typed system command is blocked',
  )
  await body().fill('')
  await b('commands').click()
  await row(/^\/compact /).click()
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await snapshot()
  report('plugin editor and derived shortcut')
  await search('review-loop')
  await b('Edit').click()
  assert(
    (await editor().getByRole('radio', { name: 'This conversation', exact: true }).count()) === 0,
    'Native scope is read-only, not a disabled generic control',
  )
  await field('Additional instructions').fill('Preserve original plugin semantics.')
  await b('Save changes').click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  await b('New capability').click()
  await p.getByRole('menuitem', { name: 'Create from an existing capability', exact: true }).click()
  await p.locator('.library-source-picker input').fill('review-loop')
  await p
    .locator('.library-source-picker')
    .getByRole('option', { name: /Review & fix/ })
    .click()
  await field(/^Name/).fill('Review loop shortcut')
  await field(/^Slash command/).fill('review-run')
  await field('Arguments').fill('3')
  await field('Additional instructions').fill('Focus on boundaries.')
  await b('Save changes').click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  assert(
    (await p.locator('.library-readonly').innerText()).includes('/review-loop 3'),
    'Derived shortcut keeps original target and arguments',
  )
  await b('commands').press('F5')
  await snapshot()
  assert(
    !(await b('Add to composer').isEnabled()),
    'Missing plugin makes configured shortcut unavailable',
  )
  await b('commands').press('F10')
  await b('Refresh').click()
  await row(/Review loop shortcut/).waitFor({ state: 'visible' })
  await snapshot()
  await search('review-loop')
  await b('commands').press('F3')
  await snapshot()
  assert(
    (await rows().count()) === 3,
    'Conflicting names preserve separate origins and derived shortcut',
  )
  const original = p.locator(
    '.command-row[data-key="runtime:prompt:/fixture/prompts/review-loop.md:review-loop"]',
  )
  await original.click()
  await snapshot()
  assert(
    !(await b('Add to composer').isEnabled()),
    'Shadowed template cannot silently invoke extension with same name',
  )
  await b('commands').press('F10')
  await search('')
  await snapshot()
  report('delete derived shortcut and mode readback')
  await search('Review loop shortcut')
  await b('Delete').click()
  await p.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snapshot()
  assert(
    (await rows().count()) === 0,
    'Deleting custom shortcut removes it without deleting original',
  )
  await search('')
  await row(/^Plan first /).click()
  await b('Enable mode').click()
  await body().waitFor({ state: 'visible' })
  await p.locator('.capability-tag').waitFor({ state: 'visible' })
  await snapshot()
  await b('commands').click()
  await row(/^Plan first /).click()
  await b('commands').press('F7')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    await p
      .getByRole('switch', { name: 'Enable in Desktop', exact: true })
      .evaluate((el) => el.checked),
    'Failed Pi mode exit does not disable its actual state',
  )
  await b('commands').press('F10')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await snapshot()
  const modeCalls = (await requests()).filter(
    (call) => call.type === 'desktop_bridge' && call.call.op === 'mode',
  )
  assert(modeCalls.at(-1).call.mode === null, 'Disabling active mode exits through Pi readback')
  await p.getByRole('switch', { name: 'Enable in Desktop', exact: true }).click()
  await snapshot()
  report('shortcuts entry and drag ordering')
  await b('settings').click()
  await p
    .getByRole('listbox', { name: 'Settings sections', exact: true })
    .getByRole('option', { name: 'Shortcuts', exact: true })
    .click()
  await b('Reorder Review changes').waitFor({ state: 'visible' })
  await snapshot()
  await b('Reorder Review changes').press('ArrowDown')
  await snapshot()
  await p
    .locator('.capability-pinned-list li[style*="transform: none"]')
    .nth(1)
    .waitFor({ state: 'visible' })
  const centers = await p.evaluate(() =>
    [...document.querySelectorAll('.capability-drag-handle')].slice(0, 2).map((el) => {
      const r = el.getBoundingClientRect()
      return [r.x + r.width / 2, r.y + r.height / 2]
    }),
  )
  await tab.drag(centers[1], [centers[0][0], centers[0][1] - 10])
  await snapshot()
  assert(
    (await p.locator('.capability-pinned-list li').first().innerText()).includes('Review changes'),
    'Pointer drag sorting still works',
  )
  await p
    .locator('.capability-settings-footer')
    .getByRole('button', { name: 'Save changes', exact: true })
    .click()
  await snapshot()
  await b('Manage capabilities').click()
  await p.getByRole('heading', { name: 'Capabilities', exact: true }).waitFor({ state: 'visible' })
  await snapshot()
  report('hidden context and body-only chat')
  await row(/API review 中文/).click()
  await b('Add to composer').click()
  await body().waitFor({ state: 'visible' })
  await snapshot()
  assert((await body().evaluate((el) => el.value)) === '', 'Selecting capability leaves body empty')
  await b('Send').click()
  await p.locator('.user-capability-request').waitFor({ state: 'visible' })
  await p.locator('.capability-tag').waitFor({ state: 'hidden' })
  await snapshot()
  assert(
    (await p.locator('.user-message').innerText()) === 'API review 中文',
    'Empty body displays only capability name',
  )
  const calls = await requests()
  assert(
    calls.some((item) => item.type === 'prompt' && item.message === ''),
    'Instructions do not leak into visible body',
  )
  assert(
    calls.some(
      (item) =>
        item.type === 'desktop_bridge' &&
        item.call.op === 'prepare' &&
        item.call.submission.task?.prompt === 'Keep this unsaved 中文 draft.',
    ),
    'Saved instructions reach bridge as frozen snapshot',
  )
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)
  assert(!overflow, 'No horizontal viewport overflow')
  report('narrow repeated selection and keyboard navigation')
  await tab.goto(
    `http://localhost:1420/design/unified-capability-library/preview.html?view=commands&seed=verify-narrow-${round}&many=1&lang=en&width=480&reduced=1`,
  )
  await row(/^Review changes /).click()
  await b('Capabilities').waitFor({ state: 'visible' })
  await b('Capabilities').click()
  await row(/^Review changes /).click()
  await b('Capabilities').waitFor({ state: 'visible' })
  await b('Capabilities').click()
  await row(/^Review changes /).press('ArrowDown')
  await snapshot()
  assert(
    !(await p.locator('.library-detail').isVisible()),
    'Keyboard browsing keeps narrow list visible',
  )
  await tab.pressKey(null, 'Return')
  await b('Capabilities').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.library-detail').innerText()).includes('Draft commit message'),
    'Enter opens focused item rather than prior selection',
  )
  await b('Capabilities').click()
  await search('commit')
  await row(/^Draft commit message /).click()
  await b('Capabilities').click()
  await snapshot()
  assert(
    (await p.locator('.commands-search input').evaluate((el) => el.value)) === 'commit',
    'Narrow Back retains filter',
  )
  return {
    round,
    passed: true,
    narrowReturnAndKeyboard: true,
    nativeAliasValidation: true,
    unified156: true,
    sourceAndTypeFilters: true,
    insetFocus: true,
    oneSavePersistence: true,
    failedSaveRetainsDraft: true,
    switchedDraft: true,
    disableRollback: true,
    nativeExecution: true,
    nativeDisabledPersistence: true,
    pluginConfiguration: true,
    derivedShortcut: true,
    removalAndConflict: true,
    keyboardAndDragSort: true,
    settingsEntry: true,
    emptyBubble: true,
    hiddenContext: true,
    noOverflow: true,
    disabledTypedCalls: true,
    customDelete: true,
    modeReadbackAndFailure: true,
  }
}
