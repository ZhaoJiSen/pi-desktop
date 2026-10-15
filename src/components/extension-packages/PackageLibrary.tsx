import { Pagination } from '@heroui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { PackageFeedback } from './PackageFeedback'
import { PackageLibraryControls } from './library/PackageLibraryControls'
import { PackageLibraryList } from './library/PackageLibraryList'
import type { PackageLibraryProps } from './library/types'

export function PackageLibrary(props: PackageLibraryProps) {
  const t = useT()
  const { mode, feedback, page, hasNext, loading, changePage } = props
  return (
    <section
      className="package-library"
      aria-label={mode === 'installed' ? t('packages.installed') : t('packages.discover')}
    >
      <PackageLibraryControls {...props} />
      <PackageFeedback {...feedback} />
      <PackageLibraryList {...props} />
      {mode === 'discover' && (page > 1 || hasNext) && (
        <Pagination className="package-pagination" size="sm" aria-label={t('packages.discover')}>
          <Pagination.Previous
            isDisabled={page <= 1 || loading}
            onPress={() => changePage(-1)}
            aria-label={t('packages.previousPage')}
          >
            <ChevronLeft />
          </Pagination.Previous>
          <Pagination.Summary>{t('packages.pageNumber', { page })}</Pagination.Summary>
          <Pagination.Next
            isDisabled={!hasNext || loading}
            onPress={() => changePage(1)}
            aria-label={t('packages.nextPage')}
          >
            <ChevronRight />
          </Pagination.Next>
        </Pagination>
      )}
    </section>
  )
}
