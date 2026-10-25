import { useLayoutEffect, useState } from 'react'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'
import type { Page } from '../router/paths'
import { WorkspacePageSkeleton } from './WorkspacePageSkeleton'

export function WorkspaceLoadingOverlay({ page, pending }: { page: Page; pending: boolean }) {
  const reduced = useReducedMotionPreference()
  const [held, setHeld] = useState<Page | null>(pending ? page : null)
  // Reset a stale destination before commit, never after painting its title.
  if (pending && held !== page) setHeld(page)
  if (!pending && held !== null && (reduced || held !== page)) setHeld(null)
  const exiting = !pending && !reduced && held === page
  useLayoutEffect(() => {
    if (!exiting) return
    // animationend normally releases the layer. The fallback also handles
    // hidden windows and environments where CSS animation events do not fire.
    const timer = setTimeout(() => setHeld((current) => (current === page ? null : current)), 240)
    return () => clearTimeout(timer)
  }, [exiting, page])
  if (!pending && !exiting) return null
  return (
    <div
      key={page}
      className="workspace-page-loading"
      aria-hidden={exiting || undefined}
      data-exiting={exiting || undefined}
      onAnimationEnd={(event) => {
        if (exiting && event.target === event.currentTarget) setHeld(null)
      }}
    >
      <WorkspacePageSkeleton page={page} />
    </div>
  )
}
