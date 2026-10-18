export async function verifyModelThinking(tab, round) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const snap = () => tab.getAXState({ emit: false })
  const button = (name) => tab.playwright.getByRole('button', { name, exact: true })
  const trigger = () => button('Model and thinking effort')
  const input = tab.playwright.locator('.composer-input')
  const slider = () => tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true })
  async function setEffort(label) {
    const index = ['Off', 'Minimal', 'Low', 'Medium', 'High'].indexOf(label)
    await slider().press('Home')
    await snap()
    for (let i = 0; i < index; i++) {
      await slider().press('ArrowRight')
      await snap()
    }
  }

  await tab.goto(
    `http://localhost:1420/design/model-thinking/preview.html?state=empty&lang=en&seed=round-${round}`,
  )
  await input.waitFor({ state: 'visible' })
  await snap()
  assert(
    (await tab.playwright.locator('.composer-shell .model-thinking-trigger').count()) === 1 &&
      (await tab.playwright.locator('.composer-shell .reasoning').count()) === 0,
    'Only one combined trigger',
  )
  assert(
    (await tab.playwright.locator('.model-thinking-trigger .chevron').count()) === 1,
    'Only one chevron',
  )
  await trigger().click()
  await snap()
  assert(
    await tab.playwright.getByRole('dialog', { name: 'Model and thinking effort' }).isVisible(),
    'Shared panel opens',
  )
  await setEffort('High')
  await snap()
  assert(
    (await slider().getAttribute('aria-valuetext')) === 'High' &&
      (await trigger().innerText()).includes('High'),
    'Effort selection updates single trigger',
  )
  assert(
    (await trigger().getAttribute('aria-expanded')) === 'true',
    'Effort changes keep panel open',
  )
  await tab.playwright.getByRole('textbox', { name: 'Search', exact: true }).fill('opus')
  await button('Claude Sonnet, anthropic').waitFor({ state: 'hidden' })
  await snap()
  await button('Claude Opus, anthropic').click()
  await snap()
  assert(
    (await trigger().innerText()).includes('Claude Opus') &&
      (await trigger().getAttribute('aria-expanded')) === 'true',
    'Choosing model keeps panel for effort',
  )
  assert(
    (await slider().getAttribute('aria-valuetext')) === 'Medium',
    'New model displays its returned effort',
  )
  await setEffort('High')
  await snap()
  await tab.pressKey(null, 'Escape')
  await snap()
  await tab.reload()
  await input.waitFor({ state: 'visible' })
  await snap()
  assert(
    (await trigger().innerText()).includes('Claude Opus') &&
      (await trigger().innerText()).includes('High'),
    'Model and effort survive reload',
  )
  await input.fill('/thinking')
  await snap()
  await tab.pressKey(null, 'Return')
  await snap()
  await tab.pressKey(null, 'Return')
  await snap()
  assert(
    (await input.evaluate((e) => e.value)) === '' &&
      (await trigger().getAttribute('aria-expanded')) === 'true',
    'Thinking command opens same panel',
  )
  assert(
    await slider().evaluate((e) => document.activeElement === e),
    'Thinking command focuses selected level',
  )
  await tab.pressKey(null, 'F4')
  await snap()
  assert(
    !(await trigger().isEnabled()) && !(await slider().isEnabled()),
    'Connecting disables both settings',
  )
  await tab.pressKey(null, 'Escape')
  await tab.playwright.locator('.model-popover').waitFor({ state: 'detached' })
  await tab.pressKey(null, 'F5')
  await snap()
  await trigger().click()
  await snap()
  await button('Fast Model, local').click()
  await snap()
  assert(
    !(await trigger().innerText()).includes('High') &&
      (await tab.playwright
        .getByText('This model does not support thinking effort.', { exact: true })
        .isVisible()),
    'Unsupported model hides effort in trigger and explains state',
  )
  assert(
    (await tab.playwright.getByRole('slider').count()) === 0,
    'Unsupported model has no editable effort controls',
  )
  await button('Claude Sonnet, anthropic').click()
  await snap()
  await setEffort('High')
  await snap()
  await tab.pressKey(null, 'F7')
  await setEffort('Low')
  await snap()
  assert(
    (await tab.playwright.locator('body').getAttribute('data-storage-error')) === 'true' &&
      (await trigger().innerText()).includes('Low'),
    'Storage failure preserves visible preference',
  )
  await tab.pressKey(null, 'F8')
  await setEffort('High')
  await snap()
  await tab.pressKey(null, 'Escape')
  await tab.reload()
  await input.waitFor({ state: 'visible' })
  await snap()
  assert((await trigger().innerText()).includes('High'), 'Recovery persists preference')
  await tab.goto(
    `http://localhost:1420/design/model-thinking/preview.html?state=empty&lang=en&seed=narrow-${round}&theme=dark&palette=nord&width=320`,
  )
  await input.waitFor({ state: 'visible' })
  await snap()
  const narrow = await tab.playwright.evaluate(() => {
    const s = document.querySelector('.composer-shell').getBoundingClientRect(),
      b = document.querySelector('.model-thinking-trigger').getBoundingClientRect(),
      effort = document.querySelector('.model-trigger-effort')
    return {
      shell: s.toJSON(),
      button: b.toJSON(),
      effortOverflow: effort.scrollWidth - effort.clientWidth,
    }
  })
  assert(
    narrow.button.right <= narrow.shell.right &&
      narrow.button.left >= narrow.shell.left &&
      narrow.effortOverflow === 0,
    'Narrow trigger fits and retains full effort label',
  )
  await trigger().click()
  await snap()
  const panel = await tab.playwright.locator('.model-popover').evaluate((e) => ({
    width: e.getBoundingClientRect().width,
    right: e.getBoundingClientRect().right,
    bottom: e.getBoundingClientRect().bottom,
    viewport: innerWidth,
    viewportHeight: innerHeight,
  }))
  assert(
    panel.right <= panel.viewport && panel.bottom <= panel.viewportHeight,
    'Shared panel fits viewport',
  )
  await setEffort('High')
  await snap()
  await tab.pressKey(null, 'Escape')
  await snap()
  return {
    round,
    oneTrigger: true,
    search: true,
    modelAndEffort: true,
    persisted: true,
    commandFocus: true,
    unsupported: true,
    saveRecovery: true,
    narrow,
    panel,
  }
}
