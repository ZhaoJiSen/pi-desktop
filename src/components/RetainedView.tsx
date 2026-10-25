import { Activity, useState, type ReactNode } from 'react'

// Mount on first visit, then preserve local state while hidden effects are paused.
export function RetainedView({ active, children }: { active: boolean; children: ReactNode }) {
  const [visited, setVisited] = useState(active)
  if (active && !visited) setVisited(true)
  return visited ? <Activity mode={active ? 'visible' : 'hidden'}>{children}</Activity> : null
}
