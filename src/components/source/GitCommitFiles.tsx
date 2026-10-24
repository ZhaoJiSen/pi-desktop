import { PanelRightClose } from 'lucide-react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import { useT } from '../../lib/i18n'
import type { CommitFile, GitCommit } from '../../lib/source/types'
import { useWorkspace } from '../../store/workspace'
import { HoverScrollArea } from '../HoverScrollArea'
import { OverflowTooltip } from '../OverflowTooltip'
import { GitFileNavigator } from './GitFileNavigator'
import { SourceAction } from './SourceAction'

export function CommitFiles({
  commit,
  files,
  selected,
  onSelect,
  onHide,
  resizable = false,
}: {
  resizable?: boolean
  onHide?: () => void
  commit: GitCommit
  files: CommitFile[]
  selected: string | null
  onSelect: (path: string) => void
}) {
  const t = useT()
  const language = useWorkspace((state) => state.language)
  const layout = useDefaultLayout({
    id: 'pi.git-commit-details.v1',
    panelIds: ['files', 'details'],
    onlySaveAfterUserInteractions: true,
  })
  const navigator = (
    <GitFileNavigator
      initialFlat
      basic
      compactSearch
      headingActions={
        onHide ? (
          <SourceAction label={t('source.hideChangedFiles')} onPress={onHide}>
            <PanelRightClose />
          </SourceAction>
        ) : undefined
      }
      files={files}
      selected={selected}
      onSelect={onSelect}
      heading={
        <div className="git-commit-files-heading">
          {t('source.changedFiles')}
          <span>{files.length}</span>
        </div>
      }
    />
  )
  const details = (
    <div className="git-commit-details">
      <OverflowTooltip as="strong" text={commit.subject} />
      <div className="git-commit-metadata">
        <OverflowTooltip text={commit.author} />
        <OverflowTooltip as="code" text={commit.hash.slice(0, 12)} tooltip={commit.hash} />
      </div>
      <time dateTime={new Date(commit.timestamp * 1000).toISOString()}>
        {new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(
          commit.timestamp * 1000,
        )}
      </time>
    </div>
  )
  if (resizable) {
    return (
      <Group
        orientation="vertical"
        className="git-commit-split"
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <Panel id="files" minSize={96} className="git-commit-file-panel">
          {navigator}
        </Panel>
        <Separator
          className="git-log-separator git-commit-details-separator"
          aria-label={t('source.resizeCommitDetails')}
        />
        <Panel
          id="details"
          minSize={64}
          defaultSize={78}
          maxSize="60%"
          groupResizeBehavior="preserve-pixel-size"
          className="git-commit-details-panel"
        >
          <HoverScrollArea
            className="git-commit-details-scroll"
            label={t('source.commitDetails')}
            shadowSize={12}
          >
            {details}
          </HoverScrollArea>
        </Panel>
      </Group>
    )
  }
  return (
    <>
      {navigator}
      {details}
    </>
  )
}
