export const modelKey = (model: { provider: string; id: string }) => `${model.provider}/${model.id}`
export const shortPath = (path: string) =>
  path.replace(/^\/Users\/[^/]+/, '~').replace(/^\/home\/[^/]+/, '~')
export const fileName = (path: string) => path.split(/[\\/]/).filter(Boolean).at(-1) || path
export const tokens = (value: number) =>
  value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value)
export const cost = (value: number) => `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
export const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
export const string = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback
export const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0
export const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
export const messageText = (blocks: { type: string; text?: string }[]) =>
  blocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text || '')
    .join('\n\n')
export const errorText = (error: unknown) =>
  error instanceof Error ? error.message : String(error)
