// @vitest-environment happy-dom
import { act, createElement as h } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/lib/fonts', async (original) => ({
  ...(await original<typeof import('../../src/lib/fonts')>()),
  loadSystemFonts: async () => [],
}))

import { FontSettings } from '../../src/pages/settings/FontSettings'
import { applyFonts, defaultFonts } from '../../src/lib/fonts'
import { useWorkspace } from '../../src/store/workspace'

let root: Root
let container: HTMLDivElement

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  useWorkspace.setState({ language: 'en', fonts: { ...defaultFonts } })
  applyFonts(document.documentElement, defaultFonts)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(h(FontSettings)))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

function button(text: string) {
  const element = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent === text,
  )
  expect(element).toBeDefined()
  return element!
}

async function increaseUiSize() {
  const increment = container.querySelector<HTMLButtonElement>('[aria-label="Increase size"]')!
  expect(increment).not.toBeNull()
  await act(async () => increment.click())
}

function previewSize() {
  return container.querySelector<HTMLElement>('.font-preview-ui')!.style.fontSize
}

describe('font settings drafts', () => {
  it('previews edits without applying them until Apply is pressed', async () => {
    expect(button('Apply').disabled).toBe(true)
    await increaseUiSize()
    expect(previewSize()).toBe('15px')
    expect(useWorkspace.getState().fonts.uiSize).toBe(defaultFonts.uiSize)
    expect(document.documentElement.style.getPropertyValue('--font-ui-size')).toBe('14')
    await act(async () => button('Apply').click())
    expect(useWorkspace.getState().fonts.uiSize).toBe(15)
    expect(document.documentElement.style.getPropertyValue('--font-ui-size')).toBe('15')
    expect(button('Apply').disabled).toBe(true)
  })

  it('drops old edits when saved preferences change and starts new edits from the new values', async () => {
    await increaseUiSize()
    await act(async () =>
      useWorkspace
        .getState()
        .setPreference({ fonts: { ...defaultFonts, uiSize: 12, codeSize: 18 } }),
    )
    expect(previewSize()).toBe('12px')
    expect(button('Apply').disabled).toBe(true)
    await increaseUiSize()
    expect(previewSize()).toBe('13px')
    await act(async () => button('Apply').click())
    expect(useWorkspace.getState().fonts).toMatchObject({ uiSize: 13, codeSize: 18 })
  })

  it('does not revive stale edits when a previously saved object is restored', async () => {
    const original = useWorkspace.getState().fonts
    await increaseUiSize()
    await act(async () =>
      useWorkspace.getState().setPreference({ fonts: { ...defaultFonts, uiSize: 12 } }),
    )
    await act(async () => useWorkspace.getState().setPreference({ fonts: original }))
    expect(previewSize()).toBe('14px')
    expect(button('Apply').disabled).toBe(true)
  })

  it('restores defaults in the preview before committing them', async () => {
    await act(async () =>
      useWorkspace.getState().setPreference({ fonts: { ...defaultFonts, uiSize: 16 } }),
    )
    await act(async () => button('Restore defaults').click())
    expect(previewSize()).toBe('14px')
    expect(useWorkspace.getState().fonts.uiSize).toBe(16)
    await act(async () => button('Apply').click())
    expect(useWorkspace.getState().fonts).toEqual(defaultFonts)
    expect(button('Restore defaults').disabled).toBe(true)
  })
})
