export async function verifyHighlight(tab) {
  const assert = (value, message) => {
    if (!value) throw new Error(message)
  }
  const base = 'http://localhost:1420/design/chat-review-2026-10-18/preview.html'
  await tab.goto(`${base}?state=highlight&detail=1&theme=light&palette=ink`)
  const group = tab.playwright.getByRole('button', { name: '4 个工具调用 已完成', exact: true })
  await group.waitFor({ state: 'visible' })
  await group.click()
  await tab.getAXState({ emit: false })
  const results = []
  for (const name of [
    '已读取 valid.go',
    '已读取 Cargo.toml',
    '已读取 notes.unknown',
    '已执行 printf status',
  ]) {
    const trigger = tab.playwright.getByRole('button', { name, exact: true })
    await trigger.press('Enter')
    await tab.getAXState({ emit: false })
    const result = await tab.playwright
      .locator('.tool-block')
      .filter({ has: trigger })
      .evaluate((e) => {
        const sections = e.querySelectorAll('pre')
        const output = sections[sections.length - 1]
        return {
          output: output.textContent,
          tokens: output.querySelectorAll('.syntax-token').length,
          keyword: output.querySelector('.syntax-keyword')?.textContent,
          keywordColor: output.querySelector('.syntax-keyword')
            ? getComputedStyle(output.querySelector('.syntax-keyword')).color
            : '',
          textColor: getComputedStyle(output).color,
          inputTokens: sections[0].querySelectorAll('.syntax-token').length,
          surfaceMask: getComputedStyle(output.closest('.tool-output-surface')).maskImage,
        }
      })
    if (name === '已读取 valid.go') {
      assert(
        result.keyword === 'package' && result.keywordColor !== result.textColor,
        'Go keywords should use language colors',
      )
      assert(result.inputTokens > 0, 'JSON arguments should also use shared highlighting')
      assert(
        result.output.includes('func ValidStatus(status string) bool {'),
        'Highlight must preserve source text exactly',
      )
    } else if (name === '已读取 Cargo.toml')
      assert(
        result.tokens > 0 && result.output.includes('name = "tasklab"'),
        'TOML path alias should highlight',
      )
    else assert(result.tokens === 0, 'Unknown files and command logs should stay plain text')
    assert(result.surfaceMask === 'none', 'Only scroll content should fade')
    results.push({ name, ...result })
    await trigger.press('Enter')
    await tab.getAXState({ emit: false })
  }
  return results
}
