export async function verifyThinkingPresentation(tab, round) {
  const assert = (c, m) => {
    if (!c) throw new Error(m)
  }
  const snap = () => tab.getAXState({ emit: false })
  const button = (name) => tab.playwright.getByRole('button', { name, exact: true })
  const slider = () => tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true })
  await tab.goto(
    `http://localhost:1420/design/thinking-slider-codex/preview.html?state=empty&seed=round-${round}&effort=high&theme=dark&palette=nord&lang=en&stage=1`,
  )
  await button('Model and thinking effort').waitFor({ state: 'visible' })
  await button('Model and thinking effort').click()
  await snap()
  const read = () =>
    tab.playwright.evaluate(() => {
      const c = document.querySelector('.model-thinking-control'),
        track = c.querySelector('[data-slot=slider-track]'),
        thumb = c.querySelector('[data-slot=slider-thumb]'),
        fill = c.querySelector('[data-slot=slider-fill]'),
        input = c.querySelector('input')
      return {
        level: c.dataset.level,
        spectrum: c.dataset.spectrum,
        trackHeight: track.clientHeight,
        thumbWidth: thumb.offsetWidth,
        thumbHeight: thumb.offsetHeight,
        thumbColor: getComputedStyle(thumb).backgroundColor,
        fill: getComputedStyle(fill).backgroundImage,
        subtitle: c.querySelector('.thinking-subtitle').textContent,
        output: c.querySelector('output').textContent,
        valueText: input.getAttribute('aria-valuetext'),
        sparkles: c.querySelectorAll('.thinking-sparkle').length,
        attempts: Number(document.body.dataset.thinkingAttempts),
        focus: document.activeElement === input,
      }
    })
  const high = await read()
  assert(
    high.level === 'high' && !high.spectrum && high.sparkles === 0,
    'Ordinary high has no premium effects',
  )
  assert(
    high.trackHeight === 24 &&
      high.thumbWidth === 28 &&
      high.thumbHeight === 28 &&
      high.thumbColor === 'rgb(255, 255, 255)',
    'Thick rail and white round thumb',
  )
  assert(high.subtitle === 'Claude Sonnet', 'Ordinary header identifies real selected model')
  await slider().press('End')
  await snap()
  const premium = await read()
  assert(
    premium.spectrum === 'true' &&
      premium.sparkles === 8 &&
      premium.fill.includes('linear-gradient'),
    'Extra high gains gradient and sparse star effects',
  )
  assert(
    premium.output === 'Extra high' && premium.valueText === 'Extra high',
    'Actual supported name is retained',
  )
  const decorative = await tab.playwright.locator('.thinking-sparkles').getAttribute('aria-hidden')
  assert(decorative === 'true', 'Stars never duplicate accessible labels')
  const first = await tab.playwright
    .locator('.thinking-sparkle')
    .first()
    .evaluate((e) => getComputedStyle(e).opacity)
  await tab.getScreenshot({ emit: false })
  await tab.getAXState({ emit: false })
  const second = await tab.playwright
    .locator('.thinking-sparkle')
    .first()
    .evaluate((e) => getComputedStyle(e).opacity)
  assert(first !== second, 'Star opacity should vary without moving text')
  const beforeReset = premium.attempts
  await button('Reset to Medium').click()
  await snap()
  const reset = await read()
  assert(
    reset.level === 'medium' && reset.attempts === beforeReset + 1 && reset.focus,
    'Reset commits once and returns keyboard focus',
  )
  assert(
    !(await button('Reset to Medium').isEnabled()),
    'Already at reset level: no redundant request',
  )
  await slider().press('End')
  await snap()
  await tab.pressKey(null, 'F9')
  await button('Reset to Medium').click()
  await snap()
  const failed = await read()
  assert(
    failed.level === 'xhigh' && (await tab.playwright.getByRole('alert').isVisible()),
    'Failed reset preserves accepted value and effect',
  )
  await tab.pressKey(null, 'F10')
  await button('Reset to Medium').click()
  await snap()
  assert((await read()).level === 'medium', 'Reset recovers after failure')
  await tab.pressKey(null, 'Escape')
  await tab.reload()
  await button('Model and thinking effort').waitFor({ state: 'visible' })
  await snap()
  assert(
    (await button('Model and thinking effort').innerText()).includes('Medium'),
    'Reset preference survives reload',
  )
  await tab.goto(
    `http://localhost:1420/design/thinking-slider-codex/preview.html?state=empty&seed=fallback-${round}&effort=xhigh&levels=low,high,xhigh&lang=en&stage=1`,
  )
  await button('Model and thinking effort').waitFor({ state: 'visible' })
  await button('Model and thinking effort').click()
  await snap()
  await button('Reset to High').click()
  await snap()
  assert(
    (await read()).level === 'high',
    'Reset uses Pi-compatible next available level without inventing Medium',
  )
  return {
    round,
    high,
    premium,
    reset,
    failed,
    starsDecorative: true,
    resetRecovery: true,
    persisted: true,
    fallback: true,
  }
}
