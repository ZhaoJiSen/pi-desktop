import { Button, ToggleButton, ToggleButtonGroup } from '@heroui/react'
import { DiffModeEnum, DiffView } from '@git-diff-view/react'
import { ChevronLeft, Columns2, Rows3 } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useColorMode } from '../../hooks/useColorMode'
import { useT } from '../../lib/i18n'
import {
  countPatch,
  ensureUnifiedPatch,
  isBinaryPatch,
  toolDiffToUnified,
} from '../../lib/source/diff'
import { useWorkspace } from '../../store/workspace'
import type { DiffLine } from '../../types'
import { fileLanguage } from '../conversation/Highlight'
import { SourceNotice } from './SourceNotice'
import { SourceFilePath } from './SourceFilePath'
import { useDiffLayout } from './useDiffLayout'
import { VirtualDiff } from './VirtualDiff'
import '@git-diff-view/react/styles/diff-view-pure.css'

const highlightLang: Record<string, string> = { markup: 'xml' }

export function FileDiff({
  path,
  text,
  binary,
  truncated,
  missing,
  fallback,
  embedded,
  layout,
  onBack,
  onStats,
}: {
  path: string
  text: string
  binary: boolean
  truncated: boolean
  missing: boolean
  fallback?: DiffLine[]
  embedded?: boolean
  layout?: 'unified' | 'split'
  onBack?: () => void
  onStats?: (path: string, stats: { additions: number; deletions: number } | null) => void
}) {
  const t = useT()
  const theme = useWorkspace((state) => state.theme)
  const codeSize = useWorkspace((state) => state.fonts.codeSize)
  const mode = useColorMode(theme)
  const {
    ref: layoutRef,
    layout: ownLayout,
    setLayout: setOwnLayout,
  } = useDiffLayout(layout === undefined)
  const layoutMode = layout ?? ownLayout
  const patch = useMemo(() => {
    if (binary || isBinaryPatch(text)) return null
    if (!missing && text.trim()) return ensureUnifiedPatch(path, text)
    if (fallback?.length) return toolDiffToUnified(path, fallback)
    return null
  }, [binary, fallback, missing, path, text])
  const stats = useMemo(() => (patch ? countPatch(patch) : null), [patch])
  useEffect(() => {
    onStats?.(path, truncated ? null : stats)
  }, [onStats, path, stats, truncated])
  const virtual = useMemo(() => (patch?.split('\n').length ?? 0) > 240, [patch])
  const lang = highlightLang[fileLanguage(path)] ?? fileLanguage(path)
  // DiffView creates a new parser and replaces its entire code tree when data
  // changes identity, even if the patch is unchanged (e.g. another file opens).
  const data = useMemo(
    () => ({
      oldFile: { fileName: path, fileLang: lang || null },
      newFile: { fileName: path, fileLang: lang || null },
      hunks: patch ? [patch] : [],
    }),
    [lang, patch, path],
  )
  const showBar = Boolean(onBack) || !embedded || layout === undefined
  return (
    <div className={embedded ? 'source-detail is-embedded' : 'source-detail'} ref={layoutRef}>
      {showBar && (
        <div className="source-detail-bar">
          {onBack && (
            <Button
              isIconOnly
              variant="ghost"
              className="icon-button source-back"
              aria-label={t('source.back')}
              onPress={onBack}
            >
              <ChevronLeft />
            </Button>
          )}
          {!embedded && <SourceFilePath path={path} />}
          {!embedded && stats && (
            <span className="diff-stats">
              <span className="positive">+{stats.additions}</span>
              {stats.deletions > 0 && <span className="negative">−{stats.deletions}</span>}
            </span>
          )}
          {layout === undefined && patch && (
            <ToggleButtonGroup
              className="source-layout"
              size="sm"
              aria-label={t('source.diffLayout')}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[layoutMode]}
              onSelectionChange={(keys) => setOwnLayout(keys.has('split') ? 'split' : 'unified')}
            >
              <ToggleButton
                id="unified"
                aria-label={t('source.unified')}
                className="source-layout-button"
              >
                <Rows3 />
              </ToggleButton>
              <ToggleButton
                id="split"
                aria-label={t('source.split')}
                className="source-layout-button"
              >
                <Columns2 />
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </div>
      )}
      {truncated && <p className="source-note">{t('source.truncatedDiff')}</p>}
      {binary || isBinaryPatch(text) ? (
        <SourceNotice kind="empty" text={t('source.binaryFile')} />
      ) : !patch || !stats ? (
        <SourceNotice kind="empty" text={t('source.missingDiff')} />
      ) : (
        <div className="diff diff-panel">
          <div className="source-git-diff" data-layout={layoutMode}>
            {virtual ? (
              <VirtualDiff data={data} layout={layoutMode} mode={mode} codeSize={codeSize} />
            ) : (
              <DiffView
                data={data}
                diffViewMode={layoutMode === 'split' ? DiffModeEnum.Split : DiffModeEnum.Unified}
                diffViewTheme={mode}
                diffViewFontSize={codeSize}
                diffViewHighlight
                diffViewWrap={false}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
