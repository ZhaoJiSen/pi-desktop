const assert = (value, message) => {
  if (!value) throw new Error(message)
}
export async function verifyPolish(tab, round, report = () => {}) {
  const p = tab.playwright,
    b = (name) => p.getByRole('button', { name, exact: true })
  const snapshot = () => p.domSnapshot()
  const row = (name) => p.locator('.library-browser').getByRole('option', { name })
  const editor = () => p.getByRole('dialog', { name: '编辑', exact: true })
  const body = () => p.locator('.composer-input')
  const search = async (value) => {
    if (!(await p.locator('.commands-search input').isVisible()))
      await b('搜索命令、描述或来源').click()
    await p.locator('.commands-search input').fill(value)
    await snapshot()
  }
  const settings = async () => {
    await b('settings').click()
    await p
      .getByRole('listbox', { name: '设置分类', exact: true })
      .getByRole('option', { name: '快捷入口', exact: true })
      .click()
    await snapshot()
  }
  const count = async (value) => {
    await p.locator('.capability-count .select__trigger').click()
    await p.getByRole('option', { name: String(value), exact: true }).click()
    await p.getByText('已自动保存', { exact: true }).waitFor({ state: 'visible' })
    await snapshot()
  }
  await tab.goto(
    `http://localhost:1420/design/capability-library-polish/preview.html?view=commands&seed=round-${round}&many=1&lang=zh`,
  )
  await row(/^代码审查 /).waitFor({ state: 'visible' })
  await snapshot()
  report('filters and empty state')
  const boxes = await p.locator('.library-filter-row .select__value').evaluateAll((els) =>
    els.map((el) => {
      const s = getComputedStyle(el),
        r = el.getBoundingClientRect(),
        parent = el.parentElement.getBoundingClientRect()
      return { h: r.height, y: r.y, ph: parent.height, py: parent.y, line: s.lineHeight }
    }),
  )
  assert(
    boxes.every((r) => r.h >= 20 && r.y >= r.py && r.y + r.h <= r.py + r.ph),
    'Filter text has full line-height inside trigger',
  )
  await p.getByRole('radio', { name: '已停用', exact: true }).click()
  await snapshot()
  assert(
    (await p.locator('.library-detail-empty').isVisible()) &&
      !(await p.locator('.library-list-empty').isVisible()),
    'One centered empty state in desktop content',
  )
  const centered = await p.locator('.library-detail-empty .utility-empty').evaluate((el) => {
    const r = el.getBoundingClientRect(),
      parent = el.parentElement.getBoundingClientRect()
    return Math.abs(r.y + r.height / 2 - (parent.y + parent.height / 2)) < 3
  })
  assert(centered, 'Empty state vertically centered')
  await p.getByRole('radio', { name: '全部', exact: true }).click()
  await row(/^计划模式 /).click()
  await snapshot()
  assert(
    (await p.locator('.library-detail').innerText()).includes('启用模式'),
    'Plan mode label and action',
  )
  await b('新建能力').click()
  await p.getByRole('menuitem', { name: '新建提示词能力', exact: true }).click()
  await p.getByRole('dialog').waitFor({ state: 'visible' })
  await p.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click()
  await snapshot()
  report('modal and save failure')
  await row(/^代码审查 /).click()
  await b('编辑').click()
  await editor().waitFor({ state: 'visible' })
  await editor()
    .getByRole('textbox', { name: /^说明/ })
    .fill('检查当前改动的正确性与回归风险。')
  await editor()
    .getByRole('textbox', { name: /^名称/ })
    .press('Tab')
  await snapshot()
  assert(
    (await editor()
      .getByRole('textbox', { name: /^说明/ })
      .evaluate((el) => getComputedStyle(el).outlineOffset)) === '-2px',
    'Editor inset focus remains complete',
  )
  await editor()
    .getByRole('textbox', { name: /^名称/ })
    .press('F8')
  await editor().getByRole('button', { name: '保存更改', exact: true }).click()
  await editor().getByRole('alert').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await editor()
      .getByRole('textbox', { name: /^说明/ })
      .evaluate((el) => el.value)) === '检查当前改动的正确性与回归风险。',
    'Failed modal save retains draft',
  )
  await editor()
    .getByRole('textbox', { name: /^名称/ })
    .press('F10')
  await editor().getByRole('button', { name: '保存更改', exact: true }).click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  await tab.reload()
  await row(/^代码审查 /).waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.library-detail').innerText()).includes('检查当前改动的正确性与回归风险。'),
    'Modal saved values read back after reload',
  )
  report('automatic preference persistence and failure recovery')
  await settings()
  assert((await b('保存更改').count()) === 0, 'No manual Settings Save button')
  await count(4)
  await tab.reload()
  await settings()
  await snapshot()
  assert(
    (await p.locator('.capability-count .select__value').innerText()).includes('4'),
    'Count automatically persisted after reload',
  )
  const handle = p.locator('.capability-drag-handle').first()
  await handle.press('ArrowDown')
  await p.getByText('已自动保存', { exact: true }).waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.capability-pinned-list li').first().innerText()).includes('生成提交说明'),
    'Keyboard reorder auto saved',
  )
  await p
    .locator('.capability-pinned-list li[style*="transform: none"]')
    .nth(1)
    .waitFor({ state: 'visible' })
  const centers = await p.locator('.capability-drag-handle').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect()
      return [r.x + r.width / 2, r.y + r.height / 2]
    }),
  )
  await tab.drag(centers[1], [centers[0][0], centers[0][1] - 10])
  await snapshot()
  assert(
    (await p.locator('.capability-pinned-list li').first().innerText()).includes('代码审查'),
    'Pointer drag remains usable with autosave',
  )
  await b('settings').press('F8')
  await p.locator('.capability-count .select__trigger').click()
  await p.getByRole('option', { name: '5', exact: true }).click()
  await p.locator('.capability-autosave-status [role="alert"]').waitFor({ state: 'visible' })
  await snapshot()
  assert(
    (await p.locator('.capability-count .select__value').innerText()).includes('5'),
    'Failed autosave retains changed value',
  )
  await b('settings').press('F10')
  await b('重试保存').click()
  await p.getByText('已自动保存', { exact: true }).waitFor({ state: 'visible' })
  await tab.reload()
  await settings()
  await snapshot()
  assert(
    (await p.locator('.capability-count .select__value').innerText()).includes('5'),
    'Retry persists retained value',
  )
  assert(await b('打开能力库').isVisible(), 'Explicit library management entry')
  await p
    .getByRole('listbox', { name: '设置分类', exact: true })
    .getByRole('option', { name: 'Pi 连接', exact: true })
    .click()
  await snapshot()
  const restore = b('使用默认命令（pi）')
  assert(
    (await restore.isVisible()) &&
      (await restore.getAttribute('class').then((s) => s.includes('button--secondary'))),
    'Default pi action has persistent button surface',
  )
  report('unavailable slash commands and disabled calls')
  await b('commands').click()
  await search('review-loop')
  await row(/^审查并修复 /).click()
  await b('编辑').click()
  await editor()
    .getByRole('textbox', { name: /^附加要求/ })
    .fill('Limit to two rounds.')
  await editor().getByRole('button', { name: '保存更改', exact: true }).click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  await b('commands').press('F3')
  await b('chat').click()
  await body().fill('/review-loop')
  await snapshot()
  assert(
    (await p.locator('.slash-option').count()) === 1,
    'Shadowed template removed; effective extension only',
  )
  await body().fill('/login')
  await snapshot()
  assert(
    (await p.locator('.slash-option').count()) === 0,
    'Terminal-only native command not offered',
  )
  await body().fill('/')
  await snapshot()
  assert((await p.locator('.slash-option').count()) > 0, 'Available commands remain discoverable')
  await b('chat').press('F2')
  await body().fill('/')
  await snapshot()
  assert((await p.locator('.slash-option').count()) === 0, 'Disconnected commands not offered')
  await b('chat').press('F10')
  await b('commands').click()
  await search('')
  await row(/^代码审查 /).click()
  await p.getByRole('switch', { name: '允许在聊天中使用', exact: true }).click()
  await snapshot()
  await b('chat').click()
  await body().fill('/review')
  await snapshot()
  const slashNames = await p.locator('.slash-option strong').allTextContents()
  assert(!slashNames.includes('/review'), 'Disabled capability absent from slash suggestions')
  await b('发送').click()
  await snapshot()
  assert(
    (await body().evaluate((el) => el.value)) === '/review',
    'Manual disabled command preserves draft',
  )
  report('narrow empty state and modal')
  await tab.goto(
    `http://localhost:1420/design/capability-library-polish/preview.html?view=commands&seed=narrow-${round}&lang=zh&theme=light&width=480&reduced=1`,
  )
  await row(/^代码审查 /).waitFor({ state: 'visible' })
  await p.getByRole('radio', { name: '已停用', exact: true }).click()
  await snapshot()
  assert(
    (await p.locator('.library-list-empty').isVisible()) &&
      !(await p.locator('.library-detail-empty').isVisible()),
    'Narrow empty state stays in visible list',
  )
  await p.getByRole('radio', { name: '全部', exact: true }).click()
  await row(/^代码审查 /).click()
  await b('编辑').click()
  await editor().waitFor({ state: 'visible' })
  await editor().getByRole('button', { name: '取消', exact: true }).click()
  await editor().waitFor({ state: 'hidden' })
  await snapshot()
  assert(await b('编辑').isVisible(), 'Modal close restores original detail')
  return {
    round,
    passed: true,
    filterText: true,
    centeredEmpty: true,
    modalFocusAndRecovery: true,
    autoSaveReload: true,
    autoSaveFailureRecovery: true,
    reorderAutoSave: true,
    semanticLabels: true,
    connectionButton: true,
    slashAvailability: true,
    manualDisabledGuard: true,
    narrowAndReducedMotion: true,
  }
}
