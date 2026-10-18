export async function verifyMarkdown(tab) {
  const base = 'http://localhost:1420/design/markdown-streaming/preview.html'
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const snapshot = () => tab.getAXState({ emit: false })
  await tab.goto(base)
  await tab.playwright
    .getByRole('heading', { name: '工作区审阅', exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  const metrics = await tab.playwright.evaluate(() => {
    const root = document.querySelector('.assistant > .reply-text')
    return {
      headings: [...root.querySelectorAll('h1,h2,h3,h4')].map((e) => getComputedStyle(e).fontSize),
      tableHeader: getComputedStyle(root.querySelector('thead')).backgroundColor,
      tableAlign: getComputedStyle(root.querySelector('tbody td:last-child')).textAlign,
      tasks: [...root.querySelectorAll('input[type="checkbox"]')].map((e) => ({
        checked: e.checked,
        disabled: e.disabled,
      })),
      animations: root.querySelectorAll('[data-sd-animate]').length,
      overflow:
        document.querySelector('.conversation').scrollWidth -
        document.querySelector('.conversation').clientWidth,
      gap:
        root.getBoundingClientRect().top -
        document.querySelector('.thinking-block').getBoundingClientRect().bottom,
    }
  })
  assert(
    metrics.headings.join(',') === '20px,18px,16px,15px',
    'Headings should have a compact hierarchy',
  )
  assert(metrics.tableAlign === 'right', 'Markdown column alignment must survive rendering')
  assert(
    metrics.tasks.length === 2 &&
      metrics.tasks[0].checked &&
      !metrics.tasks[1].checked &&
      metrics.tasks.every((t) => t.disabled),
    'GFM tasks should preserve state and remain read-only',
  )
  assert(
    metrics.animations === 0 && metrics.overflow <= 1 && metrics.gap === 8,
    'Completed content should have no animated spans and retain spacing',
  )
  const expected =
    'package main\n\nfunc Valid(status string) bool {\n    return status == "todo"\n}'
  assert(
    (await tab.playwright.locator('.markdown-code pre').textContent()) === expected,
    'Custom highlighted code must preserve text',
  )
  await tab.playwright.getByRole('button', { name: '复制', exact: true }).click()
  await snapshot()
  assert(
    (await tab.playwright.getByRole('button', { name: '已复制', exact: true }).count()) === 1,
    'HeroUI copy feedback should still work',
  )
  await tab.goto(base + '?stream=1')
  await tab.playwright
    .getByRole('heading', { name: '工作区审阅', exact: true })
    .waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await tab.playwright.locator('.is-streaming strong').textContent()) === '关键问题',
    'Unclosed bold should be repaired during streaming',
  )
  const initial = await tab.playwright.locator('.is-streaming .reply-markdown').evaluate((e) => ({
    animated: e.querySelectorAll('[data-sd-animate]').length,
    caret: getComputedStyle(e.lastElementChild, '::after').content,
    duplicate: getComputedStyle(e.parentElement.lastElementChild, '::after').content,
  }))
  assert(
    initial.animated > 0 && initial.caret.includes('▋'),
    'Streaming should have animated text and one native caret',
  )
  await tab.pressKey(null, 'F1')
  await snapshot()
  assert(
    (await tab.playwright.locator('.markdown-code pre').textContent()) === expected,
    'Incomplete fence should already render highlighted code',
  )
  assert(
    (await tab.playwright.locator('.markdown-code .syntax-keyword').count()) > 0,
    'Streamed code should keep syntax highlighting',
  )
  assert(
    (await tab.playwright.locator('.is-streaming .reply-markdown p').first().textContent()) ===
      '已核对当前代码和依赖，先保留现有结构。',
    'Settled content should remain intact as new blocks arrive',
  )
  await tab.pressKey(null, 'F2')
  await snapshot()
  assert(
    (await tab.playwright.locator('.is-streaming').count()) === 0,
    'Completion should clear active state',
  )
  assert(
    (await tab.playwright.locator('[data-sd-animate]').count()) === 0,
    'Completion should remove animation wrappers',
  )
  assert(
    (await tab.playwright.locator('.markdown-code pre').textContent()) === expected,
    'Completion should preserve the same code',
  )
  assert(
    ((await tab.playwright.locator('.reply-markdown').last().getAttribute('style')) || '').includes(
      '--streamdown-caret',
    ) === false,
    'Completion should remove caret',
  )
  await tab.pressKey(null, 'F3')
  await snapshot()
  assert(
    !(await tab.playwright.locator('.is-streaming').textContent()).includes('](https://'),
    'Unfinished link should not expose raw Markdown syntax',
  )
  await tab.pressKey(null, 'F4')
  await snapshot()
  assert(
    (await tab.playwright
      .getByRole('link', { name: 'HeroUI', exact: true })
      .getAttribute('href')) === 'https://heroui.pro/docs/react/components/markdown',
    'Completed link should have the final URL',
  )
  return {
    metrics,
    streaming: initial,
    incompleteBold: true,
    incompleteFence: true,
    streamedHighlight: true,
    copyFeedback: true,
    finishedCleanup: true,
    linkRepair: true,
  }
}
