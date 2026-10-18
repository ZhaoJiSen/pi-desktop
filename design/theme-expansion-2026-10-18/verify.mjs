import { measureContrast } from '../dark-chat-contrast-2026-10-18/verify.mjs'
import { measureShell } from '../shell-surfaces-2026-10-18/verify.mjs'
import { measure as measureSelection } from '../text-selection-2026-10-18/verify.mjs'
export const variants = [
  { palette: 'everforest', theme: 'light', name: 'Everforest Light', accent: '#5f7626' },
  { palette: 'everforest', theme: 'dark', name: 'Everforest Dark', accent: '#a7c080' },
  { palette: 'rose-pine-moon', theme: 'dark', name: 'Rosé Pine Moon', accent: '#c4a7e7' },
  { palette: 'tokyo-night-storm', theme: 'dark', name: 'Tokyo Night Storm', accent: '#7aa2f7' },
  { palette: 'tokyo-night-moon', theme: 'dark', name: 'Tokyo Night Moon', accent: '#82aaff' },
]
const assert = (ok, message) => {
  if (!ok) throw new Error(message)
}
const settings = 'http://127.0.0.1:1420/design/theme-expansion-2026-10-18/settings.html'
export async function verifySettings(tab, run) {
  await tab.goto(`${settings}?run=${run}`)
  await tab.getAXState({ emit: false })
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  const snap = () => tab.getAXState({ emit: false })
  const read = () =>
    tab.playwright.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      palette: document.documentElement.dataset.palette,
      accent: document.documentElement.dataset.accent,
      color: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
    }))
  const wait = async (palette, accent) => {
    await tab.playwright
      .locator(`html[data-palette="${palette}"]${accent ? `[data-accent="${accent}"]` : ''}`)
      .waitFor({ state: 'attached' })
  }
  const mode = async (name) => {
    await tab.playwright.getByRole('radio', { name, exact: true }).check()
    await snap()
  }
  const choose = async (v) => {
    await tab.playwright.locator('.settings-palette-trigger').click()
    await snap()
    await tab.playwright.getByRole('option', { name: v.name, exact: true }).click()
    await snap()
    await tab.playwright.getByRole('dialog').waitFor({ state: 'hidden' })
    await wait(v.palette)
  }
  const accent = async (name, id) => {
    await tab.playwright.getByRole('option', { name, exact: true }).click()
    await snap()
    await tab.playwright.locator(`html[data-accent="${id}"]`).waitFor({ state: 'attached' })
  }
  await tab.playwright.locator('.settings-palette-trigger').click()
  await snap()
  const light = await tab.playwright.locator('.settings-palette-option').allTextContents()
  assert(
    light.length === 12 &&
      light.includes('Everforest Light') &&
      !light.some((n) => /Moon|Storm|Frappé|Macchiato|Mocha/.test(n)),
    'Light filtering',
  )
  await tab.playwright
    .getByRole('listbox', { name: '选择配色主题', exact: true })
    .press('ArrowDown')
  await snap()
  assert((await read()).palette === 'ink', 'Keyboard preview cannot save a palette')
  await tab.playwright.getByRole('listbox', { name: '选择配色主题', exact: true }).press('Escape')
  await snap()
  await choose(variants[0])
  assert((await read()).color === variants[0].accent, 'Everforest light default accent')
  const paper = (await read()).paper
  await accent('青色', 'teal')
  assert((await read()).paper === paper, 'Accent preserves palette surfaces')
  await mode('深色')
  await tab.playwright.locator('.settings-palette-trigger').click()
  await snap()
  const dark = await tab.playwright.locator('.settings-palette-option').allTextContents()
  assert(
    dark.length === 17 && variants.slice(1).every((v) => dark.includes(v.name)),
    'All new dark variants',
  )
  await tab.playwright.getByRole('listbox', { name: '选择配色主题', exact: true }).press('Escape')
  await snap()
  const names = ['绿色', '粉色', '橙色', '紫色'],
    ids = ['green', 'pink', 'orange', 'violet']
  for (let i = 0; i < 4; i++) {
    await choose(variants[i + 1])
    assert(
      (await read()).color === variants[i + 1].accent,
      `${variants[i + 1].name}: default accent`,
    )
    await accent(names[i], ids[i])
  }
  await tab.reload()
  await snap()
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  await wait('tokyo-night-moon', 'violet')
  for (let i = 0; i < 4; i++) {
    if ((await read()).palette !== variants[i + 1].palette) await choose(variants[i + 1])
    await wait(variants[i + 1].palette, ids[i])
  }
  await mode('浅色')
  await wait('everforest', 'teal')
  await mode('跟随系统')
  await tab.pressKey(null, 'F7')
  await snap()
  await wait('tokyo-night-moon', 'violet')
  await tab.pressKey(null, 'F7')
  await snap()
  await wait('everforest', 'teal')
  await tab.pressKey(null, 'F6')
  await snap()
  await choose({ palette: 'catppuccin', name: 'Catppuccin Latte' })
  await accent('红色', 'red')
  assert((await tab.playwright.getByRole('alert').count()) > 0, 'Save failure must be visible')
  await tab.reload()
  await snap()
  await tab.playwright
    .getByRole('heading', { name: '外观', exact: true })
    .waitFor({ state: 'visible' })
  await wait('everforest', 'teal')
  await mode('深色')
  await wait('tokyo-night-moon', 'violet')
  await accent('主题默认', 'default')
  assert((await read()).color === '#82aaff', 'Default accent restores Moon blue')
  return {
    lightChoices: light.length,
    darkChoices: dark.length,
    allNewVariants: true,
    independentAccents: true,
    reload: true,
    systemModes: true,
    saveFailure: true,
    defaultAccent: true,
    keyboardPreview: true,
  }
}
export async function verifyReading(tab) {
  const result = []
  for (const v of variants) {
    await tab.goto(
      `http://127.0.0.1:1420/design/shell-surfaces-2026-10-18/preview.html?state=audit&theme=${v.theme}&palette=${v.palette}`,
    )
    await tab.getAXState({ emit: false })
    await tab.playwright
      .locator(`html[data-theme="${v.theme}"][data-palette="${v.palette}"] .syntax-comment`)
      .waitFor({ state: 'visible' })
    await tab.playwright.locator('.sidebar-title').waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
    const reading = await tab.playwright.evaluate(measureContrast),
      shell = await tab.playwright.evaluate(measureShell)
    assert(reading.samples.length > 25, 'Real conversation samples')
    const low = reading.samples.filter((s) => s.ratio < s.target)
    assert(!low.length, `${v.name}: contrast ${JSON.stringify(low)}`)
    assert(
      shell.groundMatchesSidebar &&
        shell.readingLighter &&
        shell.readingStep > 1.015 &&
        shell.readingStep < 1.28,
      `${v.name}: surface relationship`,
    )
    assert(shell.overflow <= 1, `${v.name}: overflow`)
    result.push({
      name: v.name,
      samples: reading.samples.length,
      minText: Math.min(...reading.samples.filter((s) => s.target === 4.5).map((s) => s.ratio)),
      minIcon: Math.min(...reading.samples.filter((s) => s.target === 3).map((s) => s.ratio)),
      readingStep: shell.readingStep,
    })
  }
  return result
}
export async function verifySelection(tab) {
  const result = []
  for (const v of variants) {
    await tab.goto(
      `http://127.0.0.1:1420/design/text-selection-2026-10-18/preview.html?theme=${v.theme}&palette=${v.palette}`,
    )
    await tab.getAXState({ emit: false })
    await tab.playwright
      .locator(`html[data-theme="${v.theme}"][data-palette="${v.palette}"] .syntax-comment`)
      .waitFor({ state: 'visible' })
    await tab.pressKey(null, 'F10')
    await tab.getAXState({ emit: false })
    const state = await tab.playwright.evaluate(measureSelection)
    assert(state && state.selected.includes('class Intro:'), `${v.name}: real code selection`)
    assert(
      state.samples.every((s) => s.ratio >= 4.5) && state.syntaxHuesRetained,
      `${v.name}: selected text contrast`,
    )
    result.push({
      name: v.name,
      samples: state.samples.length,
      minimum: Math.min(...state.samples.map((s) => s.ratio)),
      syntaxHuesRetained: true,
    })
  }
  return result
}
export async function verifyFallbacks(tab, run) {
  const result = []
  for (const [id, fallback] of [
    ['rose-pine-moon', 'rose-pine'],
    ['tokyo-night-storm', 'tokyo-night'],
    ['tokyo-night-moon', 'tokyo-night'],
  ]) {
    await tab.goto(`${settings}?run=${run}-${id}&legacy=${id}`)
    await tab.getAXState({ emit: false })
    await tab.playwright
      .getByRole('heading', { name: '外观', exact: true })
      .waitFor({ state: 'visible' })
    await tab.playwright
      .locator(`html[data-theme="light"][data-palette="${fallback}"]`)
      .waitFor({ state: 'attached' })
    result.push({ id, lightFallback: fallback })
  }
  return result
}
