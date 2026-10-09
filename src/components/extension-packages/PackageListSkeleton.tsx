import { Skeleton } from '@heroui/react'
import { useT } from '../../lib/i18n'

const widths = ['72%', '58%', '84%', '66%', '78%', '54%']

export function PackageListSkeleton() {
  const t = useT()
  return (
    <div className="package-list-skeleton" role="status" aria-label={t('packages.loading')}>
      <div aria-hidden="true">
        {widths.map((width) => (
          <div className="package-skeleton-row" key={width}>
            <Skeleton animationType="pulse" className="package-skeleton-icon" />
            <div className="package-skeleton-copy">
              <Skeleton
                animationType="pulse"
                className="package-skeleton-title"
                style={{ width }}
              />
              <Skeleton animationType="pulse" className="package-skeleton-subtitle" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
