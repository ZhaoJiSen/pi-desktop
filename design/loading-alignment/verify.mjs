export async function verifyLoadingAlignment(tab, round) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const snap = () => tab.getAXState({ emit: false })
  const sample = () =>
    tab.playwright.locator('[data-slot="spinner"]').evaluateAll((es) =>
      es.map((e) => {
        const svg = e.querySelector('[data-slot="spinner-icon"]'),
          b = e.getBoundingClientRect(),
          s = svg.getBoundingClientRect(),
          style = getComputedStyle(e)
        return {
          class: e.className,
          w: e.clientWidth,
          h: e.clientHeight,
          svgW: svg.clientWidth,
          svgH: svg.clientHeight,
          centerX: (s.left + s.right - b.left - b.right) / 2,
          centerY: (s.top + s.bottom - b.top - b.bottom) / 2,
          animation: style.animationName,
          duration: style.animationDuration,
          transform: style.transform,
        }
      }),
    )
  const centered = (items) => {
    assert(items.length > 0, 'Expected active HeroUI Spinner')
    for (const s of items) {
      assert(
        s.w === s.h && s.svgW === s.w && s.svgH === s.h,
        'Spinner SVG must match square container',
      )
      assert(
        Math.abs(s.centerX) < 0.05 && Math.abs(s.centerY) < 0.05,
        'Rotation must stay centered',
      )
      assert(s.animation === 'spin', 'HeroUI animation retained')
    }
  }
  await tab.goto(
    `http://localhost:1420/design/loading-alignment/preview.html?theme=dark&palette=nord&round=${round}`,
  )
  await tab.playwright.locator('.run-status').waitFor({ state: 'visible' })
  await snap()
  const frames = []
  for (let i = 0; i < 8; i++) {
    const frame = await sample()
    centered(frame)
    frames.push(frame)
    await tab.getScreenshot({ emit: false })
  }
  assert(
    new Set(frames.map((x) => x[0].transform)).size > 1,
    'Spinner should visibly rotate across samples',
  )
  assert(
    (await tab.playwright.locator('.run-status').innerText()) === 'Running',
    'Loading label remains intact',
  )
  await tab.pressKey(null, 'F1')
  await snap()
  const tools = await sample()
  centered(tools)
  assert(
    (await tab.playwright
      .locator('.tool.running:not(.tool-group-trigger) .tool-spinner')
      .count()) === 2,
    'Running tool spinners included',
  )
  await tab.pressKey(null, 'F4')
  await snap()
  const sending = await sample()
  centered(sending)
  assert(
    (await tab.playwright.locator('.send-spinner').count()) === 1,
    'Pending send spinner included',
  )
  const send = sending.find((s) => s.class.includes('send-spinner'))
  assert(send.w === 16, 'Send keeps its 16px size')
  await tab.pressKey(null, 'F5')
  await tab.pressKey(null, 'F2')
  await snap()
  assert(
    (await tab.playwright.locator('[data-slot="spinner"]').count()) === 0,
    'Completion removes active spinners',
  )
  assert((await tab.playwright.locator('.text-shimmer').count()) === 0, 'Completion stops shimmer')
  return { round, frames, tools, sending, completion: true }
}
