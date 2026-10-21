import type { Message, ToolBlock } from '../../types'

const CHANGING_TOOLS = new Set(['edit', 'write', 'apply_patch'])

export function normalizeProjectPath(raw: string, projectPath = ''): string | null {
  let path = raw.trim().replace(/\\/g, '/')
  const root = projectPath.trim().replace(/\\/g, '/').replace(/\/+$/, '')
  if (root && (path === root || path.startsWith(`${root}/`))) {
    path = path.slice(root.length).replace(/^\/+/, '')
  }
  if (!path || path.startsWith('/') || path.startsWith('~/')) return null
  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') return null
    parts.push(part)
  }
  return parts.length ? parts.join('/') : null
}

export function toolFilePath(tool: ToolBlock, projectPath = ''): string | null {
  const raw = tool.args.path ?? tool.args.file_path ?? tool.args.filePath ?? tool.args.file
  return typeof raw === 'string' ? normalizeProjectPath(raw, projectPath) : null
}

export function agentTouchedPaths(messages: Message[], projectPath = ''): Set<string> {
  const paths = new Set<string>()
  for (const message of messages) {
    for (const block of message.blocks) {
      if (block.type !== 'tool' || block.status === 'running') continue
      if (!CHANGING_TOOLS.has(block.name) && !block.diff) continue
      const path = toolFilePath(block, projectPath)
      if (path) paths.add(path)
    }
  }
  return paths
}

export function fileNameOf(path: string) {
  return path.split('/').filter(Boolean).at(-1) || path
}
