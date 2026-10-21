import { Button, Tabs } from '@heroui/react'
import { RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { ChangesPane } from './ChangesView'
import { useSource, type SourceRequest, type SourceTab } from './context'
import { FilesPane } from './FilesPane'
import { HistoryPane } from './HistoryPane'
import { useProjectSource } from './useProjectSource'

const WIDTH_KEY = 'pi.source-panel-width'

function readWidth() {
  if (typeof localStorage === 'undefined') return 420
  const raw = Number(localStorage.getItem(WIDTH_KEY))
  if (!Number.isFinite(raw)) return 420
  return Math.min(640, Math.max(320, raw))
}

export function SourcePanel() {
  const source = useSource()
  const t = useT()
  const [width, setWidth] = useState(readWidth)
  if (!source?.open) return null
  return (
    <aside className="source-panel" style={{ width }} aria-label={t('source.panel')}>
      <PanelResize
        width={width}
        onWidth={(next) => {
          setWidth(next)
          localStorage.setItem(WIDTH_KEY, String(next))
        }}
      />
      <PanelBody
        key={source.request.nonce}
        request={source.request}
        onClose={() => source.setOpen(false)}
      />
    </aside>
  )
}

function PanelResize({ width, onWidth }: { width: number; onWidth: (next: number) => void }) {
  const t = useT()
  return (
    <div
      className="source-resize"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('source.resize')}
      onPointerDown={(event) => {
        if (event.button !== 0) return
        event.preventDefault()
        const handle = event.currentTarget
        handle.setPointerCapture(event.pointerId)
        window.getSelection()?.removeAllRanges()
        const startX = event.clientX
        const start = width
        const stage = handle.closest('.chat-stage')
        stage?.setAttribute('data-resizing', 'true')
        const move = (ev: PointerEvent) => {
          if (ev.pointerId !== event.pointerId) return
          onWidth(Math.min(640, Math.max(320, start + startX - ev.clientX)))
        }
        const end = (ev: PointerEvent) => {
          if (ev.pointerId !== event.pointerId) return
          stage?.removeAttribute('data-resizing')
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', end)
          window.removeEventListener('pointercancel', end)
          if (handle.hasPointerCapture(ev.pointerId)) handle.releasePointerCapture(ev.pointerId)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', end)
        window.addEventListener('pointercancel', end)
      }}
    />
  )
}

function PanelBody({ request, onClose }: { request: SourceRequest; onClose: () => void }) {
  const t = useT()
  const { path, revision } = useProjectSource()
  const [tab, setTab] = useState<SourceTab>(request.tab ?? 'changes')
  const [tick, setTick] = useState(0)
  const [historyPath, setHistoryPath] = useState<string | null>(request.historyPath ?? null)
  const skipRefresh = useRef(true)
  useEffect(() => {
    if (skipRefresh.current) {
      skipRefresh.current = false
      return
    }
    const timer = window.setTimeout(() => setTick((value) => value + 1), 300)
    return () => window.clearTimeout(timer)
  }, [revision])
  return (
    <>
      <div className="source-toolbar">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => setTab(String(key) as SourceTab)}
          className="source-tabs"
        >
          <Tabs.List aria-label={t('source.panel')}>
            <Tabs.Tab id="changes">
              {t('source.changes')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="files">
              {t('source.files')}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="history">
              {t('source.history')}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <Button
          isIconOnly
          variant="ghost"
          className="icon-button"
          aria-label={t('source.refresh')}
          onPress={() => setTick((value) => value + 1)}
        >
          <RotateCw />
        </Button>
        <Button
          isIconOnly
          variant="ghost"
          className="icon-button"
          aria-label={t('source.close')}
          onPress={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="source-body">
        {tab === 'changes' && (
          <ChangesPane
            tick={tick}
            initialPath={request.mode === 'diff' ? (request.path ?? null) : null}
            fallback={request.fallback}
            fallbackLabel={request.label ?? request.path ?? ''}
          />
        )}
        {tab === 'files' && (
          <FilesPane
            tick={tick}
            initialPath={request.tab === 'files' ? (request.path ?? null) : null}
            initialDiff={request.tab === 'files' && request.mode === 'diff'}
            onHistory={(next) => {
              setHistoryPath(next)
              setTab('history')
            }}
          />
        )}
        {tab === 'history' && (
          <HistoryPane
            key={historyPath ?? '*'}
            projectPath={path}
            tick={tick}
            historyPath={historyPath}
            onClear={() => setHistoryPath(null)}
          />
        )}
      </div>
    </>
  )
}
