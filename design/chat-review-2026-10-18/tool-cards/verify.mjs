export async function verifyToolCards(tab) {
  const base = 'http://localhost:1420/design/chat-review-2026-10-18/preview.html'
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  await tab.goto(`${base}?state=tool-cards&detail=1`)
  const group = tab.playwright.getByRole('button', { name: '3 个工具调用 已完成', exact: true })
  await group.waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await group.getAttribute('aria-expanded')) === 'false',
    'Completed consecutive tools should start collapsed',
  )
  const metrics = await tab.playwright.evaluate(() => {
    const messages = [...document.querySelectorAll('.assistant')]
    const tool = document.querySelector('.tool-block .tool')
    const arrow = tool.querySelector('.tool-chevron')
    return {
      gaps: messages
        .slice(1)
        .map((e, i) => e.getBoundingClientRect().top - messages[i].getBoundingClientRect().bottom),
      nextUserGap:
        document.querySelector('.user-message').getBoundingClientRect().top -
        messages.at(-1).getBoundingClientRect().bottom,
      arrowInset: tool.getBoundingClientRect().right - arrow.getBoundingClientRect().right,
      height: tool.getBoundingClientRect().height,
      border: getComputedStyle(document.querySelector('.tool-block')).borderTopWidth,
      overflow:
        document.querySelector('.conversation').scrollWidth -
        document.querySelector('.conversation').clientWidth,
    }
  })
  assert(
    metrics.gaps.every((g) => Math.abs(g - 12) < 0.2),
    'Consecutive assistant messages must have 12px spacing',
  )
  assert(Math.abs(metrics.nextUserGap - 32) < 0.2, 'User message boundary must retain 32px spacing')
  assert(
    Math.abs(metrics.arrowInset - 12) < 0.2 && metrics.height >= 38 && metrics.border === '1px',
    'Tool must have full width bordered trigger and right aligned arrow',
  )
  assert(metrics.overflow <= 1, 'Tool cards must remain contained')
  await group.press('Enter')
  await snapshot()
  assert((await group.getAttribute('aria-expanded')) === 'true', 'Enter should expand tool group')
  const arrowStyles = await tab.playwright
    .locator('.tool-group-trigger .tool-chevron')
    .evaluate((e) => ({
      rotate: getComputedStyle(e).rotate,
      transform: getComputedStyle(e).transform,
    }))
  assert(
    arrowStyles.transform === 'none',
    'Tool arrow must use HeroUI rotation without duplicate transform',
  )
  const child = tab.playwright.getByRole('button', { name: '已读取 main.go', exact: true })
  await child.waitFor({ state: 'visible' })
  await child.press('Enter')
  await snapshot()
  assert(
    (await child.getAttribute('aria-expanded')) === 'true',
    'Grouped child tool must expand independently',
  )
  await group.press('Enter')
  await snapshot()
  await group.press('Enter')
  await snapshot()
  assert(
    (await child.getAttribute('aria-expanded')) === 'true',
    'Group toggle must preserve child tool selection',
  )
  const read = tab.playwright.getByRole('button', { name: '已读取 LEARNING.md', exact: true })
  await read.click()
  await snapshot()
  const input = await tab.playwright
    .locator('.tool-block')
    .first()
    .locator('.tool-section pre')
    .first()
    .textContent()
  assert(JSON.parse(input).path === 'LEARNING.md', 'Tool input must show real arguments')
  const error = tab.playwright.getByRole('button', { name: '失败 go test ./...', exact: true })
  assert((await error.getAttribute('aria-expanded')) === 'true', 'Failed tool must start expanded')
  assert(
    (await tab.playwright.locator('.tool-block.error .tool-output').textContent()).includes(
      'valid_test.go:24',
    ),
    'Error details must preserve actual output',
  )
  assert(
    (await tab.playwright.locator('.tool.error .tool-error-icon').count()) === 1,
    'Error must have its own status icon',
  )
  const running = tab.playwright.getByRole('button', { name: '正在读取 valid.go', exact: true })
  await running.click()
  await snapshot()
  assert(
    (await tab.playwright.locator('.tool.running .tool-spinner').count()) === 1,
    'Running call must show spinner',
  )
  await tab.pressKey(null, 'F7')
  await snapshot()
  assert(
    (await tab.playwright.locator('.tool-block.running .tool-output').textContent()).includes(
      'Reading go/utils/valid.go…',
    ),
    'Partial output should stream into the open card',
  )
  assert(
    (await running.getAttribute('aria-expanded')) === 'true',
    'Partial output must preserve expansion',
  )
  await tab.pressKey(null, 'F9')
  await snapshot()
  const done = tab.playwright.getByRole('button', { name: '已读取 valid.go', exact: true })
  assert(
    (await done.getAttribute('aria-expanded')) === 'true',
    'Completion must preserve expanded choice',
  )
  assert(
    (await tab.playwright.locator('.tool.running').count()) === 0,
    'Completion must remove running state',
  )
  assert(
    (
      await tab.playwright.locator('.tool-block.done').last().locator('.tool-output').textContent()
    ).includes('export const valid = true'),
    'Completed output should update in the same card',
  )
  return {
    ...metrics,
    grouping: true,
    keyboard: true,
    preservedChildChoice: true,
    realArguments: true,
    error: true,
    streamingCompletion: true,
  }
}
