export async function verifyCapabilities(tab, round) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const p = tab.playwright,
    button = (name) => p.getByRole('button', { name, exact: true }),
    input = () =>
      p.getByRole('textbox', { name: 'Message Pi, or type / for commands', exact: true })
  const snap = () => tab.getAXState({ emit: false })
  const value = () => input().getAttribute('value')
  const text = () => p.locator('.composer-input').evaluate((el) => el.value)
  const requests = async () =>
    JSON.parse((await p.locator('body').getAttribute('data-requests')) || '[]')
  const tags = () => p.locator('.capability-tag')
  const ready = () => p.locator('.send:not([disabled])').waitFor({ state: 'visible' })
  await tab.goto(
    `http://localhost:1420/design/composer-capabilities/preview.html?seed=verify-${round}&lang=en&theme=dark`,
  )
  await input().waitFor({ state: 'visible' })
  await input().fill('Keep my draft')
  await button('Review changes').click()
  await snap()
  assert((await text()) === 'Keep my draft', 'selection keeps draft')
  assert((await tags().count()) === 1, 'selected task appears')
  await tab.pressKey(null, 'F9')
  await button('Send').click()
  await p.getByRole('alert').waitFor({ state: 'visible' })
  await ready()
  await snap()
  assert(
    (await text()) === 'Keep my draft' && (await tags().count()) === 1,
    'failure keeps draft and task',
  )
  const first = (await requests()).find(
    (c) => c.type === 'desktop_bridge' && c.call.op === 'prepare',
  ).call.submission
  await tab.pressKey(null, 'F10')
  await button('Send').click()
  await tags().waitFor({ state: 'hidden' })
  await p.locator('.user-message').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await p.locator('.user-message').innerText()) === 'Keep my draft',
    'only user text appears',
  )
  const preparations = (await requests()).filter(
    (c) => c.type === 'desktop_bridge' && c.call.op === 'prepare',
  )
  assert(preparations.at(-1).call.submission.id === first.id, 'retry reuses frozen snapshot id')
  await tab.reload()
  await input().waitFor({ state: 'visible' })
  await snap()
  assert(
    (await p.locator('.user-message').innerText()) === 'Keep my draft',
    'history does not reveal instructions',
  )
  await input().fill('/plan')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert((await tags().innerText()).includes('Plan first'), 'slash selects mode')
  assert((await text()) === '', 'slash removed from body')
  await tab.reload()
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert((await tags().innerText()).includes('Plan first'), 'mode restored after reload')
  await button('More capabilities').click()
  await p.getByRole('textbox', { name: 'Search capabilities…', exact: true }).fill('tests')
  await snap()
  assert(
    !(await p.getByRole('button', { name: /^Add tests/ }).isEnabled()),
    'write task disabled in plan mode',
  )
  await tab.pressKey(null, 'Escape')
  await button('Remove Plan first').click()
  await tags().waitFor({ state: 'hidden' })
  await snap()
  await button('More capabilities').click()
  await p.getByRole('textbox', { name: 'Search capabilities…', exact: true }).fill('review')
  await p.getByRole('button', { name: /^Review & fix/ }).click()
  await snap()
  await input().fill('Check this diff')
  await button('Send').click()
  await tags().waitFor({ state: 'hidden' })
  await p
    .locator('.user-message')
    .filter({ hasText: 'Check this diff' })
    .waitFor({ state: 'visible' })
  await snap()
  await tab.reload()
  await input().waitFor({ state: 'visible' })
  await snap()
  assert(
    !(await p.locator('.conversation').innerText()).includes('EXPANDED_PLUGIN_PROMPT'),
    'expanded plugin prompt stays hidden',
  )
  await button('Settings').click()
  await button('Edit Review changes').click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await snap()
  await p.getByRole('textbox', { name: /^Instructions/ }).fill('CUSTOM_REVIEW_INSTRUCTIONS')
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snap()
  await p.getByRole('spinbutton', { name: 'Visible shortcuts', exact: true }).fill('3')
  await button('Move up Plan first').click()
  await snap()
  await tab.pressKey(null, 'F8')
  await button('Save changes').click()
  await snap()
  assert(await button('Save changes').isEnabled(), 'storage failure keeps settings draft')
  await tab.pressKey(null, 'F10')
  await button('Save changes').click()
  await p.getByRole('status').filter({ hasText: 'Changes saved' }).waitFor({ state: 'visible' })
  await snap()
  await tab.reload()
  await input().waitFor({ state: 'visible' })
  await button('Settings').click()
  await snap()
  assert(
    (await p
      .getByRole('spinbutton', { name: 'Visible shortcuts', exact: true })
      .getAttribute('value')) === '3',
    'shortcut count persists',
  )
  await button('Edit Review changes').click()
  await snap()
  assert(
    (await p.getByRole('textbox', { name: /^Instructions/ }).evaluate((el) => el.value)) ===
      'CUSTOM_REVIEW_INSTRUCTIONS',
    'prompt edit persists',
  )
  await button('Cancel').click()
  await snap()
  await button('New capability').click()
  await snap()
  await p.getByRole('textbox', { name: /^Name/ }).fill('Focused review')
  await p.getByRole('textbox', { name: /^Slash command/ }).fill('focused-review')
  await p.getByRole('textbox', { name: /^Instructions/ }).fill('Inspect only the requested files.')
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snap()
  await button('Save changes').click()
  await p.getByRole('status').filter({ hasText: 'Changes saved' }).waitFor({ state: 'visible' })
  await snap()
  await button('Chat').click()
  await input().fill('/focused-review')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await snap()
  assert((await tags().innerText()).includes('Focused review'), 'custom alias selects capability')
  assert((await text()) === '', 'custom instructions never enter input')
  await button('Remove Focused review').click()
  await tags().waitFor({ state: 'hidden' })
  await snap()
  await input().fill('Line one')
  await input().press('Shift+Enter')
  await input().type('Line two')
  await snap()
  assert((await text()) === 'Line one\nLine two', 'Shift Enter keeps native multiline editing')
  await tab.pressKey(null, 'F7')
  await button('More capabilities').click()
  await p.getByRole('textbox', { name: 'Search capabilities…', exact: true }).fill('plan')
  await p.getByRole('button', { name: /^Plan first/ }).click()
  await p
    .getByRole('alert')
    .filter({ hasText: 'Mode could not be changed' })
    .waitFor({ state: 'visible' })
  await snap()
  assert((await tags().count()) === 0, 'mode failure does not show a false active label')
  await tab.pressKey(null, 'F10')
  await button('Settings').click()
  await button('Duplicate Focused review').click()
  await snap()
  await p.getByRole('dialog').getByRole('button', { name: 'Save changes', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'hidden' })
  await snap()
  await button('Delete Focused review').click()
  await snap()
  assert((await button('Edit Focused review').count()) === 0, 'delete removes custom capability')
  await button('Restore default Review changes').click()
  await button('Save changes').click()
  await p.getByRole('status').filter({ hasText: 'Changes saved' }).waitFor({ state: 'visible' })
  await snap()
  await button('Edit Review changes').click()
  await snap()
  assert(
    (await p.getByRole('textbox', { name: /^Instructions/ }).evaluate((el) => el.value)).includes(
      'Review the current workspace',
    ),
    'restore resets built-in instructions',
  )
  await p.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await snap()
  await button('Chat').click()
  await input().fill('/plan')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await tab.pressKey(null, 'F4')
  await p
    .locator('.composer-prompt-actions .composer-prompt-button[disabled]')
    .first()
    .waitFor({ state: 'visible' })
  await snap()
  assert(
    !(await p.locator('.conversation').innerText()).includes('EXPANDED_PLUGIN_PROMPT'),
    'cached receipts keep history hidden when bridge disappears',
  )
  const bridgeCallsBefore = (await requests()).filter((c) => c.type === 'desktop_bridge').length
  await button('Remove Plan first').click()
  await p
    .getByRole('alert')
    .filter({ hasText: 'Capabilities are unavailable' })
    .waitFor({ state: 'visible' })
  await snap()
  assert(
    (await requests()).filter((c) => c.type === 'desktop_bridge').length === bridgeCallsBefore,
    'missing bridge never dispatches transport as a model prompt',
  )
  await tab.goto(
    `http://localhost:1420/design/composer-capabilities/preview.html?seed=narrow-${round}&lang=en&theme=light&width=380&reduced=1`,
  )
  await input().waitFor({ state: 'visible' })
  await input().fill('/plan')
  await input().press('Enter')
  await tags().waitFor({ state: 'visible' })
  await p
    .locator('.composer-prompt-actions')
    .getByRole('button', { name: 'Review changes', exact: true })
    .click()
  await input().fill('Review the current changes and outline the next steps.')
  await snap()
  const layout = await p.evaluate(() => {
    const shell = document.querySelector('.composer-shell'),
      s = shell.getBoundingClientRect(),
      text = document.querySelector('.composer-input'),
      r = text.getBoundingClientRect()
    return {
      shortcutCount: [
        ...document.querySelectorAll('.composer-prompt-actions .composer-prompt-button'),
      ].filter(
        (el) => el.getBoundingClientRect().width && !el.classList.contains('composer-prompt-more'),
      ).length,
      fits: [...shell.children]
        .filter((el) => el.getBoundingClientRect().width)
        .every((el) => {
          const b = el.getBoundingClientRect()
          return b.left >= s.left && b.right <= s.right
        }),
      inputWidth: r.width,
      opacity: getComputedStyle(document.querySelector('.capability-tag')).opacity,
      transform: getComputedStyle(document.querySelector('.capability-tag')).transform,
    }
  })
  assert(layout.shortcutCount === 1, 'narrow view keeps only first shortcut and more')
  assert(
    layout.fits && layout.inputWidth > 280,
    'narrow tags and multiline input remain inside shell',
  )
  assert(
    layout.opacity === '1' && layout.transform === 'none',
    'reduced motion renders tags directly',
  )
  await tab.pressKey(null, 'F6')
  const before = (await requests()).filter((c) => c.type === 'prompt').length
  await button('Send').click()
  await tags().filter({ hasText: 'Review changes' }).waitFor({ state: 'hidden' })
  await p.locator('.user-message').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await requests()).filter((c) => c.type === 'prompt').length === before + 1,
    'accepted timeout is not sent twice',
  )
  assert((await text()) === '', 'accepted timeout clears draft after receipt confirmation')
  return {
    round,
    passed: true,
    draftPreserved: true,
    sendFailure: true,
    snapshotRetry: true,
    hiddenHistory: true,
    planRestore: true,
    conflictGuard: true,
    nativeTemplate: true,
    settingsPersistence: true,
    saveFailure: true,
    customAlias: true,
    multiline: true,
    modeFailure: true,
    copyDelete: true,
    restoreDefault: true,
    narrowLayout: true,
    reducedMotion: true,
    acceptedTimeout: true,
    missingBridge: true,
  }
}
