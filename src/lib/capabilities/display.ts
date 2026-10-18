import type { Capability } from './types'
import type { Translator } from '../locale'

export function capabilitySource(item: Capability, t: Translator) {
  if (!item.target) return t(item.builtin ? 'capability.builtin' : 'capability.user')
  const origin = item.target.origin
  const packageName = /node_modules\/(?:@([^/]+)\/)?([^/]+)/.exec(origin)
  return packageName
    ? `${packageName[1] ? `@${packageName[1]}/` : ''}${packageName[2]}`
    : origin.split(/[\\/]/).filter(Boolean).at(-1) || item.target.source
}

export function matchesCapability(item: Capability, search: string) {
  const text =
    `${item.name} ${item.description} /${item.alias} ${item.target?.origin || ''} ${item.target?.name || ''}`.toLocaleLowerCase()
  return search
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word))
}
