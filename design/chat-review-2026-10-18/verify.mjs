// Run through the host's cua_repl with a bound tab; no separate browser driver.
export async function verifyChat(tab) {
  const base = 'http://localhost:1420/design/chat-review-2026-10-18/preview.html'
  const assert = (condition, label) => {
    if (!condition) throw new Error(label)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  await tab.goto(`${base}?state=code&wrap=1&theme=light&palette=ink`)
  await tab.playwright
    .getByRole('button', { name: '已读取 models.ts', exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  const metrics = await tab.playwright.evaluate(() => ({
    tags: [...document.querySelectorAll('.syntax-tag')].map((e) => ({
      display: getComputedStyle(e).display,
      padding: getComputedStyle(e).padding,
      select: getComputedStyle(e).userSelect,
    })),
    collisions: document.querySelectorAll('.token.tag').length,
    overflow: [...document.querySelectorAll('.code,.markdown-code-scroll')].some(
      (e) => e.scrollWidth > e.clientWidth + 1,
    ),
    draftOverflow:
      document.querySelector('.draft-field').scrollHeight -
      document.querySelector('.draft-field').clientHeight,
    pausedIsSuccess: !!document.querySelector('.tool.interrupted .check'),
  }))
  assert(
    metrics.tags.length > 0 &&
      metrics.tags.every(
        (t) => t.display === 'inline' && t.padding === '0px' && t.select !== 'none',
      ),
    'Syntax tokens must remain selectable inline text',
  )
  assert(
    metrics.collisions === 0 && !metrics.overflow,
    'Wrapped code must not collide with HeroUI or overflow',
  )
  assert(metrics.draftOverflow <= 0, 'Short command draft must not scroll')
  assert(!metrics.pausedIsSuccess, 'Interrupted calls must not show a success icon')
  const read = tab.playwright.getByRole('button', { name: '已读取 models.ts', exact: true })
  await read.press('Enter')
  await snapshot()
  assert((await read.getAttribute('aria-expanded')) === 'true', 'Enter must expand tool output')
  await read.press('Enter')
  await snapshot()
  assert((await read.getAttribute('aria-expanded')) === 'false', 'Enter must collapse tool output')
  const thinking = tab.playwright.getByRole('button', { name: '思考过程', exact: true })
  await thinking.click()
  await snapshot()
  assert((await thinking.getAttribute('aria-expanded')) === 'true', 'Thinking must expand')
  await thinking.click()
  await snapshot()
  assert((await thinking.getAttribute('aria-expanded')) === 'false', 'Thinking must collapse')
  await tab.playwright.getByRole('button', { name: '复制', exact: true }).first().click()
  await snapshot()
  assert(
    (await tab.playwright.getByRole('button', { name: '已复制', exact: true }).count()) === 1,
    'Copy must show feedback',
  )
  const code = await tab.playwright.locator('.markdown-code pre').first().textContent()
  assert(
    code ===
      '<SearchInput value={query} onChange={setQuery} placeholder="搜索模型、提供商或模型 ID" aria-label="选择当前对话使用的模型" />',
    'Highlighted code must preserve the original text',
  )
  await tab.goto(`${base}?state=code&wrap=0&theme=dark&palette=nord`)
  await tab.playwright
    .getByRole('button', { name: '已读取 models.ts', exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  const unwrapped = await tab.playwright.evaluate(() => ({
    scroll: [...document.querySelectorAll('.markdown-code-scroll')].some(
      (e) => e.scrollWidth > e.clientWidth,
    ),
    page:
      document.querySelector('.conversation').scrollWidth -
      document.querySelector('.conversation').clientWidth,
  }))
  assert(
    unwrapped.scroll && unwrapped.page <= 1,
    'Unwrapped long code must scroll inside the code container',
  )
  await tab.goto(`${base}?state=running`)
  const running = tab.playwright.getByRole('button', { name: '正在读取 valid.go', exact: true })
  await running.waitFor({ state: 'visible' })
  await snapshot()
  await running.click()
  await snapshot()
  assert((await running.getAttribute('aria-expanded')) === 'true', 'Running tool can be opened')
  await tab.pressKey(null, 'F8')
  await snapshot()
  assert(
    (await running.getAttribute('aria-expanded')) === 'true',
    'Text delta must preserve expanded tool',
  )
  await running.click()
  await snapshot()
  await tab.pressKey(null, 'F9')
  await snapshot()
  const done = tab.playwright.getByRole('button', { name: '已读取 valid.go', exact: true })
  assert(
    (await done.getAttribute('aria-expanded')) === 'false',
    'Completion must preserve user collapse choice',
  )
  assert(
    (await tab.playwright.locator('.tool.done .tool-spinner').count()) === 0,
    'Completed tool must stop its spinner',
  )
  return {
    wrappedCode: true,
    isolatedTokens: true,
    keyboardDisclosure: true,
    thinking: true,
    copyFeedback: true,
    preservedCodeText: true,
    shortDraft: true,
    unwrappedScroll: true,
    streamingChoice: true,
    statusIcons: true,
  }
}
