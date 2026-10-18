import { verifySettings } from '../theme-expansion-2026-10-18/verify.mjs'
const url = 'http://127.0.0.1:1420/design/palette-card-labels-2026-10-18/settings.html'
const assert = (ok, message) => {
  if (!ok) throw new Error(message)
}
export function measureCards() {
  const grid = document.querySelector('.settings-palette-grid'),
    pop = document.querySelector('.settings-palette-popover')
  const rect = pop.getBoundingClientRect(),
    style = getComputedStyle(grid)
  const items = [...grid.querySelectorAll('.settings-palette-option')].map((item) => {
    const label = item.querySelector('.settings-palette-option-label'),
      preview = item.querySelector('.palette-preview'),
      badge = item.querySelector('.settings-palette-option-check')
    const r = item.getBoundingClientRect(),
      l = label.getBoundingClientRect(),
      p = preview.getBoundingClientRect(),
      b = badge.getBoundingClientRect()
    const selected = item.getAttribute('aria-selected') === 'true'
    return {
      text: label.textContent.trim(),
      width: r.width,
      height: r.height,
      top: r.top,
      previewTop: p.top - r.top,
      labelTop: l.top - r.top,
      labelHeight: l.height,
      labelOverflow: label.scrollWidth - label.clientWidth,
      badgeVisible: getComputedStyle(badge).visibility === 'visible',
      selected,
      badgeInside: b.left >= p.left && b.right <= p.right && b.top >= p.top && b.bottom <= p.bottom,
      margin: getComputedStyle(item).margin,
      whiteSpace: getComputedStyle(label).whiteSpace,
    }
  })
  return {
    columns: style.gridTemplateColumns.split(' ').length,
    items,
    popover: {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: rect.width,
    },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    horizontalOverflow: grid.scrollWidth - grid.clientWidth,
  }
}
export async function verifyGeometry(tab, run, width, expectedColumns) {
  const results = []
  for (const mode of ['light', 'dark']) {
    await tab.goto(`${url}?run=${run}-${width}-${mode}&state=${mode}&lang=en`)
    await tab.playwright.locator('.settings-palette-trigger').waitFor({ state: 'visible' })
    await tab.playwright.locator('.settings-palette-trigger').click()
    await tab.getAXState({ emit: false })
    const state = await tab.playwright.evaluate(measureCards)
    assert(
      state.columns === expectedColumns,
      `${width}: ${state.columns} columns expected ${expectedColumns}`,
    )
    assert(state.items.length === (mode === 'dark' ? 17 : 12), 'Mode options unchanged')
    assert(
      state.items.every(
        (i) => i.labelHeight === 20 && i.labelOverflow <= 1 && i.whiteSpace === 'nowrap',
      ),
      'All complete names fit one line',
    )
    assert(
      state.items.every(
        (i) => i.height === 106 && i.previewTop === 7 && i.labelTop === 79 && i.margin === '0px',
      ),
      'Uniform rows and preview/text alignment',
    )
    assert(
      state.items.every((i) => i.badgeVisible === i.selected && i.badgeInside),
      'Only selected card has an inset check badge',
    )
    assert(
      state.horizontalOverflow <= 1 &&
        state.popover.left >= 0 &&
        state.popover.right <= state.viewport.width + 1,
      'No horizontal overflow',
    )
    results.push({ mode, ...state })
    const target = mode === 'dark' ? 'Catppuccin Macchiato' : 'Catppuccin Latte'
    await tab.playwright.getByRole('option', { name: target, exact: true }).click()
    await tab.getAXState({ emit: false })
    await tab.playwright.locator('.settings-palette-trigger').click()
    await tab.getAXState({ emit: false })
    const selected = await tab.playwright.evaluate(measureCards)
    assert(
      selected.items.find((i) => i.text === target)?.badgeVisible &&
        selected.items.filter((i) => i.badgeVisible).length === 1,
      'Check badge follows long named selection',
    )
    await tab.pressKey(null, 'Escape')
    await tab.getAXState({ emit: false })
  }
  return results
}
export { verifySettings }
