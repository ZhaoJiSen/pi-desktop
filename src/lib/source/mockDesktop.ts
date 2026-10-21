import type { CommitFile, GitCommit, GitFileStatus } from './types'

export interface MockFile {
  path: string
  text?: string
  binary?: boolean
}

export interface MockRepo {
  repo: boolean
  branch: string | null
  files: MockFile[]
  status: GitFileStatus[]
  diffs: Record<string, string>
  commits: GitCommit[]
  commitFiles: Record<string, CommitFile[]>
  commitDiffs: Record<string, string>
}

const selector = `import { useMemo, useState } from 'react'
import { models } from '../models'

export function ModelSelector() {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterModels(models, query), [query])
  const recent = useRecentModels()
  return (
    <div className="model-selector">
      <SearchInput value={query} onChange={setQuery} placeholder="Search models" />
      <RecentModels models={recent} />
      <ModelList models={filtered} />
    </div>
  )
}
`

const selectorDiff = `diff --git a/src/components/model-selector.tsx b/src/components/model-selector.tsx
--- a/src/components/model-selector.tsx
+++ b/src/components/model-selector.tsx
@@ -8,9 +8,14 @@ import { models } from '../models'
 export function ModelSelector() {
-  const [open, setOpen] = useState(false)
+  const [query, setQuery] = useState('')
+  const filtered = useMemo(() => filterModels(models, query), [query])
   const recent = useRecentModels()
   return (
-    <button type="button">Choose model</button>
+    <div className="model-selector">
+      <SearchInput value={query} onChange={setQuery} placeholder="Search models" />
+      <RecentModels models={recent} />
+      <ModelList models={filtered} />
+    </div>
   )
 }
`

const styleDiff = `diff --git a/src/styles/_conversation.scss b/src/styles/_conversation.scss
--- a/src/styles/_conversation.scss
+++ b/src/styles/_conversation.scss
@@ -12,7 +12,8 @@
 .model-selector {
   display: flex;
   flex-direction: column;
-  gap: 8px;
+  gap: 6px;
+  min-width: 280px;
 }
`

const testDiff = `diff --git a/src/components/model-selector.test.tsx b/src/components/model-selector.test.tsx
new file mode 100644
--- /dev/null
+++ b/src/components/model-selector.test.tsx
@@ -0,0 +1,4 @@
+import { filterModels } from './model-selector'
+
+test('matches a provider prefix', () => {
+  expect(filterModels(models, 'anth').map((model) => model.id)).toContain('claude-sonnet')
+})
`

const deletedDiff = `diff --git a/src/legacy/banner.tsx b/src/legacy/banner.tsx
deleted file mode 100644
--- a/src/legacy/banner.tsx
+++ /dev/null
@@ -1,5 +0,0 @@
-export function Banner() {
-  return <p>Model catalog loading…</p>
-}
`

export const desktop: MockRepo = {
  repo: true,
  branch: 'main',
  files: [
    { path: 'readme.md', text: '# pi-desktop\n\nWorkspace for the local coding agent.\n' },
    { path: 'package.json', text: '{\n  "name": "pi-desktop",\n  "private": true\n}\n' },
    { path: 'assets/mark.png', binary: true },
    {
      path: 'src/models.ts',
      text: 'export const models = [\n  { id: "claude-sonnet", provider: "anthropic" },\n  { id: "gpt-5", provider: "openai" },\n]\n',
    },
    { path: 'src/components/model-selector.tsx', text: selector },
    {
      path: 'src/components/model-selector.test.tsx',
      text: "import { filterModels } from './model-selector'\n\ntest('matches a provider prefix', () => {\n  expect(filterModels(models, 'anth').map((model) => model.id)).toContain('claude-sonnet')\n})\n",
    },
    {
      path: 'src/components/Composer.tsx',
      text: 'export function Composer() {\n  return <form className="composer" />\n}\n',
    },
    {
      path: 'src/styles/_conversation.scss',
      text: '.model-selector {\n  display: flex;\n  flex-direction: column;\n  gap: 6px;\n  min-width: 280px;\n}\n',
    },
  ],
  status: [
    { path: 'src/components/model-selector.tsx', code: 'M', staged: false, unstaged: true },
    { path: 'src/styles/_conversation.scss', code: 'M', staged: true, unstaged: false },
    { path: 'src/components/model-selector.test.tsx', code: '?', staged: false, unstaged: true },
    { path: 'src/legacy/banner.tsx', code: 'D', staged: false, unstaged: true },
  ],
  diffs: {
    'src/components/model-selector.tsx': selectorDiff,
    'src/styles/_conversation.scss': styleDiff,
    'src/components/model-selector.test.tsx': testDiff,
    'src/legacy/banner.tsx': deletedDiff,
  },
  commits: [
    {
      hash: 'e7c31ab9f0a14c2d8e1190bb44aa7712',
      parents: ['c4a90d18bb3321aa90ee7712456cd091'],
      author: 'Mina Chen',
      timestamp: 1761004800,
      refs: 'HEAD -> main',
      subject: 'Tighten the model menu spacing',
    },
    {
      hash: 'c4a90d18bb3321aa90ee7712456cd091',
      parents: ['b91ab2204de8819033ac771256700184', 'd30ff1819aa0477211bc903344551902'],
      author: '吉森',
      timestamp: 1760918400,
      refs: '',
      subject: 'Merge model search into the workspace',
    },
    {
      hash: 'b91ab2204de8819033ac771256700184',
      parents: ['a00aa11c55d290187766441290ab3318'],
      author: 'Ari Novak',
      timestamp: 1760745600,
      refs: '',
      subject: 'Remember recently used models',
    },
    {
      hash: 'd30ff1819aa0477211bc903344551902',
      parents: ['a00aa11c55d290187766441290ab3318'],
      author: 'Mina Chen',
      timestamp: 1760659200,
      refs: 'model-search',
      subject: 'Add search to the model selector',
    },
    {
      hash: 'a00aa11c55d290187766441290ab3318',
      parents: [],
      author: '吉森',
      timestamp: 1759104000,
      refs: 'tag: v0.1.0',
      subject: 'Lay out the conversation workspace',
    },
  ],
  commitFiles: {
    e7c31ab9f0a14c2d8e1190bb44aa7712: [{ path: 'src/styles/_conversation.scss', code: 'M' }],
    c4a90d18bb3321aa90ee7712456cd091: [{ path: 'src/components/model-selector.tsx', code: 'A' }],
    b91ab2204de8819033ac771256700184: [{ path: 'src/models.ts', code: 'M' }],
    d30ff1819aa0477211bc903344551902: [{ path: 'src/components/model-selector.tsx', code: 'A' }],
    a00aa11c55d290187766441290ab3318: [
      { path: 'readme.md', code: 'A' },
      { path: 'package.json', code: 'A' },
      { path: 'src/components/Composer.tsx', code: 'A' },
    ],
  },
  commitDiffs: {
    'e7c31ab9f0a14c2d8e1190bb44aa7712:src/styles/_conversation.scss': styleDiff,
    'c4a90d18bb3321aa90ee7712456cd091:src/components/model-selector.tsx': selectorDiff,
    'd30ff1819aa0477211bc903344551902:src/components/model-selector.tsx': selectorDiff,
    'b91ab2204de8819033ac771256700184:src/models.ts': `diff --git a/src/models.ts b/src/models.ts
--- a/src/models.ts
+++ b/src/models.ts
@@ -1,3 +1,4 @@
 export const models = [
   { id: "claude-sonnet", provider: "anthropic" },
+  { id: "gpt-5", provider: "openai" },
 ]
`,
    'a00aa11c55d290187766441290ab3318:readme.md': `diff --git a/readme.md b/readme.md
new file mode 100644
--- /dev/null
+++ b/readme.md
@@ -0,0 +1,3 @@
+# pi-desktop
+
+Workspace for the local coding agent.
`,
  },
}
