// @vitest-environment happy-dom
import { Activity, act, createElement, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSourceQuery } from '../../../src/components/source/useSourceQuery'

let root: Root
let container: HTMLDivElement
const pending: Array<(value: string) => void> = []

function load(label: string) {
  return new Promise<string>((resolve) => {
    pending.push(() => resolve(label))
  })
}

function Probe({ scope, refresh }: { scope: string; refresh: number }) {
  const query = useSourceQuery(scope, () => load(`${scope}:${refresh}`), refresh)
  return (
    <output
      data-loading={String(query.loading)}
      data-value={query.data ?? ''}
      data-error={query.error ?? ''}
    />
  )
}

function Host() {
  const [scope, setScope] = useState('file')
  const [refresh, setRefresh] = useState(0)
  return (
    <>
      <button type="button" onClick={() => setRefresh((value) => value + 1)}>
        refresh
      </button>
      <button type="button" onClick={() => setScope('other')}>
        switch
      </button>
      <Probe scope={scope} refresh={refresh} />
    </>
  )
}

function view() {
  return document.querySelector('output')!
}

beforeEach(async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  pending.length = 0
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(createElement(Host)))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('useSourceQuery', () => {
  it.each([false, true])(
    'reuses a request across Activity reveal (resolved before hide: %s)',
    async (resolved) => {
      function ActivityHost({ visible }: { visible: boolean }) {
        return (
          <Activity mode={visible ? 'visible' : 'hidden'}>
            <Probe scope="activity" refresh={0} />
          </Activity>
        )
      }
      await act(async () => root.render(<ActivityHost visible />))
      pending.length = 0
      // Start with a fresh hook instance after the shared Host setup.
      await act(async () => root.render(<div />))
      await act(async () => root.render(<ActivityHost visible />))
      expect(pending).toHaveLength(1)
      if (resolved) await act(async () => pending[0]!('activity:0'))
      await act(async () => root.render(<ActivityHost visible={false} />))
      if (!resolved) await act(async () => pending[0]!('activity:0'))
      await act(async () => root.render(<ActivityHost visible />))
      expect(pending).toHaveLength(1)
      expect(view().dataset).toMatchObject({ loading: 'false', value: 'activity:0' })
    },
  )

  it('keeps the previous result visible while a refresh is in flight', async () => {
    expect(view().dataset.loading).toBe('true')
    await act(async () => pending.shift()?.('file:0'))
    expect(view().dataset).toMatchObject({ loading: 'false', value: 'file:0' })
    await act(async () => {
      document.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(view().dataset).toMatchObject({ loading: 'false', value: 'file:0' })
    await act(async () => pending.shift()?.('file:1'))
    expect(view().dataset.value).toBe('file:1')
  })

  it('drops stale data when the resource changes', async () => {
    await act(async () => pending.shift()?.('file:0'))
    await act(async () => {
      ;[...document.querySelectorAll('button')][1]?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })
    expect(view().dataset.loading).toBe('true')
    expect(view().dataset.value ?? '').toBe('')
    await act(async () => pending.shift()?.('other:0'))
    expect(view().dataset.value).toBe('other:0')
  })
})
