import { verifySliderMotion } from './verify.mjs'
export async function verifyFillClip(tab, round) {
  const base = await verifySliderMotion(tab, round)
  const read = () =>
    tab.playwright.locator('[data-slot=slider-fill]').evaluate((e) => ({
      width: e.style.width,
      clip: e.style.clipPath,
      transition: getComputedStyle(e).transitionProperty,
      geometry: e.getBoundingClientRect().toJSON(),
    }))
  const medium = await read()
  await tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true }).press('End')
  await tab.getAXState({ emit: false })
  const high = await read()
  await tab.playwright.getByRole('slider', { name: 'Thinking effort', exact: true }).press('Home')
  await tab.getAXState({ emit: false })
  const low = await read()
  if ([medium, high, low].some((s) => s.width !== '100%' || s.transition !== 'clip-path'))
    throw new Error('Fill must retain fixed width and animate only clipping')
  if (
    Math.abs(medium.geometry.width - high.geometry.width) > 0.05 ||
    Math.abs(low.geometry.width - high.geometry.width) > 0.05
  )
    throw new Error('Fill layout geometry must stay fixed')
  if (!high.clip.includes('0%') || !low.clip.includes('100%'))
    throw new Error('Clip must reveal or conceal the entire fill at endpoints')
  return { round, base, medium, high, low, layoutWidthFixed: true }
}
