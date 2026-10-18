import { previousBuiltinPrompts, previousBuiltinDescriptions } from './previousPrompts'
import type { DiscoverableCommand } from '../commands'
import type { Translator } from '../locale'
import { commandOrigin } from '../draft'
import type { Capability, CapabilityPreferences } from './types'
export const isPlanCapability = (capability?: Capability) =>
  capability?.builtin === 'plan' || capability?.readOnly === true

export function defaultCapabilities(t: Translator): Capability[] {
  return (['review', 'commit', 'plan', 'explain', 'tests'] as const).map((id) => ({
    id: `builtin:${id}`,
    builtin: id,
    name: t(`composer.prompt.${id}`),
    description: t(`capability.description.${id}`),
    icon: id,
    alias: id,
    prompt: t(`composer.prompt.${id}.text`),
    scope: id === 'plan' ? 'session' : 'once',
    enabled: true,
    pinned: id === 'review' || id === 'commit',
    modifies: id === 'tests',
  }))
}
export function resolveCapabilities(
  preferences: CapabilityPreferences,
  commands: DiscoverableCommand[],
  t: Translator,
) {
  const defaults = defaultCapabilities(t)
  const saved = preferences.items
  const legacyNames: Record<string, string[]> = {
    review: ['审查改动'],
    plan: ['先做计划', 'Plan first'],
    explain: ['解释代码'],
    tests: ['补充测试'],
  }
  const items = (saved.length ? saved : defaults).map((item) => {
    if (!item.builtin) return item
    const original = defaults.find((value) => value.builtin === item.builtin)!
    return {
      ...item,
      name: legacyNames[item.builtin]?.includes(item.name) ? original.name : item.name,
      prompt: previousBuiltinPrompts[item.builtin]?.includes(item.prompt)
        ? original.prompt
        : item.prompt,
      description: previousBuiltinDescriptions[item.builtin]?.includes(item.description)
        ? original.description
        : item.description,
    }
  })
  const dynamic: Capability[] = commands
    .filter((c) => c.source !== 'builtin' && !c.name.startsWith('desktop-bridge'))
    .map((c) => ({
      id: `runtime:${c.source}:${commandOrigin(c)}:${c.name}`,
      name: c.name === 'review-loop' ? t('capability.reviewLoop') : c.name,
      description: c.description || '',
      icon: 'workflow',
      alias: c.name,
      prompt: '',
      scope: 'once',
      enabled: true,
      pinned: false,
      target: {
        name: c.name,
        source: c.source as 'prompt' | 'extension' | 'skill',
        origin: commandOrigin(c),
      },
      modifies: true,
    }))
  return [...items, ...dynamic.filter((c) => !items.some((item) => item.id === c.id))]
}
export function capabilityAvailable(capability: Capability, commands: DiscoverableCommand[]) {
  const target = capability.target
  if (!target) return true
  // Same precedence as Pi. Selecting a shadowed resource must not invoke a different one.
  const matches = commands.filter((c) => c.name === target.name)
  const effective =
    matches.find((c) => c.source === 'extension') ||
    (target.name.startsWith('skill:') && matches.find((c) => c.source === 'skill')) ||
    matches.find((c) => c.source === 'prompt')
  return effective?.source === target.source && commandOrigin(effective) === target.origin
}
export function validateCapability(
  value: Capability,
  items: Capability[],
  reservedAliases: string[] = [],
) {
  if (!value.name.trim() || value.name.length > 80) return 'name'
  if (!/^[\w:.-]+$/.test(value.alias) || value.alias.startsWith('desktop-bridge')) return 'alias'
  if (
    (['model', 'thinking', 'settings', 'session', 'compact'].includes(value.alias) ||
      reservedAliases.includes(value.alias)) &&
    !(value.target && value.alias === value.target.name)
  )
    return 'duplicate'
  if (
    items.some(
      (item) =>
        item.id !== value.id &&
        item.alias === value.alias &&
        !(
          item.target &&
          item.alias === item.target.name &&
          (value.builtin || (value.target && value.alias === value.target.name))
        ) &&
        !(value.target && value.alias === value.target.name && item.builtin),
    )
  )
    return 'duplicate'
  if (!value.target && !value.prompt.trim()) return 'prompt'
  return ''
}
