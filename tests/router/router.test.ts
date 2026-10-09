import { createMemoryHistory } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { createAppRouter } from '../../src/router'
import { pageFromPath, pagePaths } from '../../src/router/paths'

describe('workspace routes', () => {
  it.each(Object.entries(pagePaths))('opens the %s page directly at %s', async (page, path) => {
    const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
    await router.load()
    expect(router.state.matches.at(-1)?.routeId).toBe(path)
    expect(pageFromPath(router.state.location.pathname)).toBe(page)
  })

  it('resolves page changes and browser back/forward history', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })
    const router = createAppRouter(history)
    await router.load()
    history.push('/settings')
    await router.load()
    expect(router.state.location.pathname).toBe('/settings')
    history.push('/commands')
    await router.load()
    expect(router.state.location.pathname).toBe('/commands')
    history.back()
    await router.load()
    expect(router.state.location.pathname).toBe('/settings')
    history.forward()
    await router.load()
    expect(router.state.location.pathname).toBe('/commands')
  })
})
