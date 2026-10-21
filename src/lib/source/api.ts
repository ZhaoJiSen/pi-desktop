import { invoke } from '@tauri-apps/api/core'
import { isDesktop } from '../../store/workspace'
import { mockCommit, mockDiff, mockList, mockLog, mockRead, mockSearch, mockStatus } from './mock'

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

export function gitCommitFiles(path: string, revision: string) {
  return call('git_commit_files', { path, revision }, () => mockCommit(path, revision))
}
