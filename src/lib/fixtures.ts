import type { CommandSource, Model, Project, Session, Usage } from '../types'

export const previewCommands: {
  name: string
  description?: string
  source: CommandSource
  argumentHint?: string
  sourceInfo?: { path?: string; source?: string }
}[] = [
  {
    name: 'compact',
    source: 'builtin',
    description: '压缩当前会话的上下文，给后面的对话留出窗口。',
  },
  { name: 'model', source: 'builtin', description: '更换这个会话正在使用的模型。' },
  { name: 'thinking', source: 'builtin', description: '调整下一条回复的推理深度。' },
  { name: 'settings', source: 'builtin', description: '打开桌面端设置。' },
  { name: 'session', source: 'builtin', description: '查看当前会话和全部会话的用量。' },
  { name: 'tree', source: 'builtin', description: '在终端里查看这条会话是怎样分叉的。' },
  { name: 'login', source: 'builtin', description: '登录模型服务。需要在 Pi 终端里完成。' },
  { name: 'name', source: 'builtin', description: '在终端中重命名当前会话。' },
  { name: 'hotkeys', source: 'builtin' },
  {
    name: 'review',
    source: 'extension',
    description: '对照当前改动写一段评审，指出行为、边界和测试上的风险。',
    argumentHint: '[path]',
    sourceInfo: { source: 'npm:pi-review' },
  },
  {
    name: 'visual-diff',
    source: 'extension',
    description: '比较界面改动前后的两张截图，标出错位、裁切和看不清的字。',
    sourceInfo: { source: 'npm:pi-visual-diff' },
  },
  {
    name: 'skill:commit',
    source: 'skill',
    description: '根据已暂存的改动起草提交说明。不会执行 git commit。',
    sourceInfo: { path: '~/.pi/agent/skills/commit/SKILL.md' },
  },
  {
    name: 'plan',
    source: 'prompt',
    description: '先写实现步骤和取舍，确认之后再改代码。',
    argumentHint: '<任务>',
    sourceInfo: { source: 'prompts/plan.md' },
  },
  {
    name: 'explain',
    source: 'prompt',
    description: '沿着调用链说明这段代码为什么这样写，而不是逐行翻译。',
    sourceInfo: { path: '~/Projects/pi-desktop/.pi/prompts/explain.md' },
  },
]

const englishCommandDescriptions: Record<string, string> = {
  compact: 'Compact the current conversation to make room for the next messages.',
  model: 'Change the model used by this conversation.',
  thinking: 'Adjust the reasoning effort for the next response.',
  settings: 'Open Desktop settings.',
  session: 'View usage for this conversation and all sessions.',
  tree: 'Explore conversation branches in the Pi terminal.',
  login: 'Sign in to a model provider in the Pi terminal.',
  name: 'Rename the current conversation in the Pi terminal.',
  review: 'Review changes for behavior, edge cases and missing tests.',
  'visual-diff': 'Compare two interface screenshots for alignment, clipping and readability.',
  'skill:commit': 'Draft a commit message from staged changes without creating a commit.',
  plan: 'Plan the implementation and tradeoffs before changing code.',
  explain: 'Explain the reasons behind this code by following its calls.',
}

export function getPreviewCommands(language: 'zh' | 'en') {
  if (language === 'zh') return previewCommands
  return previewCommands.map((command) => ({
    ...command,
    description: englishCommandDescriptions[command.name],
    argumentHint: command.name === 'plan' ? '<task>' : command.argumentHint,
  }))
}

export const emptyUsage: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  total: 0,
  cost: 0,
  contextPercent: null,
  contextTokens: null,
  contextWindow: null,
}
export const previewModels: Model[] = [
  {
    id: 'claude-sonnet',
    name: 'Claude Sonnet',
    provider: 'anthropic',
    reasoning: true,
    contextWindow: 200000,
  },
  {
    id: 'claude-opus',
    name: 'Claude Opus',
    provider: 'anthropic',
    reasoning: true,
    contextWindow: 200000,
  },
  { id: 'gpt-5', name: 'GPT-5', provider: 'openai', reasoning: true, contextWindow: 400000 },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    reasoning: true,
    contextWindow: 1000000,
  },
]
export const previewProjects: Project[] = [
  {
    id: 'pi-desktop',
    name: 'pi-desktop',
    path: '~/Projects/pi-desktop',
    branch: 'main',
    collapsed: false,
  },
  {
    id: 'web-studio',
    name: 'web-studio',
    path: '~/Projects/web-studio',
    branch: 'main',
    collapsed: false,
  },
  {
    id: 'agent-tools',
    name: 'agent-tools',
    path: '~/Projects/agent-tools',
    branch: 'develop',
    collapsed: true,
  },
]
const date = Date.UTC(2026, 9, 8)
export const makeSession = (projectId: string, title = ''): Session => ({
  id: crypto.randomUUID(),
  projectId,
  title,
  updatedAt: Date.now(),
  modelKey: '',
  thinking: 'medium',
  messages: [],
  draft: '',
  usage: { ...emptyUsage },
})
const fixtureSession = (id: string, projectId: string, title: string, day: number): Session => ({
  ...makeSession(projectId, title),
  id,
  updatedAt: date - (8 - day) * 86400000,
  modelKey: 'anthropic/claude-sonnet',
})
export function createPreviewSessions(): Session[] {
  const first = fixtureSession('model-selector', 'pi-desktop', '模型选择器交互优化', 8)
  first.usage = {
    input: 9000,
    output: 1800,
    cacheRead: 2000,
    cacheWrite: 0,
    total: 12800,
    cost: 0.06,
    contextPercent: 18,
    contextTokens: 36000,
    contextWindow: 200000,
  }
  first.messages = [
    {
      id: 'user-intro',
      role: 'user',
      timestamp: date,
      blocks: [{ type: 'text', text: '让模型切换更快，支持搜索和最近使用。' }],
    },
    {
      id: 'assistant-intro',
      role: 'assistant',
      timestamp: date + 1000,
      blocks: [
        { type: 'text', text: '我会把模型选择收进输入区，并保留你的最近选择。' },
        {
          type: 'tool',
          id: 'read-models',
          name: 'read',
          label: 'models.ts',
          args: { path: 'src/models.ts' },
          status: 'done',
          output:
            'export const models = availableModels\nexport type ModelKey = `${string}/${string}`',
        },
        {
          type: 'tool',
          id: 'edit-selector',
          name: 'edit',
          label: 'model-selector.tsx',
          args: { path: 'src/components/model-selector.tsx' },
          status: 'done',
          output: '搜索名称、提供商或模型 ID。最近使用会显示在最上方。',
          diff: [
            { number: 112, kind: 'context', text: "const [query, setQuery] = useState('')" },
            {
              number: 113,
              kind: 'add',
              text: 'const filtered = useMemo(() => filterModels(models, query), [models, query])',
            },
            { number: 114, kind: 'context', text: 'const recent = useRecentModels()' },
            { number: 115, kind: 'add', text: 'return (' },
            { number: 116, kind: 'add', text: '  <div className="model-selector">' },
            {
              number: 117,
              kind: 'add',
              text: '    <SearchInput value={query} onChange={setQuery} placeholder="搜索模型..." />',
            },
          ],
        },
        { type: 'text', text: '搜索名称、提供商或模型 ID。最近使用会显示在最上方。' },
      ],
    },
  ]
  return [
    first,
    fixtureSession('files', 'pi-desktop', '添加文件上下文支持', 7),
    fixtureSession('warnings', 'pi-desktop', '修复构建警告', 6),
    fixtureSession('settings', 'web-studio', '实现设置页面', 5),
    fixtureSession('navigation', 'web-studio', '调整导航布局', 4),
  ]
}
