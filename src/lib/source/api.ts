import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '../../store/workspace'
import {
  mockCommit,
  mockCommitBranch,
  mockDiff,
  mockList,
  mockLog,
  mockRead,
  mockRestore,
  mockSearch,
  mockStatus,
} from './mock'

export type {
  CommitFile,
  DirectoryEntry,
  DirectoryListing,
  GitCommit,
  GitCommitDetail,
  GitDiff,
  GitFileStatus,
  GitLog,
  GitStatus,
  ProjectFileContent,
  ProjectSearch,
} from './types'

async function call<T>(
  command: string,
  args: Record<string, unknown>,
  preview: () => T,
): Promise<T> {
  if (!isDesktop) return preview()
  return invoke<T>(command, args)
}

export function listProjectDirectory(path: string, relative = '') {
  return call('list_project_directory', { path, relative }, () => mockList(path, relative))
}

export function readProjectFile(path: string, relative: string) {
  return call('read_project_file', { path, relative }, () => mockRead(path, relative))
}

export function searchProjectFiles(path: string) {
  return call('search_project_files', { path }, () => mockSearch(path))
}

export function gitStatus(path: string) {
  return call('git_status', { path }, () => mockStatus(path))
}

export function gitFileDiff(path: string, relative: string, revision?: string | null) {
  return call('git_file_diff', { path, relative, revision: revision ?? null }, () =>
    mockDiff(path, relative, revision),
  )
}

export function gitLog(path: string, relative?: string | null) {
  return call('git_log', { path, relative: relative || null, limit: 200 }, () =>
    mockLog(path, relative),
  )
}

export function gitCommitBranch(path: string, branch: string, message: string, files: string[]) {
  return call('git_commit_branch', { path, branch, message, files }, () => {
    mockCommitBranch(path, branch, message, files)
  })
}

export function gitRestoreFile(path: string, relative: string) {
  return call('git_restore_file', { path, relative }, () => {
    mockRestore(path, relative)
  })
}

export function gitCommitFiles(path: string, revision: string) {
  return call('git_commit_files', { path, revision }, () => mockCommit(path, revision))
}

export function gitBranches(path: string) {
  return call<import('./types').GitBranch[]>('git_branches', { path }, () => {
    const log = mockLog(path)
    return log.commits.flatMap((commit) =>
      commit.refs
        .split(',')
        .map((ref) => ref.trim())
        .filter((ref) => ref && !ref.startsWith('tag:'))
        .map((ref) => ({
          name: ref.replace(/^HEAD -> /, ''),
          tip: commit.hash,
          remote: ref.startsWith('origin/'),
          current: ref.startsWith('HEAD -> '),
        })),
    )
  })
}

export function gitLogPage(path: string, relative: string | null, tip: string | null, skip = 0) {
  return call<import('./types').GitLogPage>('git_log_page', { path, relative, tip, skip }, () => {
    const log = mockLog(path, relative)
    const byHash = new Map(log.commits.map((commit) => [commit.hash, commit]))
    const reachable = new Set<string>()
    const pending = tip ? [tip] : []
    while (pending.length) {
      const hash = pending.pop()!
      if (reachable.has(hash)) continue
      reachable.add(hash)
      pending.push(...(byHash.get(hash)?.parents ?? []))
    }
    const commits = tip ? log.commits.filter((commit) => reachable.has(commit.hash)) : log.commits
    return {
      ...log,
      commits: commits.slice(skip, skip + 200),
      hasMore: commits.length > skip + 200,
    }
  })
}

export function gitBranchState(path: string) {
  return call<import('./branches').BranchState>('git_branch_state', { path }, () => {
    const status = mockStatus(path)
    const head = mockLog(path).commits[0]?.hash ?? null
    return { current: status.branch, head, operation: null, dirty: status.files.length > 0 }
  })
}

export function gitBranchAction(path: string, request: import('./branches').BranchRequest) {
  return call<void>('git_branch_action', { path, request }, () => {
    throw new Error('Branch operations require the desktop app')
  })
}
