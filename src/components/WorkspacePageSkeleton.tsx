import { SidebarLayout } from '../layouts/SidebarLayout'
import { useT } from '../lib/i18n'
import type { Page } from '../router/paths'
import { GitPageSkeleton } from './source/GitWorkspaceSkeleton'
import { SettingsPageSkeleton } from './loading/SettingsPageSkeleton'
import { UsagePageSkeleton } from './loading/UsagePageSkeleton'
import { SkeletonBar } from './loading/SkeletonBar'

function LibrarySkeleton({ page }: { page: 'commands' | 'extensions' }) {
  const t = useT()
  const commands = page === 'commands'
  return (
    <div
      className={
        commands ? 'utility-view commands-view library-view' : 'utility-view packages-view'
      }
    >
      <div className={commands ? 'workspace-skeleton-library' : 'package-manager'}>
        <SidebarLayout
          className={commands ? 'commands-workspace library-workspace' : 'package-workspace'}
          collapseAt={780}
          label={t(commands ? 'layout.resizeCommands' : 'layout.resizeExtensions')}
          sidebar={
            <section className={commands ? 'commands-browser library-browser' : 'package-library'}>
              <div className={commands ? 'commands-browser-heading' : 'package-library-heading'}>
                <h2 className={commands ? 'commands-browser-title' : 'package-library-title'}>
                  {t(commands ? 'capability.library' : 'navigation.extensions')}
                </h2>
                <SkeletonBar width="52px" />
              </div>
              <div className={commands ? 'library-filter-row' : 'package-tabs'}>
                <SkeletonBar
                  className="workspace-skeleton-control"
                  width={commands ? '100%' : '45%'}
                />
                <SkeletonBar
                  className="workspace-skeleton-control"
                  width={commands ? '100%' : '45%'}
                />
              </div>
              {commands && (
                <div className="library-status-filters workspace-skeleton-filters">
                  <SkeletonBar width="85%" />
                </div>
              )}
              <div className="workspace-skeleton-rows">
                {[72, 58, 84, 66, 78, 54].map((width) => (
                  <div
                    className={
                      commands ? 'command-row sidebar-option' : 'package-option sidebar-option'
                    }
                    key={width}
                  >
                    <div className="workspace-skeleton-copy">
                      <SkeletonBar width={`${width}%`} />
                      <SkeletonBar width="88%" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          }
        >
          <div className={commands ? 'commands-detail library-detail' : 'package-detail'}>
            <div className="workspace-skeleton-inspector">
              <SkeletonBar width="45%" />
              <SkeletonBar width="70%" />
              <SkeletonBar />
              <SkeletonBar width="86%" />
            </div>
          </div>
        </SidebarLayout>
      </div>
    </div>
  )
}

function ChatSkeleton() {
  return (
    <div className="chat-stage">
      <div className="chat-page">
        <div className="conversation">
          <div className="conversation-content workspace-skeleton-chat">
            <div className="workspace-skeleton-message">
              <SkeletonBar />
              <SkeletonBar width="72%" />
            </div>
            <SkeletonBar width="86%" />
            <SkeletonBar />
            <SkeletonBar width="64%" />
          </div>
        </div>
        <div className="composer-area">
          <div className="workspace-skeleton-composer">
            <SkeletonBar width="64%" />
            <div>
              <SkeletonBar width="100px" />
              <SkeletonBar width="34px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WorkspacePageSkeleton({ page }: { page: Page }) {
  const t = useT()
  return (
    <div
      className="workspace-page-skeleton"
      role="status"
      aria-label={t('source.loading')}
      data-skeleton-page={page}
    >
      <div className="workspace-skeleton-content" aria-hidden="true">
        {page === 'git' ? (
          <GitPageSkeleton />
        ) : page === 'settings' ? (
          <SettingsPageSkeleton />
        ) : page === 'usage' ? (
          <UsagePageSkeleton />
        ) : page === 'chat' ? (
          <ChatSkeleton />
        ) : (
          <LibrarySkeleton page={page} />
        )}
      </div>
    </div>
  )
}
