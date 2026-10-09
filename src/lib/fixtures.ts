import type { Model, Project, Session, Usage } from '../types'

export const emptyUsage: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0, contextPercent: null, contextTokens: null, contextWindow: null }
export const previewModels: Model[] = [
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'anthropic', reasoning: true, contextWindow: 200000 },
  { id: 'claude-opus', name: 'Claude Opus', provider: 'anthropic', reasoning: true, contextWindow: 200000 },
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', reasoning: true, contextWindow: 400000 },
  { id: 'gemini-pro', name: 'Gemini Pro', provider: 'google', reasoning: true, contextWindow: 1000000 },
]
export const previewProjects: Project[] = [
  { id: 'pi-desktop', name: 'pi-desktop', path: '~/Projects/pi-desktop', branch: 'main', collapsed: false },
  { id: 'web-studio', name: 'web-studio', path: '~/Projects/web-studio', branch: 'main', collapsed: false },
  { id: 'agent-tools', name: 'agent-tools', path: '~/Projects/agent-tools', branch: 'develop', collapsed: true },
]
const date = Date.UTC(2026, 9, 8)
export const makeSession = (projectId: string, title = ''): Session => ({
  id: crypto.randomUUID(), projectId, title, updatedAt: Date.now(), modelKey: '', thinking: 'medium', messages: [], draft: '', usage: { ...emptyUsage },
})
const fixtureSession = (id: string, projectId: string, title: string, day: number): Session => ({ ...makeSession(projectId, title), id, updatedAt: date - (8 - day) * 86400000, modelKey: 'anthropic/claude-sonnet' })
export function createPreviewSessions(): Session[] {
  const first = fixtureSession('model-selector', 'pi-desktop', '模型选择器交互优化', 8)
  first.usage = { input: 9000, output: 1800, cacheRead: 2000, cacheWrite: 0, total: 12800, cost: .06, contextPercent: 18, contextTokens: 36000, contextWindow: 200000 }
  first.messages = [
    { id: 'user-intro', role: 'user', timestamp: date, blocks: [{ type: 'text', text: '让模型切换更快，支持搜索和最近使用。' }] },
    { id: 'assistant-intro', role: 'assistant', timestamp: date + 1000, blocks: [
      { type: 'text', text: '我会把模型选择收进输入区，并保留你的最近选择。' },
      { type: 'tool', id: 'read-models', name: 'read', label: 'models.ts', args: { path: 'src/models.ts' }, status: 'done', output: 'export const models = availableModels\nexport type ModelKey = `${string}/${string}`' },
      { type: 'tool', id: 'edit-selector', name: 'edit', label: 'model-selector.tsx', args: { path: 'src/components/model-selector.tsx' }, status: 'done', output: '搜索名称、提供商或模型 ID。最近使用会显示在最上方。', diff: [
        { number: 112, kind: 'context', text: "const [query, setQuery] = useState('')" },
        { number: 113, kind: 'add', text: 'const filtered = useMemo(() => filterModels(models, query), [models, query])' },
        { number: 114, kind: 'context', text: 'const recent = useRecentModels()' },
        { number: 115, kind: 'add', text: 'return (' },
        { number: 116, kind: 'add', text: '  <div className="model-selector">' },
        { number: 117, kind: 'add', text: '    <SearchInput value={query} onChange={setQuery} placeholder="搜索模型..." />' },
      ] },
      { type: 'text', text: '搜索名称、提供商或模型 ID。最近使用会显示在最上方。' },
    ] },
  ]
  return [first, fixtureSession('files', 'pi-desktop', '添加文件上下文支持', 7), fixtureSession('warnings', 'pi-desktop', '修复构建警告', 6), fixtureSession('settings', 'web-studio', '实现设置页面', 5), fixtureSession('navigation', 'web-studio', '调整导航布局', 4)]
}
