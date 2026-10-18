import dynamicIconImports from 'lucide-react/dynamicIconImports'

export type LucideName = keyof typeof dynamicIconImports
export const legacyIcons = {
  review: 'scan-search',
  commit: 'git-commit-horizontal',
  plan: 'list-checks',
  explain: 'file-text',
  tests: 'test-tube',
  workflow: 'workflow',
} as const
export type CapabilityIconName = keyof typeof legacyIcons | `lucide:${LucideName}`
export const lucideNames = Object.keys(dynamicIconImports) as LucideName[]
export function lucideName(value: string): LucideName {
  if (Object.hasOwn(legacyIcons, value)) return legacyIcons[value as keyof typeof legacyIcons]
  const name = value.startsWith('lucide:') ? value.slice(7) : ''
  return Object.hasOwn(dynamicIconImports, name) ? (name as LucideName) : 'workflow'
}
export function normalizeCapabilityIcon(value: unknown): CapabilityIconName {
  if (typeof value !== 'string') return 'workflow'
  return Object.hasOwn(legacyIcons, value) ||
    (value.startsWith('lucide:') && Object.hasOwn(dynamicIconImports, value.slice(7)))
    ? (value as CapabilityIconName)
    : 'workflow'
}
