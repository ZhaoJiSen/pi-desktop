const base = 'http://127.0.0.1:1420/design/dark-chat-contrast-2026-10-18/preview.html'
export const palettes = [
  'ink',
  'gruvbox',
  'catppuccin',
  'linear',
  'nord',
  'ayu',
  'one-dark',
  'min-dark',
  'solarized',
  'rose-pine',
  'tokyo-night',
]
const assert = (ok, label) => {
  if (!ok) throw new Error(label)
}
// Read resolved browser colors, including nested translucent surfaces.
export function measureContrast() {
  const rgba = (text) => {
    if (text.startsWith('color(srgb')) {
      const [channels, alpha] = text.slice(11, -1).trim().split('/')
      return [
        ...channels
          .trim()
          .split(/\s+/)
          .map((v) => Number(v) * 255),
        alpha === undefined ? 1 : Number(alpha),
      ]
    }
    const values = text.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]
    return values.length === 3 ? [...values, 1] : values
  }
  const composite = (fg, bg) => [
    ...fg.slice(0, 3).map((n, i) => n * fg[3] + bg[i] * (1 - fg[3])),
    1,
  ]
  const background = (el) => {
    const parents = []
    for (let e = el; e; e = e.parentElement) parents.push(e)
    return parents
      .reverse()
      .reduce(
        (bg, e) => composite(rgba(getComputedStyle(e).backgroundColor), bg),
        [255, 255, 255, 1],
      )
  }
  const luminance = (color) =>
    color
      .slice(0, 3)
      .map((v) => v / 255)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((total, v, i) => total + v * [0.2126, 0.7152, 0.0722][i], 0)
  const ratio = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
  const samples = []
  const add = (selector, target = 4.5, explicitBackground) => {
    for (const el of document.querySelectorAll(selector)) {
      const bg = background(explicitBackground ? document.querySelector(explicitBackground) : el)
      const color = rgba(getComputedStyle(el).color)
      samples.push({
        selector,
        text: el.textContent?.slice(0, 35),
        ratio: ratio(composite(color, bg), bg),
        target,
      })
    }
  }
  add(
    '.assistant > .reply-text p, .user-message, .reply-text th, .reply-text td, .reply-text :not(pre) > code',
  )
  add(
    '.thinking-block > .chat-disclosure-heading .chat-disclosure-trigger, .tool-group-state, .tool-group-trigger > span',
  )
  add('.draft-placeholder, .composer-select > span')
  // Metadata is visually above the composer, outside the parent's painted rectangle.
  add('.metadata, .metadata .value', 4.5, '.chat-page')
  add(
    '.markdown-code pre, .markdown-code .syntax-token, .markdown-code-lang, .tool-output pre, .tool-output .syntax-token, .tool-section-label',
  )
  add(
    '.copy-button svg, .thinking-icon, .tool .check, .tool-error-icon, .tool-interrupted-icon, .composer-select svg',
    3,
  )
  const paper = background(document.querySelector('.chat-page'))
  const code = background(document.querySelector('.markdown-code'))
  const inline = background(document.querySelector('.reply-text :not(pre) > code'))
  const group = document.querySelector('.tool-group')
  const groupBg = background(group)
  return {
    palette: document.documentElement.dataset.palette,
    samples,
    surfaces: {
      code: ratio(code, paper),
      inline: ratio(inline, paper),
      toolBorder: ratio(rgba(getComputedStyle(group).borderTopColor), groupBg),
    },
    overflow:
      document.querySelector('.conversation').scrollWidth -
      document.querySelector('.conversation').clientWidth,
  }
}
export async function verifyContrast(tab, targets = palettes) {
  const results = []
  for (const palette of targets) {
    await tab.goto(`${base}?state=audit&palette=${palette}`)
    const thinking = tab.playwright.getByRole('button', { name: '思考过程', exact: true })
    await thinking.waitFor({ state: 'visible' })
    await tab.playwright.locator('.markdown-code .syntax-comment').waitFor({ state: 'visible' })
    await tab.playwright.locator('.tool-group-trigger').waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
    const initial = await tab.playwright.evaluate(measureContrast)
    assert(initial.samples.length > 25, `${palette}: expected real text and code samples`)
    const failed = initial.samples.filter((s) => s.ratio < s.target)
    assert(!failed.length, `${palette}: low contrast ${JSON.stringify(failed)}`)
    assert(
      initial.surfaces.code >= 1.12 && initial.surfaces.inline >= 1.22,
      `${palette}: content surfaces must be distinguishable`,
    )
    assert(initial.overflow <= 1, `${palette}: conversation must not overflow`)
    await thinking.press('Enter')
    await tab.getAXState({ emit: false })
    assert(
      (await thinking.getAttribute('aria-expanded')) === 'true',
      `${palette}: thinking keyboard expansion`,
    )
    const group = tab.playwright.getByRole('button', { name: '2 个工具调用 已完成', exact: true })
    await group.press('Enter')
    await tab.getAXState({ emit: false })
    const child = tab.playwright.getByRole('button', { name: '已读取 LEARNING.md', exact: true })
    await child.press('Enter')
    await tab.getAXState({ emit: false })
    assert(
      (await child.getAttribute('aria-expanded')) === 'true',
      `${palette}: tool child expansion`,
    )
    await tab.playwright
      .getByRole('textbox', { name: '输入消息，或输入 / 使用命令', exact: true })
      .click()
    await tab.getAXState({ emit: false })
    const expanded = await tab.playwright.evaluate(measureContrast)
    const expandedFailed = expanded.samples.filter((s) => s.ratio < s.target)
    assert(
      !expandedFailed.length,
      `${palette}: expanded/focused contrast ${JSON.stringify(expandedFailed)}`,
    )
    assert(
      (await tab.playwright.locator('.thinking-text').textContent()).includes('先读学习进度'),
      `${palette}: thinking content intact`,
    )
    results.push({
      palette,
      minimumText: Math.min(
        ...expanded.samples.filter((s) => s.target === 4.5).map((s) => s.ratio),
      ),
      minimumIcon: Math.min(...expanded.samples.filter((s) => s.target === 3).map((s) => s.ratio)),
      surfaces: initial.surfaces,
      samples: expanded.samples.length,
      keyboard: true,
      focusedComposer: true,
    })
  }
  return results
}
