export async function verifyThinkingSpacing(tab) {
  const assert = (condition, label) => {
    if (!condition) throw new Error(label)
  }
  const results = []
  for (const kind of ['code', 'text', 'heading', 'subheading', 'list']) {
    await tab.goto(
      `http://localhost:1420/design/chat-review-2026-10-18/preview.html?state=spacing-${kind}&detail=1`,
    )
    const trigger = tab.playwright.getByRole('button', { name: '思考过程', exact: true })
    await trigger.waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
    const measure = () =>
      tab.playwright.evaluate(() => {
        const thinking = document.querySelector('.thinking-block')
        const reply = document.querySelector('.assistant > .reply-text')
        const first = reply.firstElementChild
        return {
          gap: first.getBoundingClientRect().top - thinking.getBoundingClientRect().bottom,
          firstMargin: getComputedStyle(first).marginTop,
          lastMargin: getComputedStyle(reply.lastElementChild).marginBottom,
        }
      })
    const collapsed = await measure()
    assert(
      Math.abs(collapsed.gap - 8) < 0.2 && collapsed.firstMargin === '0px',
      `${kind}: collapsed answer must start at the shared 8px boundary`,
    )
    assert(collapsed.lastMargin === '0px', `${kind}: answer must not add a trailing block margin`)
    await trigger.click()
    await tab.getAXState({ emit: false })
    const paragraphs = await tab.playwright.evaluate(() =>
      [...document.querySelectorAll('.thinking-text p')].map((e) => ({
        text: e.textContent,
        top: e.getBoundingClientRect().top,
        bottom: e.getBoundingClientRect().bottom,
      })),
    )
    assert(paragraphs.length === 3, `${kind}: thinking must preserve three paragraphs`)
    assert(
      paragraphs[0].text === '用户要求生成一段 TypeScript 代码。',
      `${kind}: thinking content must remain intact`,
    )
    assert(
      paragraphs.slice(1).every((p, i) => Math.abs(p.top - paragraphs[i].bottom - 8) < 0.2),
      `${kind}: thinking paragraphs must have 8px gaps`,
    )
    const expanded = await measure()
    assert(
      Math.abs(expanded.gap - 8) < 0.2,
      `${kind}: expanding thinking must preserve the answer boundary`,
    )
    await trigger.press('Enter')
    await tab.getAXState({ emit: false })
    assert(
      (await trigger.getAttribute('aria-expanded')) === 'false',
      `${kind}: Enter must still collapse thinking`,
    )
    results.push({ kind, collapsedGap: collapsed.gap, expandedGap: expanded.gap, paragraphGap: 8 })
  }
  return results
}
