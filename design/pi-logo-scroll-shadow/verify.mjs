export async function verifyPiMask(tab, round) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const read = () =>
    tab.playwright.locator('.conversation').evaluate((e) => ({
      mask: getComputedStyle(e).maskImage,
      mode: e.getAttribute('data-scroll-shadow-mode'),
      edges: ['top', 'bottom', 'top-bottom'].map((k) => e.getAttribute(`data-${k}-scroll`)),
      height: e.clientHeight,
      scrollHeight: e.scrollHeight,
      logo: e.querySelector('.pi-logo')?.getBoundingClientRect().toJSON(),
    }))
  async function observe(predicate) {
    for (let i = 0; i < 15; i++) {
      await tab.getAXState({ emit: false })
      const s = await read()
      if (predicate(s)) return s
    }
    throw new Error('Scroll shadow state did not settle')
  }
  await tab.reload()
  await tab.playwright.locator('.pi-logo').waitFor({ state: 'visible' })
  const empty = await observe((s) => s.mask === 'none')
  await tab.pressKey(null, 'F2')
  const messages = await observe(
    (s) => s.mode === 'auto' && s.scrollHeight > s.height && s.edges.includes('true'),
  )
  await tab.pressKey(null, 'F3')
  const restored = await observe((s) => s.mask === 'none' && !s.edges.includes('true') && s.logo)
  assert(
    restored.logo.width === 64 && restored.logo.height === 64,
    'Pi geometry must remain unchanged',
  )
  await tab.pressKey(null, 'F2')
  const resumed = await observe(
    (s) => s.mode === 'auto' && s.scrollHeight > s.height && s.edges.includes('true'),
  )
  await tab.pressKey(null, 'F3')
  const final = await observe((s) => s.mask === 'none' && !s.edges.includes('true'))
  return { round, empty, messages, restored, resumed, final }
}
