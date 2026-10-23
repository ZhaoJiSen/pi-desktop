import { ChevronRight, LoaderCircle } from 'lucide-react'
import { Button, TreeItem, TreeItemContent } from 'react-aria-components'
import { useCallback, type ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import { FileTreeIcon } from './FileTreeIcon'

export function SourceTreeItem({
  path,
  name,
  kind,
  selected,
  loading,
  code,
  agent,
  onAction,
  children,
}: {
  path: string
  name: string
  kind: 'dir' | 'file' | 'link'
  selected?: boolean
  loading?: boolean
  code?: string
  agent?: boolean
  onAction: () => void
  children?: ReactNode
}) {
  const t = useT()
  const reveal = useCallback(
    (element: HTMLDivElement | null) => {
      if (!selected || !element) return
      const viewport = element.closest<HTMLElement>('.hover-scroll-viewport')
      if (!viewport) return
      const revealRow = () => {
        if (!viewport.clientHeight) return
        const row = element.getBoundingClientRect()
        const bounds = viewport.getBoundingClientRect()
        // Viewport geometry is in visual pixels; scrollTop remains in CSS pixels.
        const scale = bounds.height / viewport.clientHeight || 1
        if (row.top < bounds.top)
          viewport.scrollTo({ top: viewport.scrollTop + (row.top - bounds.top) / scale })
        else if (row.bottom > bounds.bottom)
          viewport.scrollTo({ top: viewport.scrollTop + (row.bottom - bounds.bottom) / scale })
      }
      revealRow()
      const observer = new ResizeObserver(revealRow)
      observer.observe(viewport)
      return () => observer.disconnect()
    },
    [selected],
  )
  return (
    <TreeItem
      id={path}
      textValue={name}
      className={selected ? 'source-tree-item is-current' : 'source-tree-item'}
      aria-current={selected || undefined}
      hasChildItems={kind === 'dir'}
      isDisabled={kind === 'link'}
      onAction={onAction}
    >
      <TreeItemContent>
        {({ level, isExpanded }) => (
          <div
            ref={reveal}
            className="source-tree-content"
            aria-current={selected || undefined}
            style={{ paddingLeft: 6 + (level - 1) * 16 }}
          >
            {Array.from({ length: level - 1 }, (_, index) => (
              <span
                key={index}
                className="source-tree-guide"
                style={{ left: 14 + index * 16 }}
                aria-hidden="true"
              />
            ))}
            {kind === 'dir' ? (
              <Button slot="chevron" className="source-tree-chevron">
                <ChevronRight aria-hidden="true" />
              </Button>
            ) : (
              <span className="source-tree-chevron-space" aria-hidden="true" />
            )}
            {loading ? (
              <LoaderCircle className="source-tree-icon is-loading" aria-hidden="true" />
            ) : (
              <FileTreeIcon name={name} kind={kind} expanded={isExpanded} />
            )}
            <span className="source-tree-name" title={path}>
              <bdi>{name}</bdi>
            </span>
            <span className="source-tree-marks">
              {code && (
                <span className="source-code" data-code={code}>
                  {code}
                </span>
              )}
              {agent && (
                <span className="source-agent" title={t('source.agent')}>
                  {t('source.agent')}
                </span>
              )}
            </span>
          </div>
        )}
      </TreeItemContent>
      {children}
    </TreeItem>
  )
}
