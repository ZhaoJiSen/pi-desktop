import { X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import { gitBranches, gitBranchState, gitLogHead } from '../../lib/source/api'
import { branchReference } from '../../lib/source/branches'
import type { GitHeadLocation } from '../../lib/source/types'
import { OverflowTooltip } from '../OverflowTooltip'
import { GitBranchNavigator } from './GitBranchNavigator'
import { GitHistoryLog } from './GitHistoryLog'
import { GitNavigationSplit } from './GitNavigationSplit'
import { SourceAction } from './SourceAction'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'

export function GitHistoryWorkspace({
  navigation,
  navigationTabs,
  projectPath,
  tick,
  historyPath,
  onRepositoryChanged,
  remoteTick = 0,
}: {
  remoteTick?: number
  onRepositoryChanged?: () => void
  navigation: ReactNode
  navigationTabs?: ReactNode
  projectPath: string
  tick: number
  historyPath: string | null
}) {
  const t = useT()
  const branches = useSourceQuery(
    projectPath ? `branches:${projectPath}` : null,
    () => gitBranches(projectPath),
    `${tick}:${remoteTick}`,
  )
  const { revision } = useProjectSource()
  const [headTick, setHeadTick] = useState(0)
  const headState = useSourceQuery(
    projectPath ? `history-head:${projectPath}` : null,
    () => gitBranchState(projectPath),
    `${tick}:${remoteTick}:${revision}:${headTick}`,
  )
  useEffect(() => {
    const refreshHead = () => setHeadTick((value) => value + 1)
    window.addEventListener('focus', refreshHead)
    return () => window.removeEventListener('focus', refreshHead)
  }, [])
  const head = headState.data?.head ?? branches.data?.find((item) => item.current)?.tip ?? null
  const [location, setLocation] = useState<
    (GitHeadLocation & { nonce: number; tick: number }) | null
  >(null)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState('')
  const lookup = useRef(0)
  const lookupBusy = useRef(false)
  const activeLocation = location?.tick === tick ? location : null
  async function locateHead() {
    if (lookupBusy.current) return
    const nonce = ++lookup.current
    lookupBusy.current = true
    setLocating(true)
    setLocateError('')
    try {
      const next = await gitLogHead(projectPath)
      if (lookup.current !== nonce) return
      if (!next.head || !next.page.commits.some((commit) => commit.hash === next.head)) {
        setLocateError(t('source.headUnavailable'))
        return
      }
      setBranch(null)
      setBranchTip(null)
      setFile(null)
      setLocation({ ...next, nonce, tick })
      setHeadTick((value) => value + 1)
    } catch (error) {
      if (lookup.current === nonce)
        setLocateError(error instanceof Error ? error.message : String(error))
    } finally {
      if (lookup.current === nonce) {
        lookupBusy.current = false
        setLocating(false)
      }
    }
  }
  function returnToLatest() {
    lookup.current++
    lookupBusy.current = false
    setLocating(false)
    setLocateError('')
    setLocation(null)
  }
  const [filesHidden, setFilesHidden] = useState(false)
  const [diffHidden, setDiffHidden] = useState(false)
  const toggleFiles = useCallback(() => setFilesHidden((value) => !value), [])
  const toggleDiff = useCallback(() => setDiffHidden((value) => !value), [])
  const showDiff = useCallback(() => setDiffHidden(false), [])
  const [branch, setBranch] = useState<string | null>(null)
  const [branchTip, setBranchTip] = useState<string | null>(null)
  function chooseBranch(reference: string | null) {
    returnToLatest()
    setBranch(reference)
    setBranchTip(branches.data?.find((item) => branchReference(item) === reference)?.tip ?? null)
  }
  const [file, setFile] = useState(historyPath)
  const selected = branches.data?.find((item) => branchReference(item) === branch)
  const snapshot = useSourceQuery(
    branch ? `history-tip:${projectPath}:${branch}` : null,
    async () =>
      (await gitBranches(projectPath)).find((item) => branchReference(item) === branch)?.tip ??
      null,
    tick,
  )
  const logTip = snapshot.data ?? branchTip
  return (
    <GitNavigationSplit
      id="history"
      navigation={
        <aside className="git-history-navigation">
          {navigation}
          <GitBranchNavigator
            navigationHeader={navigationTabs}
            branches={branches.data ?? []}
            loading={branches.loading}
            error={branches.error}
            selected={branch}
            projectPath={projectPath}
            tick={tick}
            onSelect={chooseBranch}
            onChanged={onRepositoryChanged}
          />
        </aside>
      }
    >
      <div className="git-review-surface git-history-surface">
        {file && (
          <div className="git-path-filter">
            <OverflowTooltip text={t('source.historyForFile', { file })} />
            <SourceAction label={t('source.allCommits')} onPress={() => setFile(null)}>
              <X />
            </SourceAction>
          </div>
        )}
        <GitHistoryLog
          key={`${projectPath}:${branch ?? 'all'}:${logTip}:${tick}:${file}:${activeLocation?.nonce ?? 0}`}
          projectPath={projectPath}
          tip={logTip}
          tick={tick}
          historyPath={file}
          filesHidden={filesHidden}
          diffHidden={diffHidden}
          onToggleFiles={toggleFiles}
          onToggleDiff={toggleDiff}
          onShowDiff={showDiff}
          branchScope={selected?.name ?? null}
          onClearBranch={() => chooseBranch(null)}
          head={head}
          location={activeLocation}
          locating={locating}
          locateError={locateError}
          onLocateHead={() => void locateHead()}
          onLatest={returnToLatest}
        />
      </div>
    </GitNavigationSplit>
  )
}
