import type { Session } from '../../types'

export interface UsageDay {
  timestamp: number
  total: number
  cost: number
  messages: number
}

export interface UsageYearDay extends UsageDay {
  future: boolean
}

const midnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Bucket actual message timestamps; updatedAt is never a usage-event timestamp.
export function dailyUsage(sessions: Session[], days: number, now = Date.now()): UsageDay[] {
  const today = midnight(new Date(now))
  const first = new Date(today)
  first.setDate(first.getDate() - days + 1)
  return aggregateUsage(sessions, first, days, now)
}

// Natural-year calendar: include Jan 1–Dec 31, but only count events up to now.
export function yearlyUsage(sessions: Session[], now = Date.now()): UsageYearDay[] {
  const year = new Date(now).getFullYear()
  const days = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / 86400000
  return aggregateUsage(sessions, new Date(year, 0, 1), days, now).map((day) => ({
    ...day,
    future: day.timestamp > now,
  }))
}

function aggregateUsage(sessions: Session[], first: Date, days: number, now: number): UsageDay[] {
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(first)
    date.setDate(date.getDate() + index)
    return { timestamp: date.getTime(), total: 0, cost: 0, messages: 0 }
  })
  const byDate = new Map(series.map((day) => [day.timestamp, day]))
  for (const session of sessions) {
    for (const message of session.messages) {
      if (message.role !== 'assistant' || !message.usage || !Number.isFinite(message.timestamp))
        continue
      const day = byDate.get(midnight(new Date(message.timestamp)).getTime())
      if (!day || message.timestamp > now) continue
      day.total += message.usage.total
      day.cost += message.usage.cost
      day.messages++
    }
  }
  return series
}

export function usageOnDay(session: Session, timestamp: number) {
  const end = new Date(timestamp)
  end.setDate(end.getDate() + 1)
  return session.messages.reduce(
    (sum, message) => {
      if (
        message.role !== 'assistant' ||
        !message.usage ||
        message.timestamp < timestamp ||
        message.timestamp >= end.getTime() ||
        message.timestamp > Date.now()
      )
        return sum
      return {
        total: sum.total + message.usage.total,
        cost: sum.cost + message.usage.cost,
        messages: sum.messages + 1,
      }
    },
    { total: 0, cost: 0, messages: 0 },
  )
}

export function heatLevel(total: number, max: number) {
  return total > 0 && max > 0 ? Math.min(4, Math.max(1, Math.ceil((total / max) * 4))) : 0
}
