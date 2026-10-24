import { Modal } from '@heroui/react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'
import { fileNameOf } from '../../lib/source/paths'
import { OverflowTooltip } from '../OverflowTooltip'
import { FileTreeIcon } from './FileTreeIcon'
import { useFileSearch, type NavigableFile } from './GitFileList'
import { MatchedText } from './GitMatchedText'
import { SourceNotice } from './SourceNotice'

export function GitQuickFind({
  files,
  selected,
  onSelect,
  onClose,
  scope,
}: {
  files: NavigableFile[]
  selected: string | null
  onSelect: (path: string) => void
  onClose: () => void
  scope?: string
}) {
  const t = useT()
  const [query, setQuery] = useState('')
  const results = useFileSearch(files, query)
  const [active, setActive] = useState(0)
  const current = Math.min(active, Math.max(0, results.length - 1))
  const list = useRef<HTMLDivElement>(null)
  // oxlint-disable-next-line react/incompatible-library -- TanStack owns mutable measurements; do not memoize the virtualizer.
  const quickVirtual = useVirtualizer({
    count: results.length,
    getScrollElement: () => list.current,
    estimateSize: () => 48,
    overscan: 8,
  })
  useEffect(() => {
    quickVirtual.scrollToIndex(current, { align: 'auto' })
  }, [current, quickVirtual])
  function choose(path: string) {
    onSelect(path)
    onClose()
  }
  return (
    <Modal.Backdrop
      isOpen
      onOpenChange={(value) => {
        if (!value) onClose()
      }}
      className="dialog-backdrop git-quick-backdrop"
    >
      <Modal.Container size="md" className="git-quick-container">
        <Modal.Dialog className="git-quick-dialog" aria-label={t('source.quickOpen')}>
          <Modal.Header>
            <Modal.Heading className="sr-only">{t('source.quickOpen')}</Modal.Heading>
            <label className="git-quick-input">
              <Search />
              <input
                autoFocus
                value={query}
                placeholder={t('source.searchFiles')}
                role="combobox"
                aria-controls="git-quick-results"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-activedescendant={results[current] ? `git-quick-${current}` : undefined}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActive(0)
                  quickVirtual.scrollToIndex(0, { align: 'start' })
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault()
                    setActive(
                      Math.max(
                        0,
                        Math.min(
                          results.length - 1,
                          current + (event.key === 'ArrowDown' ? 1 : -1),
                        ),
                      ),
                    )
                  }
                  if (event.key === 'Enter' && results[current]) {
                    event.preventDefault()
                    choose(results[current]!.path)
                  }
                }}
                aria-label={t('source.searchFiles')}
              />
              <kbd>esc</kbd>
            </label>
          </Modal.Header>
          <Modal.Body>
            <div className="git-quick-scope">
              <span role="status" aria-live="polite">
                {t('source.fileSearchResults', { count: results.length, total: files.length })}
              </span>
              {scope && <span>{scope}</span>}
            </div>
            <div
              className="git-quick-results"
              ref={list}
              role="listbox"
              id="git-quick-results"
              aria-label={t('source.changedFiles')}
            >
              <div style={{ height: quickVirtual.getTotalSize(), position: 'relative' }}>
                {quickVirtual.getVirtualItems().map((row) => {
                  const index = row.index
                  const file = results[index]!
                  return (
                    <button
                      type="button"
                      id={`git-quick-${index}`}
                      key={file.path}
                      role="option"
                      aria-selected={current === index}
                      data-index={index}
                      style={{
                        position: 'absolute',
                        top: row.start,
                        height: row.size,
                        width: '100%',
                      }}
                      className="git-quick-row"
                      onClick={() => choose(file.path)}
                    >
                      <FileTreeIcon name={fileNameOf(file.path)} kind="file" expanded={false} />
                      <span className="git-file-label">
                        <OverflowTooltip text={fileNameOf(file.path)} tooltip={file.path}>
                          <MatchedText file={file} field="name" />
                        </OverflowTooltip>
                        <OverflowTooltip as="small" text={file.path}>
                          <MatchedText file={file} field="path" />
                        </OverflowTooltip>
                      </span>
                      <span className="source-code" data-code={file.code}>
                        {file.code}
                      </span>
                      {selected === file.path && <span aria-hidden="true">•</span>}
                    </button>
                  )
                })}
              </div>
              {!results.length && <SourceNotice kind="empty" text={t('source.emptySearch')} />}
            </div>
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
