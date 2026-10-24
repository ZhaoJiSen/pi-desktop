import type { GitBranch } from './types'

export function branchReference(branch: GitBranch) {
  return `${branch.remote ? 'refs/remotes/' : 'refs/heads/'}${branch.name}`
}

export type BranchAction = 'switch' | 'create' | 'merge' | 'rebase' | 'abortMerge' | 'abortRebase'
export interface BranchState {
  current: string | null
  head: string | null
  operation: 'merge' | 'rebase' | null
  dirty: boolean
}
export interface BranchRequest {
  action: BranchAction
  target: string
  targetTip: string
  name: string
  expectedHead: string | null
  expectedBranch: string | null
}
