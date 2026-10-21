export interface DirectoryEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'link'
}

export interface DirectoryListing {
  entries: DirectoryEntry[]
  truncated: boolean
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
