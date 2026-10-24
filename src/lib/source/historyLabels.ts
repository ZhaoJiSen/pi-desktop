export const commitKinds = [
  'feat',
  'fix',
  'docs',
  'refactor',
  'perf',
  'test',
  'style',
  'chore',
  'build',
  'ci',
  'revert',
  'release',
] as const
export type CommitKind = (typeof commitKinds)[number]
export type HistoryKind = 'branch' | 'tag' | CommitKind
const known = new Set<HistoryKind>(commitKinds)

export function branchKind(name: string): HistoryKind {
  const prefix = name
    .match(
      /(?:^|[/@])(feature|hotfix|feat|fix|docs|refactor|perf|test|style|chore|build|ci|revert|release)(?=[/_.-]|$)/i,
    )?.[1]
    ?.toLowerCase()
  if (prefix === 'feature') return 'feat'
  if (prefix === 'hotfix') return 'fix'
  return prefix && known.has(prefix as HistoryKind) ? (prefix as HistoryKind) : 'branch'
}

export function historyReferences(refs: string) {
  return refs
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const tag = /^tag:\s*/.test(raw) || raw.startsWith('refs/tags/')
      const current = raw.startsWith('HEAD -> ')
      const label = raw.replace(/^(?:tag:\s*|refs\/tags\/|HEAD -> )/, '')
      return { label, current, kind: tag ? ('tag' as const) : branchKind(label), raw }
    })
}

export function commitLabel(subject: string) {
  const match = subject.match(
    /^((feat|fix|docs|refactor|perf|test|style|chore|build|ci|revert|release)[^\S\r\n]*(?:\([^)]*\)[^\S\r\n]*)?!?[^\S\r\n]*[:：][^\S\r\n]*)([\s\S]*)$/i,
  )
  return match
    ? { kind: match[2]!.toLowerCase() as HistoryKind, prefix: match[1]!, message: match[3]! }
    : { kind: 'branch' as const, prefix: '', message: subject }
}
