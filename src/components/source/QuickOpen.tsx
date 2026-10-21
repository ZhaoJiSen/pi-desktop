import { Button, Modal } from '@heroui/react'
import { File, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useT } from '../../lib/i18n'
import { searchProjectFiles } from '../../lib/source/api'
import { fuzzyFilter } from '../../lib/source/fuzzy'
import { fileNameOf } from '../../lib/source/paths'
import { useSource } from './context'
import { SourceNotice } from './SourceNotice'
import { useProjectSource } from './useProjectSource'
import { useSourceQuery } from './useSourceQuery'
import { searchRowHeight, useVirtualWindow } from './useVirtualWindow'

export function QuickOpen() {
  const source = useSource()
  if (!source?.quickOpen) return null
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(value) => {
        if (!value) source.setQuickOpen(false)
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="md" placement="top">
        <QuickOpenContent
          onOpen={(path) => {
            source.show({ tab: 'files', path, mode: 'view' })
            source.setQuickOpen(false)
          }}
        />
      </Modal.Container>
    </Modal.Backdrop>
  )
}

function QuickOpenContent({ onOpen }: { onOpen: (path: string) => void }) {
  const t = useT()
  const { path: projectPath } = useProjectSource()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const found = useSourceQuery(projectPath ? `search:${projectPath}` : null, () =>
    searchProjectFiles(projectPath),
  )
  const results = useMemo(
    () => fuzzyFilter(query, found.data?.files ?? []),
    [found.data?.files, query],
  )
  const selected = Math.min(active, Math.max(results.length - 1, 0))
  const { scroller, scrollTo, start, end, paddingTop, paddingBottom } = useVirtualWindow(
    results.length,
    searchRowHeight,
  )
  return (
    <Modal.Dialog className="search-dialog" aria-label={t('source.quickOpen')}>
      <Modal.Header>
        <Modal.Heading className="sr-only">{t('source.quickOpen')}</Modal.Heading>
        <label className="search-field">
          <Search />
          <input
            autoFocus
            value={query}
            placeholder={t('source.quickOpenPlaceholder')}
            aria-label={t('source.quickOpen')}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              scrollTo(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                const next = Math.min(selected + 1, results.length - 1)
                setActive(next)
                scrollTo(next)
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                const next = Math.max(selected - 1, 0)
                setActive(next)
                scrollTo(next)
              } else if (event.key === 'Enter') {
                const path = results[selected]
                if (!path) return
                event.preventDefault()
                onOpen(path)
              }
            }}
          />
          <kbd>esc</kbd>
        </label>
      </Modal.Header>
      <Modal.Body className="search-results">
        {!projectPath && <SourceNotice kind="empty" text={t('source.noProject')} />}
        {projectPath && found.loading && <SourceNotice kind="loading" text={t('source.loading')} />}
        {found.error && <SourceNotice kind="error" text={found.error} />}
        <div className="source-virtual" ref={scroller}>
          <div className="source-vpad" style={{ height: paddingTop }} />
          {results.slice(start, end).map((path, offset) => {
            const index = start + offset
            return (
              <Button
                key={path}
                variant="ghost"
                className={
                  index === selected
                    ? 'search-result is-active source-vrow'
                    : 'search-result source-vrow'
                }
                style={{ height: searchRowHeight }}
                onPress={() => onOpen(path)}
              >
                <File />
                <span>
                  <span>{fileNameOf(path)}</span>
                  <small>{path}</small>
                </span>
              </Button>
            )
          })}
          <div className="source-vpad" style={{ height: paddingBottom }} />
        </div>
        {projectPath && found.data && results.length === 0 && (
          <div className="popover-empty">{t('source.emptySearch')}</div>
        )}
      </Modal.Body>
    </Modal.Dialog>
  )
}
