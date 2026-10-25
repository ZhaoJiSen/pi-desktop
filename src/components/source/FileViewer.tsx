import { Button, SearchField } from '@heroui/react'
import { SourceAction } from './SourceAction'
import { ChevronLeft, Copy, GitCompare, History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { readProjectFile } from '../../lib/source/api'
import { findLineHits } from '../../lib/source/find'
import { fileNameOf } from '../../lib/source/paths'
import { fileLanguage, Highlight } from '../conversation/Highlight'
import { SourceNotice } from './SourceNotice'
import { GitFilePathLabel } from './GitFilePathLabel'
import { useSourceQuery } from './useSourceQuery'
import { codeRowHeight, useVirtualWindow } from './useVirtualWindow'

type CopyNote = '' | 'copied' | 'partial' | 'failed'

export function FileViewer({
  projectPath,
  path,
  tick,
  changed,
  onBack,
  onDiff,
  onHistory,
}: {
  projectPath: string
  path: string
  tick: number
  changed: boolean
  onBack?: () => void
  onDiff: () => void
  onHistory: () => void
}) {
  const t = useT()
  const findRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const [copyNote, setCopyNote] = useState<CopyNote>('')
  const [trackedPath, setTrackedPath] = useState(path)
  if (trackedPath !== path) {
    setTrackedPath(path)
    setQuery('')
    setHit(0)
    setCopyNote('')
  }
  const file = useSourceQuery(
    `file:${projectPath}:${path}`,
    () => readProjectFile(projectPath, path),
    tick,
  )
  const lines = useMemo(
    () => (file.data && !file.data.binary ? file.data.text.split('\n') : []),
    [file.data],
  )
  const hits = useMemo(() => findLineHits(lines, query), [lines, query])
  const current = hits.length ? hits[hit % hits.length]! : -1
  const { scroller, scrollTo, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    lines.length,
    codeRowHeight,
  )
  const bindCode = useCallback(
    (element: HTMLDivElement | null) => {
      codeRef.current = element
      scroller(element)
    },
    [scroller],
  )
  useEffect(() => {
    if (current >= 0) scrollTo(current)
  }, [current, scrollTo])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.shiftKey) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return
      const input = findRef.current
      const panel = input?.closest('.source-panel')
      if (!input || !panel?.contains(document.activeElement)) return
      event.preventDefault()
      input.focus()
      input.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const language = fileLanguage(path)
  const readable = Boolean(file.data && !file.data.binary)
  const text = readable && file.data ? file.data.text : ''
  const truncated = Boolean(file.data?.truncated)
  const copy = () => {
    const writing = navigator.clipboard?.writeText(text)
    if (!writing) {
      setCopyNote('failed')
      return
    }
    void writing.then(
      () => setCopyNote(truncated ? 'partial' : 'copied'),
      () => setCopyNote('failed'),
    )
  }
  return (
    <div className="source-detail">
      <div className="source-detail-bar source-preview-bar source-file-preview-bar">
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
        <GitFilePathLabel path={path} />
        {changed && (
          <SourceAction label={t('source.showDiff')} onPress={onDiff}>
            <GitCompare />
          </SourceAction>
        )}
        <SourceAction label={t('source.fileHistory')} onPress={onHistory}>
          <History />
        </SourceAction>
        {readable && (
          <SourceAction label={t(truncated ? 'source.copyPartial' : 'source.copy')} onPress={copy}>
            <Copy />
          </SourceAction>
        )}
      </div>
      <div className="source-filter source-file-find">
        {readable && (
          <SearchField
            className="source-file-search"
            variant="secondary"
            value={query}
            aria-label={t('source.find')}
            onChange={(value) => {
              setQuery(value)
              setHit(0)
            }}
          >
            <SearchField.Group>
              <SearchField.SearchIcon />
              <SearchField.Input
                ref={findRef}
                className="source-find"
                placeholder={t('source.find')}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setQuery('')
                    setHit(0)
                    codeRef.current?.focus()
                    return
                  }
                  if (event.key !== 'Enter' || !hits.length) return
                  event.preventDefault()
                  const step = event.shiftKey ? hits.length - 1 : 1
                  setHit((index) => (index + step) % hits.length)
                }}
              />
            </SearchField.Group>
          </SearchField>
        )}
        {readable && query && (
          <span className="source-find-status" role="status" aria-live="polite">
            {hits.length
              ? t('source.findCount', {
                  current: String((hit % hits.length) + 1),
                  total: String(hits.length),
                })
              : t('source.findNone')}
          </span>
        )}
        {copyNote && (
          <span className="source-find-status" role="status">
            {t(
              copyNote === 'failed'
                ? 'source.copyFailed'
                : copyNote === 'partial'
                  ? 'source.copiedPartial'
                  : 'source.copied',
            )}
          </span>
        )}
      </div>
      {file.loading && <SourceNotice kind="loading" text={t('source.loading')} />}
      {file.error && !file.data && <SourceNotice kind="error" text={file.error} />}
      {file.data?.binary && <SourceNotice kind="empty" text={t('source.binaryFile')} />}
      {readable && (
        <>
          {truncated && <p className="source-note">{t('source.truncatedFile')}</p>}
          <div
            className="code source-file-content"
            tabIndex={0}
            aria-label={fileNameOf(path)}
            ref={bindCode}
          >
            <div className="source-vpad" style={{ height: paddingTop }} />
            {lines.slice(start, end).map((line, offset) => {
              const index = start + offset
              return (
                <div
                  className={
                    index === current
                      ? 'code-line context source-vrow is-current'
                      : 'code-line context source-vrow'
                  }
                  style={{ height: codeRowHeight }}
                  key={index}
                >
                  <span className="line-no">{index + 1}</span>
                  <code className="source">
                    <Highlight text={line} language={language} />
                  </code>
                </div>
              )
            })}
            <div className="source-vpad" style={{ height: paddingBottom }} />
          </div>
        </>
      )}
    </div>
  )
}
