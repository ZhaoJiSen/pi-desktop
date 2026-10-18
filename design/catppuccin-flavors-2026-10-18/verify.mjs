import { verifyAppearance } from '../palette-settings-2026-10-18/verify.mjs'
import { measureContrast } from '../dark-chat-contrast-2026-10-18/verify.mjs'
import { measureShell } from '../shell-surfaces-2026-10-18/verify.mjs'
const assert = (ok, message) => {
  if (!ok) throw new Error(message)
}
const base = 'http://127.0.0.1:1420/design/catppuccin-flavors-2026-10-18/settings.html'
const flavors = [
  ['catppuccin', 'Catppuccin Mocha', '#cba6f7'],
  ['catppuccin-frappe', 'Catppuccin Frappé', '#ca9ee6'],
  ['catppuccin-macchiato', 'Catppuccin Macchiato', '#c6a0f6'],
]
export async function verifySettings(tab, run) {
  await tab.goto(`${base}?run=${run}`)
  const existing = await verifyAppearance(tab)
  const snapshot = () => tab.getAXState({ emit: false })
  const read = () =>
    tab.playwright.evaluate(() => ({
      mode: document.documentElement.dataset.theme,
      palette: document.documentElement.dataset.palette,
      accent: document.documentElement.dataset.accent,
      color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
    }))
  const choose = async (name) => {
    await tab.playwright.locator('.settings-palette-trigger').click()
    await snapshot()
    await tab.playwright.getByRole('option', { name, exact: true }).click()
    await snapshot()
    await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' })
    const id = flavors.find((f) => f[1] === name)?.[0] ?? 'catppuccin'
    await tab.playwright.locator(`html[data-palette="${id}"]`).waitFor({ state: 'attached' })
  }
  await tab.playwright.getByRole('radio', { name: '深色', exact: true }).check()
  await snapshot()
  await tab.playwright.locator('.settings-palette-trigger').click()
  await snapshot()
  const names = await tab.playwright.locator('.settings-palette-option').allTextContents()
  assert(
    names.length === 13 && flavors.every(([, name]) => names.includes(name)),
    'Three dark flavors must be selectable',
  )
  await tab.playwright.getByRole('listbox', { name: '选择配色主题', exact: true }).press('Escape')
  await snapshot()
  const accents = ['青色', '橙色', '粉色'],
    ids = ['teal', 'orange', 'pink']
  for (let i = 0; i < flavors.length; i++) {
    const [id, name, color] = flavors[i]
    await choose(name)
    assert((await read()).color === color, `${name}: default Mauve`)
    await tab.playwright.getByRole('option', { name: accents[i], exact: true }).click()
    await snapshot()
    await tab.playwright.locator(`html[data-accent="${ids[i]}"]`).waitFor({ state: 'attached' })
    assert((await read()).accent === ids[i], `${name}: accent selection`)
  }
  await tab.reload()
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await read()).palette === 'catppuccin-macchiato' && (await read()).accent === 'pink',
    'Macchiato survives reload',
  )
  for (let i = 0; i < flavors.length; i++) {
    if ((await read()).palette !== flavors[i][0]) await choose(flavors[i][1])
    await tab.playwright.locator(`html[data-accent="${ids[i]}"]`).waitFor({ state: 'attached' })
    assert((await read()).accent === ids[i], `${flavors[i][1]}: independent accent`)
    await tab.playwright.getByRole('option', { name: '主题默认', exact: true }).click()
    await snapshot()
    await tab.playwright.locator('html[data-accent="default"]').waitFor({ state: 'attached' })
    assert((await read()).color === flavors[i][2], `${flavors[i][1]}: reset default`)
  }
  await tab.playwright.getByRole('radio', { name: '浅色', exact: true }).check()
  await snapshot()
  await choose('Catppuccin Latte')
  assert((await read()).color === '#8839ef', 'Latte keeps Mauve')
  await tab.playwright.locator('.settings-palette-trigger').click()
  await snapshot()
  const light = await tab.playwright.locator('.settings-palette-option').allTextContents()
  assert(
    light.length === 11 && !light.some((n) => /Frappé|Macchiato|Mocha/.test(n)),
    'Dark-only flavors hidden in light mode',
  )
  await tab.playwright.getByRole('listbox', { name: '选择配色主题', exact: true }).press('Escape')
  await snapshot()
  return {
    existing,
    darkChoices: names.length,
    lightChoices: light.length,
    flavors: 3,
    independentAccents: true,
    defaultMauve: true,
    reload: true,
  }
}
export async function verifyReading(tab) {
  const results = []
  for (const [theme, palette] of [
    ['light', 'catppuccin'],
    ...flavors.map(([id]) => ['dark', id]),
  ]) {
    await tab.goto(
      `http://127.0.0.1:1420/design/shell-surfaces-2026-10-18/preview.html?state=audit&theme=${theme}&palette=${palette}`,
    )
    await tab.playwright
      .locator(
        `html[data-theme="${theme}"][data-palette="${palette}"] .markdown-code .syntax-comment`,
      )
      .waitFor({ state: 'visible' })
    await tab.playwright.locator('.sidebar-title').waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
    const reading = await tab.playwright.evaluate(measureContrast),
      shell = await tab.playwright.evaluate(measureShell)
    const failures = reading.samples.filter((s) => s.ratio < s.target)
    assert(!failures.length, `${palette}: contrast ${JSON.stringify(failures)}`)
    assert(
      shell.groundMatchesSidebar &&
        shell.readingLighter &&
        shell.readingStep > 1.015 &&
        shell.readingStep < 1.28,
      `${palette}: surface hierarchy`,
    )
    assert(shell.overflow <= 1, `${palette}: horizontal overflow`)
    results.push({
      theme,
      palette,
      samples: reading.samples.length,
      minText: Math.min(...reading.samples.filter((s) => s.target === 4.5).map((s) => s.ratio)),
      minIcon: Math.min(...reading.samples.filter((s) => s.target === 3).map((s) => s.ratio)),
      readingStep: shell.readingStep,
    })
  }
  return results
}
