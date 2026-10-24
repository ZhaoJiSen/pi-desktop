import { Button, Popover } from '@heroui/react'
import { ChevronDown, Columns2, PanelBottomClose, Rows3, Search } from 'lucide-react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import type { CommitFile, GitCommit } from '../../lib/source/types'
import { HoverScrollArea } from '../HoverScrollArea'
import { CommitFiles } from './GitCommitFiles'
import { LoadedDiff } from './LoadedDiff'
import { SourceAction } from './SourceAction'
import { SourceFilePath } from './SourceFilePath'
import { useDiffLayout } from './useDiffLayout'

export function CommitPreview({
  commit,
  projectPath,
  tick,
  path,
  files,
  onSelectFile,
  onFind,
  onHide,
}: {
  onHide: () => void
  commit: GitCommit
  projectPath: string
  tick: number
  path: string
  files: CommitFile[]
  onSelectFile: (path: string) => void
  onFind: () => void
}) {
  const t = useT()
  const { ref, layout, setLayout } = useDiffLayout()
  const [filesOpen, setFilesOpen] = useState(false)
  return (
    <div className="git-commit-preview">
      <div className="git-diff-heading" ref={ref}>
        <SourceFilePath path={path} />
        <Popover isOpen={filesOpen} onOpenChange={setFilesOpen}>
          <Button variant="secondary" size="sm" className="git-compact-files-trigger">
            {t('source.commitMany', { count: files.length })}
            <ChevronDown />
          </Button>
          <Popover.Content className="git-commit-popover" placement="top end" offset={8}>
            <Popover.Dialog
              aria-label={t('source.changedFiles')}
              style={{ height: Math.min(420, Math.max(230, files.length * 48 + 180)) }}
            >
              <CommitFiles
                commit={commit}
                files={files}
                selected={path}
                onSelect={(next) => {
                  onSelectFile(next)
                  setFilesOpen(false)
                }}
              />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
        <SourceAction label={t('source.quickOpen')} onPress={onFind}>
          <Search />
        </SourceAction>
        <SourceAction
          label={t(layout === 'split' ? 'source.unified' : 'source.split')}
          onPress={() => setLayout(layout === 'split' ? 'unified' : 'split')}
        >
          {layout === 'split' ? <Columns2 /> : <Rows3 />}
        </SourceAction>
        <SourceAction label={t('source.hideDiff')} onPress={onHide}>
          <PanelBottomClose />
        </SourceAction>
      </div>
      <div className="git-diff-caption">
        <span>
          {commit.parents[0]?.slice(0, 7) ?? t('source.initialCommit')} → {commit.hash.slice(0, 7)}
        </span>
      </div>
      <HoverScrollArea
        className="source-preview-scroll"
        viewportClassName="source-scroll"
        label={path}
      >
        <LoadedDiff
          projectPath={projectPath}
          path={path}
          revision={commit.hash}
          tick={tick}
          layout={layout}
          embedded
        />
      </HoverScrollArea>
    </div>
  )
}
