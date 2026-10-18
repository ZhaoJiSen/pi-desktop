import type { MessageKey } from './locale'
import type { Model, ThinkingLevel } from '../types'

export const thinkingLabel = {
  off: 'thinking.off',
  minimal: 'thinking.minimal',
  low: 'thinking.low',
  medium: 'thinking.medium',
  high: 'thinking.high',
  xhigh: 'thinking.xhigh',
  max: 'thinking.max',
} as const satisfies Record<ThinkingLevel, MessageKey>

export const orderedThinkingLevels = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const

// Mirrors Pi's catalog metadata for browser previews. Desktop availability
// always comes from get_available_thinking_levels on the selected runtime model.
export function modelThinkingLevels(model?: Model): ThinkingLevel[] {
  if (!model?.reasoning) return ['off']
  return orderedThinkingLevels.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level]
    if (mapped === null) return false
    return level === 'xhigh' || level === 'max' ? mapped !== undefined : true
  })
}

export function defaultThinkingLevel(levels: ThinkingLevel[]): ThinkingLevel {
  if (levels.includes('medium')) return 'medium'
  // Match Pi's clamp: next supported higher level, then a lower one.
  const available = orderedThinkingLevels.filter((level) => levels.includes(level))
  return (
    available.find((level) => orderedThinkingLevels.indexOf(level) > 3) ?? available.at(-1) ?? 'off'
  )
}
