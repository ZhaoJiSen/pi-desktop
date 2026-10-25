import { create } from 'zustand'

export const defaultUsageView = {
  scope: 'current' as 'current' | 'all',
  project: 'all',
  query: '',
  sort: 'cost' as 'cost' | 'total',
  ascending: false,
  metric: 'total' as 'total' | 'cost',
  days: 30,
  selectedDay: null as number | null,
}

// Transient analysis context survives navigating to a conversation and back.
// Keep it in memory rather than persisting conversation searches to disk.
export const useUsageViewState = create<typeof defaultUsageView>(() => ({ ...defaultUsageView }))
let scrollTop = 0
export const usageScroll = {
  read: () => scrollTop,
  remember: (value: number) => {
    scrollTop = value
  },
}
