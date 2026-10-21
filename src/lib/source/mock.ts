import { desktop, type MockFile, type MockRepo } from './mockDesktop'
import type {
  DirectoryEntry,
  DirectoryListing,
  GitCommitDetail,
  GitDiff,
  GitLog,
  GitStatus,
  ProjectFileContent,
  ProjectSearch,
} from './types'

const studio: MockRepo = {
  repo: true,
  branch: 'main',
  files: [
    { path: 'index.html', text: '<!doctype html>\n<title>Studio</title>\n' },
    {
      path: 'src/App.tsx',
      text: 'export function App() {\n  return <main>Studio</main>\n}\n',
    },
  ],
  status: [{ path: 'src/App.tsx', code: 'M', staged: false, unstaged: true }],
  diffs: {
    'src/App.tsx': `diff --git a/src/App.tsx b/src/App.tsx
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,3 +1,3 @@
 export function App() {
-  return <main />
+  return <main>Studio</main>
 }
`,
  },
  commits: [
    {
      hash: '9ab12cd034567890abcdef1234567890',
      parents: [],
      author: 'Ari Novak',
      timestamp: 1760400000,
      refs: 'HEAD -> main',
      subject: 'Start the studio shell',
    },
  ],
  commitFiles: {
    '9ab12cd034567890abcdef1234567890': [{ path: 'index.html', code: 'A' }],
  },
  commitDiffs: {},
}

const plain: MockRepo = {
  repo: false,
  branch: null,
  files: [
    { path: 'notes.md', text: '# Notes\n\nScratch space, not a repository.\n' },
    { path: 'src/index.ts', text: 'export const ready = false\n' },
  ],
  status: [],
  diffs: {},
  commits: [],
  commitFiles: {},
  commitDiffs: {},
}

function repoFor(path: string): MockRepo {
  if (path.includes('agent-tools')) return plain
  if (path.includes('web-studio')) return studio
  return desktop
}

function childEntries(files: MockFile[], relative: string): DirectoryEntry[] {
  const prefix = relative ? `${relative}/` : ''
  const children = new Map<string, DirectoryEntry>()
  for (const file of files) {
    if (relative && file.path !== relative && !file.path.startsWith(prefix)) continue
    const rest = file.path.slice(prefix.length)
    if (!rest) continue
    const [name, ...more] = rest.split('/')
    if (!name) continue
    const path = prefix + name
    const kind = more.length ? 'dir' : 'file'
    const existing = children.get(name)
    if (!existing || kind === 'dir') children.set(name, { name, path, kind })
  }
  return [...children.values()].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'dir' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
}

export function mockList(path: string, relative: string): DirectoryListing {
  return { entries: childEntries(repoFor(path).files, relative), truncated: false }
}

export function mockRead(path: string, relative: string): ProjectFileContent {
  const file = repoFor(path).files.find((item) => item.path === relative)
  if (!file) throw new Error('Could not read the project file')
  if (file.binary) return { path: relative, binary: true, truncated: false, size: 48211, text: '' }
  const text = file.text ?? ''
  return { path: relative, binary: false, truncated: false, size: text.length, text }
}

export function mockSearch(path: string): ProjectSearch {
  return { files: repoFor(path).files.map((file) => file.path), truncated: false }
}

export function mockStatus(path: string): GitStatus {
  const repo = repoFor(path)
  return {
    available: true,
    repo: repo.repo,
    branch: repo.branch,
    files: repo.status,
    truncated: false,
  }
}

export function mockDiff(path: string, relative: string, revision?: string | null): GitDiff {
  const repo = repoFor(path)
  if (!repo.repo) {
    return {
      available: true,
      repo: false,
      path: relative,
      binary: false,
      truncated: false,
      missing: true,
      text: '',
    }
  }
  const text = revision ? repo.commitDiffs[`${revision}:${relative}`] : repo.diffs[relative]
  if (!text) {
    return {
      available: true,
      repo: true,
      path: relative,
      binary: false,
      truncated: false,
      missing: true,
      text: '',
    }
  }
  if (relative.endsWith('.png')) {
    return {
      available: true,
      repo: true,
      path: relative,
      binary: true,
      truncated: false,
      missing: false,
      text: '',
    }
  }
  return {
    available: true,
    repo: true,
    path: relative,
    binary: false,
    truncated: false,
    missing: false,
    text,
  }
}

export function mockLog(path: string, relative?: string | null): GitLog {
  const repo = repoFor(path)
  if (!repo.repo) return { available: true, repo: false, commits: [] }
  if (!relative) return { available: true, repo: true, commits: repo.commits }
  const commits = repo.commits.filter((commit) =>
    (repo.commitFiles[commit.hash] ?? []).some((file) => file.path === relative),
  )
  return { available: true, repo: true, commits }
}

export function mockCommit(path: string, revision: string): GitCommitDetail {
  const repo = repoFor(path)
  return {
    available: true,
    repo: repo.repo,
    hash: revision,
    files: repo.commitFiles[revision] ?? [],
  }
}
