import type { Session } from '../../types'

export const parts = ['input', 'output', 'cacheRead', 'cacheWrite'] as const
export const money = (value: number) =>
  value > 0 && value < 0.0001 ? '< $0.0001' : `$${value.toFixed(value > 0 && value < 0.01 ? 4 : 2)}`
export const hasUsage = (session: Session) =>
  session.usage.total > 0 || session.usage.cost > 0 || parts.some((key) => session.usage[key] > 0)
export const hasActivity = (session: Session) => session.messages.length > 0 || hasUsage(session)
