import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { FileText } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { fromToolDiff, parseUnifiedDiff } from '../../lib/source/diff'
import { fileNameOf } from '../../lib/source/paths'
import type { DiffLine } from '../../types'
import { SplitRows, UnifiedRows } from './DiffRows'
import { SourceNotice } from './SourceNotice'

export function FileDiff({
  path,
  text,
  binary,
  truncated,
  missing,
  fallback,
  onBack,
}: {
  path: string
  text: string
  binary: boolean
  truncated: boolean
  missing: boolean
  fallback?: DiffLine[]
  onBack?: () => void
}) {
  const t = useT()
  const [layout, setLayout] = useState<'unified' | 'split'>('unified')
  const parsed = useMemo(() => {
    if (!missing && text) return parseUnifiedDiff(text)
    if (fallback?.length) return fromToolDiff(fallback)
    return null
  }, [fallback, missing, text])
  const name = fileNameOf(path)
  return (
    <div className="source-detail">
      <div className="source-detail-bar">
        {onBack && (
          <Button variant="ghost" className="source-back" onPress={onBack}>
            {t('source.back')}
          </Button>
        )}
        <span className="source-detail-path" title={path}>
          {path}
        </span>
        {parsed && !parsed.binary && (
          <ToggleButtonGroup
            className="source-layout"
            aria-label={t('source.diffLayout')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[layout]}
            onSelectionChange={(keys) => setLayout(keys.has('split') ? 'split' : 'unified')}
          >
            <ToggleButton id="unified">{t('source.unified')}</ToggleButton>
            <ToggleButton id="split">{t('source.split')}</ToggleButton>
          </ToggleButtonGroup>
        )}
      </div>
      {truncated && <p className="source-note">{t('source.truncatedDiff')}</p>}
      {binary || parsed?.binary ? (
        <SourceNotice kind="empty" text={t('source.binaryFile')} />
      ) : !parsed ? (
        <SourceNotice kind="empty" text={t('source.missingDiff')} />
      ) : (
        <div className="diff diff-panel">
          <div className="diff-header">
            <FileText />
            <span className="diff-file" title={path}>
              {name}
            </span>
            <span className="diff-stats">
              <span className="positive">+{parsed.additions}</span>
              {parsed.deletions > 0 && <span className="negative">−{parsed.deletions}</span>}
            </span>
          </div>
          {layout === 'split' ? (
            <SplitRows rows={parsed.rows} path={path} />
          ) : (
            <UnifiedRows rows={parsed.rows} path={path} />
          )}
        </div>
      )}
    </div>
  )
}
