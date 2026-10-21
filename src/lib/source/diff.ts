import type { DiffLine } from '../../types'

function binaryHeader(text: string) {
  return text.split('\n').some((line) => {
    return (
      (line.startsWith('Binary files ') && line.endsWith(' differ')) ||
      line.startsWith('GIT binary patch')
    )
  })
}

/** Git's own binary notice. A changed line that only mentions the phrase stays text. */
export function isBinaryPatch(text: string) {
  return binaryHeader(text)
}

export function countPatch(text: string) {
  let additions = 0
  let deletions = 0
  for (const line of text.split('\n')) {
    if (
      line.startsWith('diff --git ') ||
      line.startsWith('index ') ||
      line.startsWith('--- ') ||
      line.startsWith('+++ ') ||
      line.startsWith('\\')
    ) {
      continue
    }
    if (line.startsWith('+')) additions += 1
    else if (line.startsWith('-')) deletions += 1
  }
  return { additions, deletions }
}

/** Git-diff-view parses a complete unified patch, including the file headers. */
export function ensureUnifiedPatch(path: string, text: string) {
  if (text.includes('diff --git ') || text.startsWith('--- ')) return text
  return `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n${text.replace(/^\n/, '')}`
}

/** Tool cards store `+123` rows, not a unified diff. One hunk is enough for the viewer. */
export function toolDiffToUnified(path: string, lines: DiffLine[]) {
  const oldLines = lines.filter((line) => line.kind !== 'add')
  const newLines = lines.filter((line) => line.kind !== 'remove')
  const oldStart = oldLines.find((line) => line.number)?.number ?? (oldLines.length ? 1 : 0)
  const newStart = newLines.find((line) => line.number)?.number ?? (newLines.length ? 1 : 0)
  const body = lines
    .map((line) => `${line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}${line.text}`)
    .join('\n')
  return ensureUnifiedPatch(
    path,
    `@@ -${oldStart},${oldLines.length} +${newStart},${newLines.length} @@\n${body}\n`,
  )
}
