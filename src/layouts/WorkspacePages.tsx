import { Outlet } from '@tanstack/react-router'
import { Activity, memo, Suspense, type ReactNode } from 'react'
import { RetainedView } from '../components/RetainedView'
import { ChatPage, GitPage, SettingsPage, UsagePage } from '../router/pageComponents'
import type { Page } from '../router/paths'
import { usePaneTransition } from '../hooks/usePaneTransition'
import { usePreparedPage } from '../hooks/usePreparedPage'
import { WorkspacePageSkeleton } from '../components/WorkspacePageSkeleton'
import { WorkspaceLoadingOverlay } from '../components/WorkspaceLoadingOverlay'
import { WorkspacePageTitle } from '../components/WorkspacePageTitle'

const Chat = memo(ChatPage)
const Settings = memo(SettingsPage)
const Git = memo(GitPage)
const Usage = memo(UsagePage)

function PagePane({ page, children }: { page: Page; children: ReactNode }) {
  const ref = usePaneTransition(page, { reveal: true })
  return (
    <div ref={ref} className="retained-page" data-page={page}>
      {children}
    </div>
  )
}

export function WorkspacePages({ page }: { page: Page }) {
  const prepared = usePreparedPage(page)
  const pending = prepared !== page
  return (
    <div
      className="workspace-pages"
      data-page={page}
      aria-busy={pending || undefined}
      data-pending-page={pending ? page : undefined}
    >
      <WorkspacePageTitle page={page} />
      <div className="workspace-page-content" inert={pending || undefined}>
        <Suspense fallback={<WorkspacePageSkeleton page={page} />}>
          <RetainedView active={prepared === 'chat'}>
            <PagePane page="chat">
              <Chat />
            </PagePane>
          </RetainedView>
          <RetainedView active={prepared === 'settings'}>
            <PagePane page="settings">
              <Settings />
            </PagePane>
          </RetainedView>
          <RetainedView active={prepared === 'git'}>
            <PagePane page="git">
              <Git />
            </PagePane>
          </RetainedView>
          <RetainedView active={prepared === 'usage'}>
            <PagePane page="usage">
              <Usage />
            </PagePane>
          </RetainedView>
          <Activity mode={pending ? 'hidden' : 'visible'}>
            <Outlet />
          </Activity>
        </Suspense>
      </div>
      <WorkspaceLoadingOverlay page={page} pending={pending} />
    </div>
  )
}
