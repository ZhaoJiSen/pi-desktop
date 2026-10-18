export async function verifyAppearance(tab) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  const read = () =>
    tab.playwright.evaluate(() => ({
      mode: document.documentElement.dataset.theme,
      palette: document.documentElement.dataset.palette,
      accent: document.documentElement.dataset.accent,
      color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
      syntax: getComputedStyle(document.documentElement)
        .getPropertyValue('--syntax-keyword')
        .trim(),
    }))
  const choose = async (name) => {
    if ((await tab.playwright.locator('.settings-palette-trigger').textContent()).includes(name))
      return
    await tab.playwright.locator('.settings-palette-trigger').click()
    await snapshot()
    await tab.playwright.getByRole('option', { name, exact: true }).click()
    await snapshot()
    await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' })
  }
  const mode = async (name) => {
    await tab.playwright.getByRole('radio', { name, exact: true }).check()
    await snapshot()
  }
  const accent = async (name) => {
    await tab.playwright.getByRole('option', { name, exact: true }).click()
    await snapshot()
  }
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  await mode('浅色')
  await choose('Min Light')
  assert((await read()).palette === 'min-dark', 'Min Light should apply the correct family')
  await tab.playwright.locator('.settings-palette-trigger').click()
  await snapshot()
  const names = await tab.playwright.locator('.settings-palette-option').allTextContents()
  assert(
    names.length === 11 && !names.some((name) => /Min Dark|One Dark|Mocha/.test(name)),
    'Light choices must only show light variants',
  )
  const selected = tab.playwright.getByRole('option', { name: 'Min Light', exact: true })
  await selected.press('ArrowDown')
  await snapshot()
  assert((await read()).palette === 'min-dark', 'Keyboard preview must not commit a theme')
  await tab.playwright.getByRole('listbox', { name: '选择配色主题', exact: true }).press('Escape')
  await snapshot()
  await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' })
  await choose('Rosé Pine Dawn')
  await accent('主题默认')
  const original = await read()
  await accent('青色')
  const teal = await read()
  assert(
    teal.accent === 'teal' && teal.paper === original.paper && teal.syntax === original.syntax,
    'Accent must preserve surfaces and syntax',
  )
  await accent('主题默认')
  assert((await read()).color === original.color, 'Default must restore the palette accent')
  await accent('青色')
  await mode('深色')
  await choose('Tokyo Night')
  await accent('橙色')
  assert(
    (await read()).mode === 'dark' && (await read()).accent === 'orange',
    'Dark accent should apply',
  )
  await mode('浅色')
  assert(
    (await read()).palette === 'rose-pine' && (await read()).accent === 'teal',
    'Light theme and accent must be restored',
  )
  await tab.reload()
  await snapshot()
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  assert(
    (await read()).palette === 'rose-pine' && (await read()).accent === 'teal',
    'Preferences must survive reload',
  )
  await mode('跟随系统')
  await tab.pressKey(null, 'F7')
  await snapshot()
  assert(
    (await read()).mode === 'dark' &&
      (await read()).palette === 'tokyo-night' &&
      (await read()).accent === 'orange',
    'OS change must restore the independent dark preference',
  )
  await tab.pressKey(null, 'F7')
  await snapshot()
  assert(
    (await read()).mode === 'light' && (await read()).palette === 'rose-pine',
    'OS change back must restore light preference',
  )
  await tab.pressKey(null, 'F6')
  await snapshot()
  await choose('Solarized Light')
  await accent('绿色')
  assert(
    (await read()).palette === 'solarized' && (await read()).accent === 'green',
    'Failed save must retain the selected draft',
  )
  assert((await tab.playwright.getByRole('alert').count()) > 0, 'Failed save must be reported')
  await tab.reload()
  await snapshot()
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  assert(
    (await read()).palette === 'rose-pine' && (await read()).accent === 'teal',
    'A failed save must not replace the last saved preferences',
  )
  return {
    lightNames: 11,
    keyboardPreview: true,
    accentDefault: true,
    accentScope: true,
    separateModes: true,
    reload: true,
    systemChanges: true,
    storageFailure: true,
  }
}
