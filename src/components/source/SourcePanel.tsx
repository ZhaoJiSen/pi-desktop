import { Button, Toolbar } from '@heroui/react'
import { SourceAction } from './SourceAction'
import { FolderTree, GitBranch, PanelsLeftRight, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { ChangesPane } from './ChangesView'
import { useSource, type SourceRequest, type SourceTab } from './context'
import { FilesPane } from './FilesPane'
import { HistoryPane } from './HistoryPane'
import { PanelResize } from './PanelResize'
import { SourceViewTabs } from './SourceViewTabs'
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
  const { path: projectPath } = useProjectSource()
  const t = useT()
  const open = Boolean(source?.open)
  const [rendered, setRendered] = useState(open)
  const [openedOnce, setOpenedOnce] = useState(open)
  const [visible, setVisible] = useState(false)
  const [resizing, setResizing] = useState(false)
  if (open && !rendered) setRendered(true)
  if (open && !openedOnce) setOpenedOnce(true)
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const frame = requestAnimationFrame(() => {
      setVisible(false)
      if (reduced) setRendered(false)
    })
    const timer = reduced ? undefined : window.setTimeout(() => setRendered(false), 280)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [open, rendered])
  if (!openedOnce || !source) return null
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
      hidden={!rendered}
      inert={!open}
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
        key={projectPath}
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
  const source = useSource()
  const { path, revision } = useProjectSource()
  const initialTab = request.tab ?? 'changes'
  const [tab, setTab] = useState<SourceTab>(initialTab)
  const [gitTab, setGitTab] = useState<'changes' | 'history'>(
    initialTab === 'history' ? 'history' : 'changes',
  )
  const [visited, setVisited] = useState(() => new Set<SourceTab>([initialTab]))
  const [requests, setRequests] = useState<Partial<Record<SourceTab, SourceRequest>>>(() => ({
    [initialTab]: request,
  }))
  const [tick, setTick] = useState(0)
  const [refreshes, setRefreshes] = useState({ changes: 0, files: 0, history: 0 })
  const [handledRequest, setHandledRequest] = useState(request.nonce)
  if (handledRequest !== request.nonce) {
    setHandledRequest(request.nonce)
    setTab(initialTab)
    if (initialTab !== 'files') setGitTab(initialTab)
    setVisited((current) => new Set([...current, initialTab]))
    setRequests((current) => ({ ...current, [initialTab]: request }))
  }
  function select(next: SourceTab) {
    setTab(next)
    if (next !== 'files') setGitTab(next)
    setVisited((current) => (current.has(next) ? current : new Set([...current, next])))
  }
  const skipRefresh = useRef(true)
  useEffect(() => {
    if (skipRefresh.current) {
      skipRefresh.current = false
      return
    }
    const timer = window.setTimeout(() => setTick((value) => value + 1), 300)
    return () => window.clearTimeout(timer)
  }, [revision])
  const changesRequest = requests.changes
  const filesRequest = requests.files
  const historyRequest = requests.history
  return (
    <>
      <div className="source-toolbar">
        <h2 className="sr-only">{t('source.panel')}</h2>
        <SourceViewTabs
          label={t('source.panel')}
          selected={tab === 'files' ? 'files' : 'git'}
          onSelect={(next) => select(next === 'files' ? 'files' : gitTab)}
          items={[
            { id: 'git', label: t('source.git'), icon: <GitBranch /> },
            { id: 'files', label: t('source.files'), icon: <FolderTree /> },
          ]}
        />
        <Toolbar aria-label={t('source.panel')} className="source-modes">
          {expanded && (
            <Button
              variant="ghost"
              className="source-show-chat"
              aria-label={t('source.showConversation')}
              onPress={onShowConversation}
            >
              <PanelsLeftRight />
              {t('source.showConversation')}
            </Button>
          )}
          <SourceAction
            label={t('source.refresh')}
            onPress={() => setRefreshes((current) => ({ ...current, [tab]: current[tab] + 1 }))}
          >
            <RotateCw />
          </SourceAction>
          <SourceAction label={t('source.close')} onPress={onClose}>
            <X />
          </SourceAction>
        </Toolbar>
      </div>
      {tab !== 'files' && (
        <SourceViewTabs
          secondary
          label={t('source.gitViews')}
          selected={tab === 'history' ? 'history' : 'changes'}
          onSelect={select}
          items={[
            { id: 'changes', label: t('source.changes') },
            { id: 'history', label: t('source.history') },
          ]}
        />
      )}
      <div className="source-body">
        {visited.has('changes') && (
          <div className="source-workspace-pane" hidden={tab !== 'changes'}>
            <ChangesPane
              tick={tick + refreshes.changes}
              requestNonce={changesRequest?.nonce ?? 0}
              initialPath={changesRequest?.path ?? null}
              fallback={changesRequest?.fallback}
              fallbackLabel={changesRequest?.label ?? changesRequest?.path ?? ''}
            />
          </div>
        )}
        {visited.has('files') && (
          <div className="source-workspace-pane" hidden={tab !== 'files'}>
            <FilesPane
              tick={tick + refreshes.files}
              requestNonce={filesRequest?.nonce ?? 0}
              initialPath={filesRequest?.path ?? null}
              initialDiff={filesRequest?.mode === 'diff'}
              onHistory={(next) => source?.show({ tab: 'history', historyPath: next })}
            />
          </div>
        )}
        {visited.has('history') && (
          <div className="source-workspace-pane" hidden={tab !== 'history'}>
            <HistoryPane
              projectPath={path}
              tick={tick + refreshes.history}
              historyPath={historyRequest?.historyPath ?? null}
              onClear={() => source?.show({ tab: 'history', historyPath: null })}
            />
          </div>
        )}
      </div>
    </>
  )
}
