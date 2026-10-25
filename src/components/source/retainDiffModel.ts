import type { DiffFile } from '@git-diff-view/react'

export function retainDiffModel(view: { getDiffFileInstance: () => DiffFile | null } | null) {
  const file = view?.getDiffFileInstance()
  if (!file) return
  // Production DiffView clears memoized rows on effect cleanup, including an
  // Activity hide. Use its StrictMode-safe disposal: release IDs/listeners,
  // retain rows for resumption, then let GC collect them on actual unmount.
  file.clear = file._destroy
}
