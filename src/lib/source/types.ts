export interface DirectoryEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'link'
}

export interface DirectoryListing {
  entries: DirectoryEntry[]
  truncated: boolean
  ignorePartial: boolean
}

export interface ProjectFileContent {
  path: string
  binary: boolean
  truncated: boolean
  size: number
  text: string
}

export interface ProjectSearch {
  files: string[]
  truncated: boolean
}

export interface GitFileStatus {
  path: string
  code: string
  staged: boolean
  unstaged: boolean
  additions?: number
  deletions?: number
  oldPath?: string
}

export interface GitStatus {
  available: boolean
  repo: boolean
  branch: string | null
  files: GitFileStatus[]
  truncated: boolean
}

export interface GitDiff {
  available: boolean
  repo: boolean
  path: string
  binary: boolean
  truncated: boolean
  missing: boolean
  text: string
}

export interface GitCommit {
  hash: string
  parents: string[]
  author: string
  timestamp: number
  refs: string
  subject: string
}

export interface GitLog {
  available: boolean
  repo: boolean
  commits: GitCommit[]
}

export interface CommitFile {
  path: string
  code: string
  oldPath?: string
}

export interface GitCommitDetail {
  available: boolean
  repo: boolean
  hash: string
  files: CommitFile[]
}

export interface GitBranch {
  name: string
  tip: string
  remote: boolean
  current: boolean
}
export interface GitLogPage extends GitLog {
  hasMore: boolean
}

export interface GitSyncState {
  branch: import('./branches').BranchState
  remote: string | null
  upstream: string | null
  ahead: number
  behind: number
  lastFetch: number | null
  conflicts: string[]
}
export type GitSyncAction = 'fetch' | 'pull' | 'resolve' | 'continue' | 'abort'
export type GitPullMode = 'ffOnly' | 'merge' | 'rebase'
export interface GitSyncRequest {
  action: GitSyncAction
  mode?: GitPullMode
  relative?: string
  expectedHead: string | null
  expectedBranch: string | null
  expectedUpstream: string | null
}

export interface GitHeadLocation {
  head: string | null
  offset: number
  page: GitLogPage
}
