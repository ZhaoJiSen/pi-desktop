import { Button, Toolbar } from '@heroui/react'
import { SourceAction } from './SourceAction'
import { ArrowUpRight, FolderTree, GitBranch, PanelsLeftRight, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { ChangesPane } from './ChangesView'
import { useSource, type SourceRequest, type SourceTab } from './context'
import { FilesPane } from './FilesPane'
import { PanelResize } from './PanelResize'
import { SourceViewTabs } from './SourceViewTabs'
import { ProjectSourceContext, useProjectSource } from './useProjectSource'

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
  const { path: activeProjectPath, name } = useProjectSource()
  const projectPath = source?.request.projectPath ?? activeProjectPath
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
      id="project-source-panel"
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
      <ProjectSourceContext.Provider
        value={{
          path: projectPath,
          name: projectPath === activeProjectPath ? name : (projectPath.split('/').at(-1) ?? ''),
        }}
      >
        <PanelBody
          key={projectPath}
          request={source.request}
          expanded={expanded}
          onShowConversation={onShowConversation}
          onClose={() => source.setOpen(false)}
        />
      </ProjectSourceContext.Provider>
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
  const { path: projectPath, revision } = useProjectSource()
  const [selection, setSelection] = useState<string | null>(null)
  const initialTab = request.tab === 'files' ? 'files' : 'changes'
  const [tab, setTab] = useState<SourceTab>(initialTab)
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
    setVisited((current) => new Set([...current, initialTab]))
    setRequests((current) => ({ ...current, [initialTab]: request }))
  }
  function select(next: SourceTab) {
    setTab(next)
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

  return (
    <>
      <div className="source-toolbar">
        <h2 className="sr-only">{t('source.panel')}</h2>
        <SourceViewTabs
          label={t('source.panel')}
          selected={tab === 'files' ? 'files' : 'git'}
          onSelect={(next) => select(next === 'files' ? 'files' : 'changes')}
          items={[
            { id: 'git', label: t('source.git'), icon: <GitBranch /> },
            { id: 'files', label: t('source.files'), icon: <FolderTree /> },
          ]}
        />
        <Toolbar aria-label={t('source.panel')} className="source-modes">
          <SourceAction
            label={t('source.openWorkspace')}
            onPress={() => source?.showWorkspace({ tab: 'changes', path: selection, projectPath })}
          >
            <ArrowUpRight />
          </SourceAction>
          {expanded && (
            <Button
              size="sm"
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
      <div className="source-body">
        {visited.has('changes') && (
          <div className="source-workspace-pane" hidden={tab !== 'changes'}>
            <ChangesPane
              basic
              onSelectionChange={setSelection}
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
              onHistory={(next) =>
                source?.showWorkspace({ tab: 'history', historyPath: next, projectPath })
              }
            />
          </div>
        )}
      </div>
    </>
  )
}
