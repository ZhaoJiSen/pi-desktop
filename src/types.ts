export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
export type View = 'chat' | 'usage' | 'extensions' | 'settings'
export type Theme = 'light' | 'dark' | 'system'

export interface Model {
  id: string
  name: string
  provider: string
  reasoning?: boolean
  contextWindow: number
  input?: string[]
}

export interface Project {
  id: string
  name: string
  path: string
  branch: string | null
  collapsed: boolean
  pinned?: boolean
  hidden?: boolean
}

export interface Usage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  total: number
  cost: number
  contextPercent: number | null
  contextTokens: number | null
  contextWindow: number | null
}

export interface DiffLine {
  number?: number
  kind: 'add' | 'remove' | 'context'
  text: string
}
export interface ToolBlock {
  type: 'tool'
  id: string
  name: string
  label: string
  args: Record<string, unknown>
  status: 'running' | 'done' | 'error' | 'interrupted'
  output: string
  diff?: DiffLine[]
}
export type MessageBlock = { type: 'text' | 'thinking'; text: string } | ToolBlock
export interface Message {
  id: string
  role: 'user' | 'assistant'
  blocks: MessageBlock[]
  timestamp: number
  error?: string
  attachments?: string[]
}
export interface Attachment {
  id: string
  name: string
  mimeType: string
  data: string
  kind: 'image' | 'text'
}
export interface Session {
  id: string
  projectId: string
  title: string
  updatedAt: number
  modelKey: string
  thinking: ThinkingLevel
  pinned?: boolean
  piSessionFile?: string
  pendingSessionName?: string
  messages: Message[]
  draft: string
  attachments?: Attachment[]
  usage: Usage
}
export interface SlashCommand {
  name: string
  description?: string
  source: 'extension' | 'prompt' | 'skill'
  sourceInfo?: { path?: string; source?: string; scope?: string }
}
export interface ExtensionPackage {
  source: string
  scope: 'global' | 'project'
  version?: string
  description?: string
}
export interface PiEvent {
  type: string
  [key: string]: unknown
}
export interface RuntimeEvent {
  runId: string
  event: PiEvent
}
export interface RpcState {
  model?: Model
  thinkingLevel: ThinkingLevel
  isStreaming: boolean
  sessionFile?: string
  sessionId: string
  sessionName?: string
}
export interface ExtensionRequest {
  id: string
  method: 'select' | 'confirm' | 'input' | 'editor'
  title: string
  message?: string
  options?: string[]
  placeholder?: string
  prefill?: string
  timeout?: number
}
