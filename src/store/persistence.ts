import {
  createJSONStorage,
  type PersistStorage,
  type StateStorage,
  type StorageValue,
} from 'zustand/middleware'
import { shallow } from 'zustand/vanilla/shallow'

// Queue the object, not the JSON string: serializing the entire workspace on
// every token blocks the webview even if the eventual disk write is debounced.
export function createWorkspacePersistence<T extends object>(
  storage: StateStorage,
  defer: () => boolean,
) {
  const json = createJSONStorage<T>(() => storage)!
  let latest: StorageValue<T> | undefined
  let pending: { name: string; value: StorageValue<T> } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  function flush() {
    clearTimeout(timer)
    timer = undefined
    if (!pending) return
    const { name, value } = pending
    pending = undefined
    return json.setItem(name, value)
  }
  const persistence: PersistStorage<T> = {
    getItem: json.getItem,
    removeItem: (name) => {
      clearTimeout(timer)
      timer = undefined
      pending = latest = undefined
      return json.removeItem(name)
    },
    setItem: (name, value) => {
      // Connection state, spinners and other transient updates aren't persisted.
      if (latest && latest.version === value.version && shallow(latest.state, value.state)) return
      latest = value
      pending = { name, value }
      if (!defer()) return flush()
      // Fixed checkpoint interval, not a trailing debounce that can starve a
      // continuously streaming response. Completion and page hide flush sooner.
      timer ??= setTimeout(flush, 500)
    },
  }
  function save(name: string, value: StorageValue<T>) {
    latest = value
    pending = { name, value }
    return flush()
  }
  return { storage: persistence, flush, save }
}
