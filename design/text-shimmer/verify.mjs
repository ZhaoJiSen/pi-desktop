export async function verifyTextShimmer(tab) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  await tab.goto('http://localhost:1420/design/text-shimmer/preview.html')
  const thinking = tab.playwright.getByRole('button', { name: '思考过程', exact: true })
  await thinking.last().waitFor({ state: 'visible' })
  for (let i = 0; i < 15; i++) {
    await snapshot()
    if (
      await tab.playwright
        .locator('.assistant')
        .evaluateAll((es) => es.every((e) => getComputedStyle(e).opacity === '1'))
    )
      break
  }
  assert((await thinking.count()) === 2, 'Accessible thinking labels must not duplicate')
  assert(
    (await tab.playwright.locator('.thinking-trigger .text-shimmer').count()) === 1,
    'Only the currently streaming thinking label should shimmer',
  )
  assert(
    (await tab.playwright.locator('.run-status .text-shimmer').count()) === 1,
    'Active run status should shimmer',
  )
  const measure = () =>
    tab.playwright.locator('.thinking-trigger .text-shimmer').evaluate((e) => {
      const style = getComputedStyle(e),
        rect = e.getBoundingClientRect()
      return {
        text: e.textContent,
        position: style.backgroundPosition,
        animation: style.animationName,
        duration: style.animationDuration,
        children: e.querySelectorAll('*').length,
        textNodes: [...e.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).length,
        transform: style.transform,
        translate: style.translate,
        color: style.color,
        fill: style.getPropertyValue('-webkit-text-fill-color'),
        clip: style.backgroundClip,
        background: style.backgroundImage,
        fontWeight: style.fontWeight,
        width: rect.width,
        height: rect.height,
      }
    })
  const before = await measure()
  await thinking.last().press('Enter')
  await snapshot()
  const after = await measure()
  assert(before.position !== after.position, 'Highlight must sweep over time')
  assert(
    after.animation === 'text-shimmer-sweep' && after.duration === '2.4s',
    'Shimmer must retain its slow sweep',
  )
  assert(after.transform === 'none' && after.translate === 'none', 'Glyphs must never move')
  assert(
    after.children === 0 && after.textNodes === 1 && after.text === '思考过程',
    'Render one text node without copies or pseudo text',
  )
  assert(
    Math.abs(before.width - after.width) < 0.05 &&
      Math.abs(before.height - after.height) < 0.05 &&
      before.fontWeight === after.fontWeight,
    'Sweep must preserve text geometry and font weight',
  )
  assert(
    after.clip === 'text' &&
      after.fill === 'rgba(0, 0, 0, 0)' &&
      after.background.includes('linear-gradient'),
    'Highlight should be clipped to the single text layer',
  )
  await tab.pressKey(null, 'F1')
  await snapshot()
  assert(
    (await tab.playwright.locator('.thinking-trigger .text-shimmer').count()) === 0,
    'Thinking shimmer should stop once execution starts',
  )
  assert(
    (await tab.playwright.locator('.tool.running .verb.text-shimmer').count()) === 2,
    'Only running tool verbs should shimmer',
  )
  assert(
    (await tab.playwright.locator('.tool-group-state.text-shimmer').count()) === 1,
    'Running group state should shimmer',
  )
  assert(
    (await tab.playwright.locator('.reply-text .text-shimmer').count()) === 0,
    'Prose must stay readable without shimmer',
  )
  const tool = tab.playwright.getByRole('button', { name: '正在读取 valid.go', exact: true })
  assert((await tool.count()) === 1, 'Tool accessibility name should stay unchanged')
  const height = await tool.evaluate((e) => e.getBoundingClientRect().height)
  assert(height === 38, 'Shimmer must not change tool row height')
  const group = tab.playwright.getByRole('button', { name: '2 个工具调用 进行中', exact: true })
  await group.press('Enter')
  await snapshot()
  assert(
    (await group.getAttribute('aria-expanded')) === 'false',
    'Group should remain keyboard operable',
  )
  await tab.pressKey(null, 'F2')
  await snapshot()
  assert(
    (await tab.playwright.locator('.text-shimmer').count()) === 0,
    'Completion must remove every active shimmer layer',
  )
  assert(
    (await tab.playwright.locator('.run-status').count()) === 0,
    'Completed run should remove loading status',
  )
  assert(
    (await tab.playwright
      .getByRole('button', { name: '2 个工具调用 已完成', exact: true })
      .getAttribute('aria-expanded')) === 'false',
    'Completion should preserve group collapse choice',
  )
  await tab.pressKey(null, 'F3')
  await snapshot()
  assert(
    (await tab.playwright.locator('.text-shimmer').count()) === 0,
    'Error and interrupted tools must never shimmer',
  )
  return {
    before,
    after,
    toolHeight: height,
    activeThinkingOnly: true,
    runningTools: true,
    groupStatus: true,
    unchangedAccessibleNames: true,
    completionStops: true,
    errorAndInterruptedStatic: true,
    keyboard: true,
  }
}
