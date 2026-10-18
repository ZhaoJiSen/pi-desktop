export async function verifyScrollShadow(tab) {
  const assert = (condition, label) => {
    if (!condition) throw new Error(label)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  const mainPoint = () =>
    tab.playwright.evaluate(() => {
      const box = document.querySelector('.conversation').getBoundingClientRect()
      return [Math.round(box.right - 32), Math.round(box.top + box.height / 2)]
    })
  const toolPoint = () =>
    tab.playwright.evaluate(() => {
      const box = document.querySelector('.tool-scroll').getBoundingClientRect()
      return [Math.round(box.left + box.width / 2), Math.round(box.top + box.height / 2)]
    })
  const toolState = () =>
    tab.playwright.evaluate(() => {
      const scroll = document.querySelector('.tool-scroll')
      const surface = document.querySelector('.tool-output-surface')
      const css = getComputedStyle(surface)
      return {
        top: scroll.scrollTop,
        max: scroll.scrollHeight - scroll.clientHeight,
        before: scroll.dataset.topScroll === 'true' || scroll.dataset.topBottomScroll === 'true',
        after: scroll.dataset.bottomScroll === 'true' || scroll.dataset.topBottomScroll === 'true',
        mask: css.maskImage,
        radius: css.borderRadius,
        background: css.backgroundColor,
        innerBackground: getComputedStyle(scroll).backgroundColor,
      }
    })
  await tab.goto('http://localhost:1420/design/chat-review-2026-10-18/preview.html?state=scroll')
  const trigger = tab.playwright.getByRole('button', {
    name: '已执行 git status --short && git diff --stat',
    exact: true,
  })
  await trigger.waitFor({ state: 'visible' })
  await snapshot()
  const main = await tab.playwright.evaluate(() => {
    const el = document.querySelector('.conversation')
    return {
      slot: el.dataset.slot,
      overflow: el.scrollHeight > el.clientHeight,
      mask: getComputedStyle(el).maskImage,
      top: el.scrollTop,
    }
  })
  assert(
    main.slot === 'scroll-shadow' && main.overflow && main.mask !== 'none',
    'Conversation must use an active HeroUI ScrollShadow',
  )
  const outside = await mainPoint()
  await tab.scroll(outside, 'up', 1)
  await snapshot()
  const moved = await tab.playwright.evaluate(
    () => document.querySelector('.conversation').scrollTop,
  )
  assert(moved < main.top, 'Conversation must retain wheel scrolling')
  await tab.scroll(outside, 'down', 20)
  await snapshot()
  await trigger.click()
  await snapshot()
  await tab.scroll(outside, 'down', 20)
  await snapshot()
  const inside = await toolPoint()
  await tab.scroll(inside, 'up', 20)
  await snapshot()
  const top = await toolState()
  assert(top.top === 0 && !top.before && top.after, 'Tool at top must fade only its bottom content')
  await tab.scroll(inside, 'down', 1)
  await snapshot()
  const middle = await toolState()
  assert(
    middle.top > 0 && middle.top < middle.max && middle.before && middle.after,
    'Tool in middle must fade content at both edges',
  )
  await tab.scroll(inside, 'down', 20)
  await snapshot()
  const bottom = await toolState()
  assert(
    Math.abs(bottom.top - bottom.max) <= 1 && bottom.before && !bottom.after,
    'Tool at bottom must fade only its top content',
  )
  assert(
    [top, middle, bottom].every(
      (s) =>
        s.mask === 'none' &&
        s.radius === top.radius &&
        s.radius !== '0px' &&
        s.background === top.background &&
        s.innerBackground === 'rgba(0, 0, 0, 0)',
    ),
    'Surface background and round corners must stay outside the content mask',
  )
  return {
    conversationScroll: true,
    toolTop: true,
    toolMiddle: true,
    toolBottom: true,
    fixedSurface: true,
  }
}
