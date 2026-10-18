export async function verifySplit(tab, round) {
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  const button = (name) => tab.playwright.getByRole('button', { name, exact: true })
  const slider = () => tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true })
  const snap = async () => {
    await tab.playwright
      .locator('.model-thinking-control:not([data-pending="true"])')
      .waitFor({ state: 'visible' })
    for (let frame = 0; frame < 80; frame++) {
      const settled = await tab.playwright.evaluate(() => {
        const thumb = document.querySelector('[data-slot=slider-thumb]'),
          r = thumb.getBoundingClientRect(),
          track = document.querySelector('[data-slot=slider-track]'),
          t = track.getBoundingClientRect(),
          input = document.querySelector('.model-thinking-control input')
        return (
          Math.abs(
            r.left +
              r.width / 2 -
              (t.left + 14 + (Number(input.value) / Number(input.max)) * (t.width - 28)),
          ) < 0.5
        )
      })
      if (settled) return tab.getAXState({ emit: false })
    }
    throw new Error('Spring did not settle at the selected level')
  }
  const read = () =>
    tab.playwright.evaluate(() => {
      const c = document.querySelector('.model-thinking-control'),
        p = document.querySelector('.thinking-popover'),
        t = document.querySelector('.thinking-selector-trigger'),
        e = c.querySelector('input'),
        thumb = c.querySelector('[data-slot=slider-thumb]'),
        track = c.querySelector('[data-slot=slider-track]')
      return {
        value: Number(e.value),
        text: e.getAttribute('aria-valuetext'),
        level: c.dataset.level,
        width: t.offsetWidth,
        effortWidth: t.querySelector('.thinking-trigger-label').offsetWidth,
        left: t.getBoundingClientRect().left,
        panelLeft: p.getBoundingClientRect().left,
        panelWidth: p.offsetWidth,
        bg: getComputedStyle(c).backgroundColor,
        thumb: thumb.getBoundingClientRect().toJSON(),
        track: track.getBoundingClientRect().toJSON(),
        step: e.step,
        focus: document.activeElement === e,
      }
    })
  const saves = async () =>
    JSON.parse((await tab.playwright.locator('body').getAttribute('data-requests')) || '[]').filter(
      (c) => c.type === 'set_thinking_level',
    ).length
  await tab.goto(`http://localhost:1420/design/model-thinking-split/rpc.html?seed=split-${round}`)
  await button('Thinking effort').waitFor({ state: 'visible' })
  await button('Thinking effort').click()
  await snap()
  assert(
    (await tab.playwright.locator('.model-options').count()) === 0,
    'Thinking popover has no model list',
  )
  const initial = await read(),
    states = []
  for (const i of [1, 2, 3, 0, 3, 1]) {
    const r = await read()
    await tab.click([
      r.track.left + 14 + (i * (r.track.width - 28)) / 3,
      r.track.top + r.track.height / 2,
    ])
    await snap()
    states.push(await read())
  }
  assert(
    states.map((s) => s.level).join(',') === 'medium,high,xhigh,low,xhigh,medium',
    'Clicking nodes selects corresponding supported levels',
  )
  assert(
    states.every((s) => s.width === initial.width && s.effortWidth === initial.effortWidth),
    'Label width is reserved for every available level',
  )
  assert(
    states.every(
      (s) =>
        Math.abs(s.left - initial.left) < 1 &&
        Math.abs(s.panelLeft - initial.panelLeft) < 1 &&
        s.panelWidth === initial.panelWidth,
    ),
    'Trigger and popover stay anchored across node clicks',
  )
  assert(
    states.every((s) => s.bg === initial.bg),
    'Panel background stays neutral',
  )
  await slider().press('Home')
  await snap()
  let r = await read(),
    before = await saves()
  await tab.drag(
    [r.thumb.left + r.thumb.width / 2, r.thumb.top + r.thumb.height / 2],
    [r.track.left + 14 + (r.track.width - 28) * 0.72, r.track.top + r.track.height / 2],
  )
  await snap()
  const partial = await read(),
    samples = JSON.parse(
      (await tab.playwright.locator('body').getAttribute('data-motion-samples')) || '[]',
    ),
    dragging = samples.filter((s) => s.dragging === 'true')
  assert(
    partial.level === 'high' && partial.value === 2,
    'Release snaps a fractional drag to nearest real level',
  )
  assert((await saves()) === before + 1, 'Pointer drag saves only once on release')
  assert(
    new Set(dragging.map((s) => s.value)).size > 4 &&
      dragging.some((s) => s.value !== Math.round(s.value)),
    'Pointer movement includes continuous intermediate positions',
  )
  assert(
    dragging.every((s) => s.transition === 'none' && s.saves === before),
    'Motion owns position and no intermediate requests are made',
  )
  assert(
    new Set(dragging.map((s) => s.label)).size >= 3,
    'Live title crosses real levels while dragging',
  )
  assert(
    dragging.some((s) => s.ballWidth > 31),
    'Pressed ball grows visibly while dragging',
  )
  const lag = dragging.map((s) =>
    Math.abs(s.x - (r.track.left + 14 + (s.value / 3) * (r.track.width - 28))),
  )
  assert(
    lag.some((d) => d > 2) && lag.every((d) => d < 75),
    'Ball has short bounded damping relative to live input position',
  )
  const pendingFrames = samples.filter((s) => s.pending === 'true')
  assert(pendingFrames.length > 4, 'Delayed RPC exposes the pending state')
  assert(
    pendingFrames.every((s) => s.opacity === '1' && s.triggerOpacity === '1'),
    'Save does not dim the title or trigger',
  )
  const pendingLabels = [...new Set(pendingFrames.map((s) => s.label))]
  assert(pendingLabels.join(',') === 'High', 'Preview label stays stable throughout the save')
  await slider().press('ArrowLeft')
  await snap()
  assert((await read()).value === 1, 'Keyboard moves exactly one level')
  await slider().press('End')
  await snap()
  const highest = await read()
  assert(
    highest.value === 3 && highest.text === 'Extra high' && highest.focus,
    'Keyboard endpoint and accessible value remain discrete',
  )
  const star = () =>
    tab.playwright
      .locator('.thinking-sparkle')
      .first()
      .evaluate((e) => ({
        opacity: getComputedStyle(e).opacity,
        transform: getComputedStyle(e).transform,
        cssAnimation: getComputedStyle(e).animationName,
      }))
  const a = await star()
  await tab.getScreenshot({ emit: false })
  await snap()
  const b = await star()
  assert(
    a.transform !== b.transform && a.opacity !== b.opacity,
    'Motion animates star movement and brightness',
  )
  assert(a.cssAnimation === 'none', 'No conflicting CSS keyframe animation')
  assert(
    (await tab.playwright.locator('.thinking-sparkles').getAttribute('aria-hidden')) === 'true',
    'Animated stars stay decorative',
  )
  await tab.pressKey(null, 'F9')
  await slider().press('Home')
  await snap()
  assert(
    (await read()).value === 3 && (await tab.playwright.getByRole('alert').isVisible()),
    'Failed save restores accepted level',
  )
  await tab.pressKey(null, 'F10')
  await button('Reset to Medium').click()
  await snap()
  assert((await read()).value === 1, 'Reset remains functional')
  await tab.pressKey(null, 'Escape')
  await tab.reload()
  await button('Thinking effort').waitFor({ state: 'visible' })
  await button('Thinking effort').click()
  await snap()
  assert((await read()).value === 1, 'Saved level survives reload')
  await tab.pressKey(null, 'Escape')
  await tab.getAXState({ emit: false })
  const choose = async (name) => {
    await button('Choose model').click()
    await tab.getAXState({ emit: false })
    assert(
      (await tab.playwright.locator('.model-thinking-control').count()) === 0,
      'Model popover has no thinking slider',
    )
    await tab.playwright.getByRole('textbox', { name: 'Search', exact: true }).fill(name)
    await tab.playwright
      .getByRole('button', { name: new RegExp('^' + name.replaceAll('.', '\\.') + ',') })
      .waitFor({ state: 'visible' })
    await tab.playwright
      .getByRole('button', { name: new RegExp('^' + name.replaceAll('.', '\\.') + ',') })
      .click()
    await tab.playwright.locator('.model-popover').waitFor({ state: 'hidden' })
    await tab.playwright.locator('.model-trigger:not([disabled])').waitFor({ state: 'visible' })
    await tab.getAXState({ emit: false })
  }
  await choose('Claude Sonnet 4.6')
  await button('Thinking effort').click()
  await snap()
  let capability = await read()
  assert(
    capability.level === 'medium' && capability.value === 3,
    'Model switch selects default Medium',
  )
  await slider().press('End')
  await snap()
  assert((await read()).level === 'max', 'Claude supports Max, not Extra high')
  assert(
    (await tab.playwright.locator('.model-thinking-tick').count()) === 6,
    'Only model-supported levels are shown',
  )
  await tab.pressKey(null, 'Escape')
  await tab.getAXState({ emit: false })
  await choose('Plain model')
  assert(
    !(await button('Thinking effort').isEnabled()),
    'Non-reasoning model disables thinking entry',
  )
  await choose('Grok 4.7')
  await button('Thinking effort').click()
  await snap()
  assert(
    (await read()).level === 'medium' &&
      (await tab.playwright.locator('.model-thinking-tick').count()) === 4,
    'Return to model refreshes capabilities and default',
  )
  await tab.pressKey(null, 'Escape')
  await tab.getAXState({ emit: false })
  const composer = tab.playwright.getByRole('textbox', {
    name: 'Message Pi, or type / for commands',
    exact: true,
  })
  await composer.fill('/thinking ')
  await button('Send').click()
  await snap()
  assert(
    (await tab.playwright.locator('.thinking-popover').count()) === 1 &&
      (await tab.playwright.locator('.model-popover').count()) === 0,
    '/thinking opens the independent slider',
  )
  await tab.pressKey(null, 'Escape')
  await tab.getAXState({ emit: false })
  await composer.fill('/model ')
  await button('Send').click()
  await tab.playwright.locator('.model-options').waitFor({ state: 'visible' })
  assert(
    (await tab.playwright.locator('.thinking-popover').count()) === 0,
    '/model opens model search only',
  )
  await tab.pressKey(null, 'Escape')
  await tab.getAXState({ emit: false })
  return {
    round,
    initial,
    states,
    partial,
    highest,
    continuous: true,
    stable: true,
    persisted: true,
    saveFailure: true,
    modelDefault: true,
    capabilityRestrictions: true,
    independentCommands: true,
    samples,
  }
}
