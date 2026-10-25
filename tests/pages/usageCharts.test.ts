import { describe, expect, it } from 'vitest'
import { emptyUsage, makeSession } from '../../src/lib/fixtures'
import { applyStreamEvent, normalizeMessages } from '../../src/lib/rpc'
import { dailyUsage, heatLevel, yearlyUsage } from '../../src/pages/usage/usageCharts'

const rawUsage = {
  input: 60,
  output: 10,
  cacheRead: 30,
  cacheWrite: 0,
  totalTokens: 100,
  cost: { total: 0.02 },
}

describe('dated usage charts', () => {
  it('retains Pi message usage from history and completed streaming messages', () => {
    const timestamp = new Date(2026, 9, 24, 10).getTime()
    const message = {
      role: 'assistant',
      content: [{ type: 'text', text: 'Done' }],
      timestamp,
      usage: rawUsage,
    }
    const history = normalizeMessages([message])
    expect(history[0].usage).toEqual({
      input: 60,
      output: 10,
      cacheRead: 30,
      cacheWrite: 0,
      total: 100,
      cost: 0.02,
    })
    const started = applyStreamEvent([], {
      type: 'message_start',
      message: { ...message, usage: undefined },
    })
    const completed = applyStreamEvent(started, { type: 'message_end', message })
    expect(completed).toHaveLength(1)
    expect(completed[0].usage).toEqual(history[0].usage)
    expect(normalizeMessages([{ ...message, timestamp: undefined }])[0].usage).toBeUndefined()
    expect(
      normalizeMessages([{ ...message, usage: { ...rawUsage, totalTokens: NaN } }])[0].usage,
    ).toBeUndefined()
  })
  it('buckets actual message dates across midnight and never assigns lifetime spend to updatedAt', () => {
    const now = new Date(2026, 9, 24, 12).getTime()
    const session = makeSession('project')
    session.updatedAt = now
    session.usage = { ...emptyUsage, total: 999999, cost: 99 }
    session.messages = normalizeMessages([
      {
        role: 'assistant',
        content: 'Yesterday',
        timestamp: new Date(2026, 9, 23, 23, 59).getTime(),
        usage: rawUsage,
      },
      {
        role: 'assistant',
        content: 'Today',
        timestamp: new Date(2026, 9, 24, 0, 1).getTime(),
        usage: { ...rawUsage, totalTokens: 200 },
      },
      { role: 'assistant', content: 'No details', timestamp: now },
      { role: 'assistant', content: 'Future', timestamp: now + 86400000, usage: rawUsage },
      { role: 'user', content: 'User message', timestamp: now, usage: rawUsage },
    ])
    const series = dailyUsage([session], 3, now)
    expect(series.map(({ total, cost, messages }) => ({ total, cost, messages }))).toEqual([
      { total: 0, cost: 0, messages: 0 },
      { total: 100, cost: 0.02, messages: 1 },
      { total: 200, cost: 0.02, messages: 1 },
    ])
    const noHistory = { ...session, messages: [] }
    expect(
      dailyUsage([noHistory], 3, now).every((day) => day.messages === 0 && day.cost === 0),
    ).toBe(true)
  })
  it('shows the selected sessions only and expands the window without losing dates', () => {
    const now = new Date(2026, 9, 24, 12).getTime()
    const session = makeSession('a')
    session.messages = normalizeMessages([
      {
        role: 'assistant',
        content: 'Old',
        timestamp: new Date(2026, 8, 1, 12).getTime(),
        usage: rawUsage,
      },
    ])
    expect(dailyUsage([session], 30, now).some((day) => day.messages > 0)).toBe(false)
    expect(dailyUsage([session], 90, now).reduce((sum, day) => sum + day.total, 0)).toBe(100)
    expect(dailyUsage([], 90, now).every((day) => day.total === 0)).toBe(true)
  })
  it('keeps exactly 365 unique local calendar days across a leap year', () => {
    for (const now of [
      new Date(2026, 9, 24, 12),
      new Date(2024, 2, 1, 12),
      new Date(2026, 9, 25, 12),
    ]) {
      const series = dailyUsage([], 365, now.getTime())
      expect(series).toHaveLength(365)
      expect(new Date(series.at(-1)!.timestamp).getDate()).toBe(now.getDate())
      expect(new Set(series.map((day) => day.timestamp)).size).toBe(365)
    }
  })
  it('covers a natural year including leap day and excludes previous-year and future consumption', () => {
    const now = new Date(2024, 2, 1, 12).getTime()
    const session = makeSession('calendar')
    session.messages = normalizeMessages([
      {
        role: 'assistant',
        content: 'Previous year',
        timestamp: new Date(2023, 11, 31, 12).getTime(),
        usage: rawUsage,
      },
      {
        role: 'assistant',
        content: 'First day',
        timestamp: new Date(2024, 0, 1, 12).getTime(),
        usage: rawUsage,
      },
      {
        role: 'assistant',
        content: 'Leap day',
        timestamp: new Date(2024, 1, 29, 12).getTime(),
        usage: rawUsage,
      },
      {
        role: 'assistant',
        content: 'Future',
        timestamp: new Date(2024, 11, 1, 12).getTime(),
        usage: rawUsage,
      },
    ])
    const year = yearlyUsage([session], now)
    expect(year).toHaveLength(366)
    expect(year[0].timestamp).toBe(new Date(2024, 0, 1).getTime())
    expect(year.at(-1)!.timestamp).toBe(new Date(2024, 11, 31).getTime())
    expect(year.find((day) => day.timestamp === new Date(2024, 1, 29).getTime())?.total).toBe(100)
    expect(year.reduce((sum, day) => sum + day.total, 0)).toBe(200)
    expect(year[0].future).toBe(false)
    expect(year.at(-1)!.future).toBe(true)
    expect(yearlyUsage([], new Date(2026, 9, 25, 12).getTime())).toHaveLength(365)
  })
  it('uses zero plus four bounded intensity levels based on daily tokens', () => {
    expect([0, 1, 25, 26, 50, 51, 75, 76, 100].map((value) => heatLevel(value, 100))).toEqual([
      0, 1, 1, 2, 2, 3, 3, 4, 4,
    ])
    expect(heatLevel(0, 0)).toBe(0)
  })
})
