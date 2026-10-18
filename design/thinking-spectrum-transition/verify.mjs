import { verifySplit } from '../model-thinking-split/verify.mjs'
export async function verifySpectrum(tab, round) {
  const regression = await verifySplit(tab, 100 + round)
  const assert = (condition, message) => {
    if (!condition) throw new Error(message)
  }
  await tab.goto(
    `http://localhost:1420/design/thinking-spectrum-transition/rpc.html?seed=transition-${round}`,
  )
  await tab.playwright.getByRole('button', { name: 'Thinking effort', exact: true }).click()
  await tab.getAXState({ emit: false })
  const slider = tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true })
  const wait = async () => {
    await tab.playwright
      .locator('body[data-transition-status=complete]')
      .waitFor({ state: 'visible' })
    await tab.playwright
      .locator('.model-thinking-control:not([data-pending=true])')
      .waitFor({ state: 'visible' })
    return JSON.parse(
      (await tab.playwright.locator('body').getAttribute('data-transition-samples')) || '[]',
    )
  }
  await slider.press('ArrowRight')
  await wait()
  await slider.press('ArrowRight')
  await wait()
  await slider.press('ArrowRight')
  const entering = await wait()
  assert(
    entering.some((f) => f.opacity > 0 && f.opacity < 1) && entering.at(-1).opacity === 1,
    'Gradient and stars fade in through observable intermediate frames',
  )
  assert(
    new Set(entering.map((f) => f.base)).size > 2 && new Set(entering.map((f) => f.start)).size > 2,
    'Base fill and endcap colors interpolate',
  )
  assert(
    entering.every((f) => f.title === 'Extra high'),
    'Text changes immediately without duplicate animated labels',
  )
  await slider.press('ArrowLeft')
  const leaving = await wait()
  assert(
    leaving.some((f) => f.opacity > 0 && f.opacity < 1) && leaving.at(-1).opacity === 0,
    'Gradient and stars fade out completely',
  )
  assert(
    leaving.every((f) => f.title === 'High'),
    'Reverse transition keeps a single readable High title',
  )
  return { round, regressionPassed: !!regression.persisted, entering, leaving }
}
