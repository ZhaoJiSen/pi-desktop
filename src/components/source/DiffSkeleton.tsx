import { Skeleton } from '@heroui/react'
import { useT } from '../../lib/i18n'

const lines = [38, 64, 52, 76, 44, 30]

export function DiffSkeleton({ layout }: { layout?: 'unified' | 'split' }) {
  const t = useT()
  return (
    <div
      className="source-diff-skeleton"
      data-layout={layout ?? 'auto'}
      role="status"
      aria-label={t('source.loading')}
    >
      <div className="source-diff-skeleton-columns" aria-hidden="true">
        {[0, 1].map((side) => (
          <div className="source-diff-skeleton-column" key={side}>
            {lines.map((width) => (
              <div className="source-diff-skeleton-row" key={width}>
                <span className="source-diff-skeleton-gutter">
                  <Skeleton animationType="pulse" className="source-diff-skeleton-number" />
                </span>
                <Skeleton
                  animationType="pulse"
                  className="source-diff-skeleton-code"
                  style={{ width: `${width}%` }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
