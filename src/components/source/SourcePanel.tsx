import { Button, Separator, Toolbar } from '@heroui/react'
import { FolderTree, GitCompare, History, PanelsLeftRight, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { ChangesPane } from './ChangesView'
import { useSource, type SourceRequest, type SourceTab } from './context'
import { FilesPane } from './FilesPane'
import { HistoryPane } from './HistoryPane'
import { PanelResize } from './PanelResize'
import { useProjectSource } from './useProjectSource'

export function SourcePanel({
  width,
  maxWidth,
  expanded,
  onWidth,
  onShowConversation,
}: {
  width: number
  maxWidth: number
  expanded: boolean
  onWidth: (next: number) => void
  onShowConversation: () => void
}) {
  const source = useSource()
  const t = useT()
  const open = Boolean(source?.open)
  const [rendered, setRendered] = useState(open)
  const [visible, setVisible] = useState(false)
  const [resizing, setResizing] = useState(false)
  if (open && !rendered) setRendered(true)
  useEffect(() => {
    if (!rendered) return
    if (open) {
      let inner = 0
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setVisible(true))
      })
      return () => {
        cancelAnimationFrame(outer)
        cancelAnimationFrame(inner)
      }
    }
    setVisible(false)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRendered(false)
      return
    }
    const timer = window.setTimeout(() => setRendered(false), 280)
    return () => window.clearTimeout(timer)
  }, [open, rendered])
  if (!rendered || !source) return null
  return (
    <aside
      className={
        visible
          ? resizing
            ? 'source-panel is-open is-resizing'
            : 'source-panel is-open'
          : 'source-panel'
      }
      style={{ width: visible ? width : 0 }}
      aria-label={t('source.panel')}
      aria-hidden={!visible}
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget || event.propertyName !== 'width' || open) return
        setRendered(false)
      }}
    >
      <PanelResize
        width={width}
        maxWidth={maxWidth}
        onWidth={onWidth}
        onDrag={setResizing}
        onReset={onShowConversation}
      />
      <PanelBody
        key={source.request.nonce}
        request={source.request}
        expanded={expanded}
        onShowConversation={onShowConversation}
        onClose={() => source.setOpen(false)}
      />
    </aside>
  )
}

function PanelBody({
  request,
  expanded,
  onShowConversation,
  onClose,
}: {
  request: SourceRequest
  expanded: boolean
  onShowConversation: () => void
  onClose: () => void
}) {
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
  const title =
    tab === 'files'
      ? t('source.files')
      : tab === 'history'
        ? t('source.history')
        : t('source.changes')
  return (
    <>
      <div className="source-toolbar">
        <h2 className="source-heading">{title}</h2>
        {expanded && (
          <Button variant="ghost" className="source-show-chat" onPress={onShowConversation}>
            <PanelsLeftRight />
            {t('source.showConversation')}
          </Button>
        )}
        <Toolbar aria-label={t('source.panel')} className="source-modes">
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button source-mode"
            aria-label={t('source.changes')}
            aria-pressed={tab === 'changes'}
            onPress={() => setTab('changes')}
          >
            <GitCompare />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button source-mode"
            aria-label={t('source.files')}
            aria-pressed={tab === 'files'}
            onPress={() => setTab('files')}
          >
            <FolderTree />
          </Button>
          <Button
            isIconOnly
            variant="ghost"
            className="icon-button source-mode"
            aria-label={t('source.history')}
            aria-pressed={tab === 'history'}
            onPress={() => setTab('history')}
          >
            <History />
          </Button>
          <Separator />
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
        </Toolbar>
      </div>
      <Separator orientation="horizontal" className="source-toolbar-separator" />
      <div className="source-body" key={tab}>
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
