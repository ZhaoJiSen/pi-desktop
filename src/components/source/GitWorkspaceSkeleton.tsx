import { Skeleton } from '@heroui/react'
import type { ReactNode } from 'react'
import { useT } from '../../lib/i18n'
import { DiffSkeleton } from './DiffSkeleton'
import { GitNavigationLayoutProvider, GitNavigationSplit } from './GitNavigationSplit'

const widths = [72, 55, 83, 64, 46, 76]

function Bar({ width = '100%', className = '' }: { width?: string; className?: string }) {
  return (
    <Skeleton animationType="pulse" className={`git-skeleton-bar ${className}`} style={{ width }} />
  )
}

export function GitNavigationSkeleton({ context = false }: { context?: boolean }) {
  const t = useT()
  return (
    <div className="git-navigation-skeleton" role="status" aria-label={t('source.loading')}>
      {context && (
        <div className="git-browser-heading" aria-hidden="true">
          <h1 className="git-browser-title">{t('source.workspace')}</h1>
          <div className="git-repository-context">
            <Bar width="55px" />
            <Bar width="55px" />
          </div>
        </div>
      )}
      <div
        aria-hidden="true"
        className={context ? 'git-navigation-surface git-loading-navigation' : undefined}
      >
        {context && (
          <div className="git-view-nav git-skeleton-tabs">
            <Bar />
            <Bar />
          </div>
        )}
        <div className="git-skeleton-tools">
          <Bar width="48%" />
          <Bar width="20%" />
        </div>
        {widths.map((width, index) => (
          <div
            className="git-skeleton-file"
            key={index}
            style={{ paddingLeft: index < 2 ? 8 : 24 }}
          >
            <Bar className="git-skeleton-icon" />
            <Bar width={`${width}%`} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function GitReviewSkeleton({ view = 'changes' }: { view?: 'changes' | 'history' }) {
  const t = useT()
  return (
    <div
      className="git-review-skeleton"
      data-view={view}
      role="status"
      aria-label={t('source.loading')}
    >
      <div aria-hidden="true" className="git-skeleton-review-content">
        {view === 'changes' && (
          <div className="git-review-toolbar">
            <Bar width="110px" />
            <Bar width="84px" />
          </div>
        )}
        {view === 'history' ? (
          <div className="git-skeleton-log">
            <div className="git-skeleton-commits git-navigation-surface">
              <div className="git-skeleton-tools">
                <Bar width="75%" />
                <Bar width="16%" />
              </div>
              {Array.from({ length: 9 }, (_, index) => (
                <div className="git-skeleton-commit" key={index}>
                  <Bar className="git-skeleton-dot" />
                  <Bar width={`${widths[index % widths.length]}%`} />
                  <Bar width="54px" />
                </div>
              ))}
            </div>
            <div className="git-skeleton-commit-files">
              <div className="git-navigation-surface">
                <GitNavigationSkeleton />
              </div>
              <div className="git-navigation-surface git-skeleton-metadata">
                <Bar width="88%" />
                <Bar width="65%" />
                <Bar width="76%" />
              </div>
            </div>
          </div>
        ) : (
          <div className="git-skeleton-file-header">
            <Bar width="32%" />
            <Bar width="96px" />
          </div>
        )}
        <div className={`git-skeleton-diff ${view === 'history' ? 'git-navigation-surface' : ''}`}>
          {view === 'history' && (
            <div className="git-skeleton-file-header">
              <Bar width="32%" />
              <Bar width="96px" />
            </div>
          )}
          <DiffSkeleton layout="split" />
        </div>
        {view === 'changes' && (
          <>
            <div className="git-skeleton-file-header">
              <Bar width="40%" />
              <Bar width="96px" />
            </div>
            <DiffSkeleton layout="split" />
          </>
        )}
      </div>
    </div>
  )
}

export function GitWorkspaceLoading({
  view = 'changes',
  navigation,
  navigationTabs,
}: {
  view?: 'changes' | 'history'
  navigation?: ReactNode
  navigationTabs?: ReactNode
}) {
  return (
    <GitNavigationSplit
      id={view}
      navigation={
        <div className="git-history-navigation">
          {navigation}
          {navigation || navigationTabs ? (
            <div className="git-navigation-surface git-loading-navigation">
              {navigationTabs}
              <GitNavigationSkeleton />
            </div>
          ) : (
            <GitNavigationSkeleton context />
          )}
        </div>
      }
    >
      <div className={`git-review-surface ${view === 'history' ? 'git-history-surface' : ''}`}>
        <GitReviewSkeleton view={view} />
      </div>
    </GitNavigationSplit>
  )
}

/** Small route fallback; importing it never loads the diff engine or history graph. */
export function GitPageSkeleton() {
  const t = useT()
  return (
    <div className="git-page">
      <header className="git-workspace-header">
        <h1>{t('source.workspace')}</h1>
        <div className="git-workspace-tools" aria-hidden="true">
          <Bar width="160px" />
          <Bar width="48px" />
          <Bar width="48px" />
        </div>
      </header>
      <GitNavigationLayoutProvider>
        <div className="git-page-body">
          <div className="git-view-pane">
            <GitWorkspaceLoading
              navigationTabs={
                <div className="git-view-nav git-skeleton-tabs" aria-hidden="true">
                  <Bar />
                  <Bar />
                </div>
              }
            />
          </div>
        </div>
      </GitNavigationLayoutProvider>
    </div>
  )
}
