import { Button } from '@heroui/react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { readProjectFile } from '../../lib/source/api'
import { findLineHits } from '../../lib/source/find'
import { fileNameOf } from '../../lib/source/paths'
import { fileLanguage, Highlight } from '../conversation/Highlight'
import { SourceNotice } from './SourceNotice'
import { useSourceQuery } from './useSourceQuery'
import { codeRowHeight, useVirtualWindow } from './useVirtualWindow'

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
  onBack: () => void
  onDiff: () => void
  onHistory: () => void
}) {
  const t = useT()
  const findRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const file = useSourceQuery(`file:${projectPath}:${path}:${tick}`, () =>
    readProjectFile(projectPath, path),
  )
  const lines = file.data && !file.data.binary ? file.data.text.split('\n') : []
  const hits = findLineHits(lines, query)
  const current = hits.length ? hits[hit % hits.length]! : -1
  const { scroller, scrollTo, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    lines.length,
    codeRowHeight,
  )
  useEffect(() => {
    if (current >= 0) scrollTo(current)
  }, [current, scrollTo])
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return
      const input = findRef.current
      if (!input) return
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
  return (
    <div className="source-detail">
      <div className="source-detail-bar">
        <Button variant="ghost" className="source-back" onPress={onBack}>
          {t('source.back')}
        </Button>
        <span className="source-detail-path" title={path}>
          {path}
        </span>
        {changed && (
          <Button variant="ghost" className="source-back" onPress={onDiff}>
            {t('source.showDiff')}
          </Button>
        )}
        <Button variant="ghost" className="source-back" onPress={onHistory}>
          {t('source.fileHistory')}
        </Button>
        {readable && (
          <input
            ref={findRef}
            className="source-find"
            value={query}
            placeholder={t('source.find')}
            aria-label={t('source.find')}
            onChange={(event) => {
              setQuery(event.target.value)
              setHit(0)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || !hits.length) return
              event.preventDefault()
              const step = event.shiftKey ? hits.length - 1 : 1
              setHit((index) => (index + step) % hits.length)
            }}
          />
        )}
        {readable && (
          <Button
            variant="ghost"
            className="source-back"
            onPress={() => void navigator.clipboard?.writeText(text)}
          >
            {t('source.copy')}
          </Button>
        )}
      </div>
      {file.loading && <SourceNotice kind="loading" text={t('source.loading')} />}
      {file.error && <SourceNotice kind="error" text={file.error} />}
      {file.data?.binary && <SourceNotice kind="empty" text={t('source.binaryFile')} />}
      {readable && (
        <>
          {file.data?.truncated && <p className="source-note">{t('source.truncatedFile')}</p>}
          <div
            className="code source-file"
            tabIndex={0}
            aria-label={fileNameOf(path)}
            ref={scroller}
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
