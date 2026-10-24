import { Button, Separator, Toolbar, Tooltip } from '@heroui/react'
import { Columns2, FileSymlink, Rows3, Undo2 } from 'lucide-react'
import { useT } from '../../lib/i18n'

/** Contextual file controls built from the existing, free HeroUI primitives. */
export function GitFileActionBar({
  stats,
  onOpen,
  onRestore,
  restoring,
}: {
  stats?: { additions?: number; deletions?: number }
  onOpen?: () => void
  onRestore?: () => void
  restoring: boolean
}) {
  const t = useT()
  return (
    <Toolbar aria-label={t('source.fileActions')} className="git-file-action-bar">
      {stats && (
        <span className="diff-stats">
          {stats.additions !== undefined && <span className="positive">+{stats.additions}</span>}
          {stats.deletions !== undefined && <span className="negative">−{stats.deletions}</span>}
        </span>
      )}
      {onOpen && (
        <>
          {stats && <Separator />}
          <Tooltip delay={450}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t('source.openFile')}
              onPress={onOpen}
            >
              <FileSymlink />
            </Button>
            <Tooltip.Content placement="bottom">{t('source.openFile')}</Tooltip.Content>
          </Tooltip>
        </>
      )}
      {onRestore && (
        <>
          {(stats || onOpen) && <Separator />}
          <Tooltip delay={450}>
            <Button
              size="sm"
              isIconOnly
              variant="ghost"
              className="git-file-discard"
              aria-label={t('source.restore')}
              isDisabled={restoring}
              onPress={onRestore}
            >
              <Undo2 />
            </Button>
            <Tooltip.Content placement="bottom">{t('source.restore')}</Tooltip.Content>
          </Tooltip>
        </>
      )}
    </Toolbar>
  )
}

export function GitDiffLayoutControl({
  layout,
  onToggle,
}: {
  layout: 'split' | 'unified'
  onToggle: () => void
}) {
  const t = useT()
  const switchLabel = layout === 'split' ? t('source.unified') : t('source.split')
  return (
    <Tooltip delay={450}>
      <Button
        size="sm"
        variant="secondary"
        className="git-diff-layout-toggle"
        aria-label={switchLabel}
        onPress={onToggle}
      >
        {layout === 'split' ? <Columns2 /> : <Rows3 />}
        <span>{layout === 'split' ? t('source.split') : t('source.unified')}</span>
      </Button>
      <Tooltip.Content placement="bottom">{switchLabel}</Tooltip.Content>
    </Tooltip>
  )
}
