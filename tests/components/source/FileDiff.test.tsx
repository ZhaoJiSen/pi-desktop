// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FileDiff } from '../../../src/components/source/FileDiff'
import { LoadedDiff } from '../../../src/components/source/LoadedDiff'
import * as sourceApi from '../../../src/lib/source/api'
import { useWorkspace } from '../../../src/store/workspace'

let root: Root
let container: HTMLDivElement
const patch = '@@ -1,2 +1,2 @@\n-const value = 1\n+const value = 2\n export { value }\n'

async function render({
  text = patch,
  path = 'src/value.ts',
  layout = 'unified',
}: {
  text?: string
  path?: string
  layout?: 'unified' | 'split'
} = {}) {
  await act(async () =>
    root.render(
      <FileDiff
        path={path}
        text={text}
        binary={false}
        missing={false}
        truncated={false}
        embedded
        layout={layout}
      />,
    ),
  )
}

function viewer() {
  return container.querySelector('.diff-view-wrapper')!
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8 }),
  } as unknown as CanvasRenderingContext2D)
  useWorkspace.setState({ theme: 'light', language: 'en' })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('diff viewer reuse', () => {
  it('reports actual new-file counts and does not report partial counts for a truncated patch', async () => {
    const onStats = vi.fn()
    const text = '@@ -0,0 +1,5 @@\n+one\n+two\n+three\n+four\n+five\n'
    await act(async () =>
      root.render(
        <FileDiff
          path="new.ts"
          text={text}
          binary={false}
          missing={false}
          truncated={false}
          embedded
          layout="unified"
          onStats={onStats}
        />,
      ),
    )
    expect(onStats).toHaveBeenLastCalledWith('new.ts', { additions: 5, deletions: 0 })
    await act(async () =>
      root.render(
        <FileDiff
          path="new.ts"
          text={text}
          binary={false}
          missing={false}
          truncated
          embedded
          layout="unified"
          onStats={onStats}
        />,
      ),
    )
    expect(onStats).toHaveBeenLastCalledWith('new.ts', null)
  })
  it('shows an accessible skeleton until the requested diff arrives', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof sourceApi.gitFileDiff>>) => void
    vi.spyOn(sourceApi, 'gitFileDiff').mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    await act(async () =>
      root.render(
        <LoadedDiff projectPath="/project" path="src/value.ts" tick={0} embedded layout="split" />,
      ),
    )
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-label')).toBeTruthy()
    expect(container.querySelector('.source-diff-skeleton')?.getAttribute('data-layout')).toBe(
      'split',
    )
    expect(container.querySelector('.source-spinner')).toBeNull()
    expect(viewer()).toBeNull()

    await act(async () =>
      resolve({
        available: true,
        repo: true,
        path: 'src/value.ts',
        binary: false,
        truncated: false,
        missing: false,
        text: patch,
      }),
    )
    expect(container.querySelector('.source-diff-skeleton')).toBeNull()
    expect(viewer().textContent).toContain('const value = 2')
  })

  it('replaces the loading skeleton with an error if loading fails', async () => {
    vi.spyOn(sourceApi, 'gitFileDiff').mockRejectedValue(new Error('Unable to read diff'))
    await act(async () =>
      root.render(<LoadedDiff projectPath="/project" path="src/value.ts" tick={0} embedded />),
    )
    expect(container.querySelector('.source-diff-skeleton')).toBeNull()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('Unable to read diff')
  })

  it('keeps the parsed viewer and code nodes when the parent renders again', async () => {
    await render()
    const initialViewer = viewer()
    const initialLine = container.querySelector('.diff-line-content-item')
    expect(initialViewer.textContent).toContain('const value = 2')
    expect(initialLine).not.toBeNull()

    await render()
    await render()

    expect(viewer()).toBe(initialViewer)
    expect(container.querySelector('.diff-line-content-item')).toBe(initialLine)
  })

  it('switches layout and theme without replacing the parsed file', async () => {
    await render()
    const id = viewer().id
    await render({ layout: 'split' })
    expect(viewer().id).toBe(id)
    expect(container.querySelector('.split-diff-view-normal')).not.toBeNull()

    await act(async () => useWorkspace.setState({ theme: 'dark' }))
    expect(viewer().id).toBe(id)
    expect(
      container.querySelector('[data-component="git-diff-view"]')?.getAttribute('data-theme'),
    ).toBe('dark')
    expect(viewer().textContent).toContain('const value = 2')
  })

  it('updates the parsed file when its content or path changes', async () => {
    await render()
    const id = viewer().id
    const text = patch.replace('const value = 2', 'const value = 42')
    await render({ text })
    expect(viewer().id).not.toBe(id)
    expect(viewer().textContent).toContain('const value = 42')

    const updatedId = viewer().id
    await render({ text, path: 'src/other.ts' })
    expect(viewer().id).not.toBe(updatedId)
    expect(viewer().textContent).toContain('const value = 42')
  })

  it('reuses a loaded diff but still reads fresh content after a refresh', async () => {
    const result = {
      available: true,
      repo: true,
      path: 'src/value.ts',
      binary: false,
      truncated: false,
      missing: false,
      text: patch,
    }
    const load = vi.spyOn(sourceApi, 'gitFileDiff').mockResolvedValue(result)
    const mount = async (tick: number) => {
      await act(async () =>
        root.render(
          <LoadedDiff
            projectPath="/project"
            path="src/value.ts"
            tick={tick}
            embedded
            layout="unified"
          />,
        ),
      )
    }
    await mount(0)
    const original = viewer()
    await mount(0)
    expect(load).toHaveBeenCalledTimes(1)
    expect(viewer()).toBe(original)

    load.mockResolvedValue({
      ...result,
      text: patch.replace('const value = 2', 'const value = 99'),
    })
    await mount(1)
    expect(load).toHaveBeenCalledTimes(2)
    expect(viewer()).not.toBe(original)
    expect(viewer().textContent).toContain('const value = 99')
  })
})
