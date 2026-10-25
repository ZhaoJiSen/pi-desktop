import { useEffect, useRef, useState } from 'react'
import { gitStatus } from '../../lib/source/api'
import type { GitStatus } from '../../lib/source/types'
import { useSourceQuery } from './useSourceQuery'

/** External editors do not emit Pi events; refresh on return and while visible. */
export function useGitStatus(projectPath: string | null, refresh: string) {
  const [revision, setRevision] = useState(0)
  const previous = useRef<{ path: string; data: GitStatus } | null>(null)
  useEffect(() => {
    if (!projectPath) return
    const update = () => {
      if (document.visibilityState !== 'hidden') setRevision((value) => value + 1)
    }
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(update, 15000)
    return () => {
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
      window.clearInterval(timer)
    }
  }, [projectPath])
  const status = useSourceQuery(
    projectPath ? `status:${projectPath}` : null,
    async () => {
      const next = await gitStatus(projectPath!)
      const old = previous.current
      // Keep list measurements and navigation position when only file contents changed.
      if (old?.path === projectPath && JSON.stringify(old.data) === JSON.stringify(next))
        return old.data
      previous.current = { path: projectPath!, data: next }
      return next
    },
    `${refresh}:${revision}`,
  )
  return { ...status, revision }
}
