import { create } from 'zustand'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { useComposerCommands } from '../../components/composer/useComposerCommands'
import { resolveCapabilities, isPlanCapability } from '../../lib/capabilities/catalog'
import type { Capability, CapabilityPreferences } from '../../lib/capabilities/types'

// Settings drafts and per-item edits survive navigation, but are never treated as saved preferences.
const useCapabilityDraft = create<{
  changes: CapabilityPreferences | null
  dirty: boolean
  saved: boolean
  saving: boolean
  editing: Capability | null
  edits: Record<string, Capability>
}>(() => ({ changes: null, dirty: false, saved: false, saving: false, editing: null, edits: {} }))

let autoFlushRunning = false

export function useCapabilityPreferences() {
  const preferences = useWorkspace((s) => s.capabilityPreferences)
  const storageError = useWorkspace((s) => s.storageError)
  const { commands } = useComposerCommands()
  const t = useT()
  const { changes, dirty, saved, saving, editing, edits } = useCapabilityDraft()
  const setDirty = (dirty: boolean) => useCapabilityDraft.setState({ dirty })
  const setSaved = (saved: boolean) => useCapabilityDraft.setState({ saved })
  const resolved = resolveCapabilities(preferences, commands, t)
  // New runtime resources remain discoverable even when Settings holds an unsaved sort draft.
  const draft = changes
    ? {
        ...changes,
        items: [
          ...changes.items,
          ...resolved.filter((item) => !changes.items.some((saved) => saved.id === item.id)),
        ],
      }
    : { ...preferences, items: resolved }
  function setEditing(value: Capability | null) {
    if (value) {
      const previous = useCapabilityDraft.getState().edits[value.id]
      useCapabilityDraft.setState({ editing: previous || value })
    } else {
      const state = useCapabilityDraft.getState()
      const next = { ...state.edits }
      if (state.editing) delete next[state.editing.id]
      useCapabilityDraft.setState({ editing: null, edits: next })
    }
  }
  function updateEditing(value: Capability) {
    useCapabilityDraft.setState((state) => ({
      editing: value,
      edits: { ...state.edits, [value.id]: value },
    }))
  }
  function setDraft(
    next: CapabilityPreferences | ((old: CapabilityPreferences) => CapabilityPreferences),
  ) {
    const current = useCapabilityDraft.getState().changes || {
      ...useWorkspace.getState().capabilityPreferences,
      items: resolveCapabilities(useWorkspace.getState().capabilityPreferences, commands, t),
    }
    useCapabilityDraft.setState({
      changes: typeof next === 'function' ? next(current) : next,
      dirty: true,
      saved: false,
    })
    void flushShortcuts()
  }
  async function flushShortcuts() {
    if (autoFlushRunning) return
    autoFlushRunning = true
    try {
      while (useCapabilityDraft.getState().dirty) {
        const snapshot = useCapabilityDraft.getState().changes
        if (!snapshot) break
        // Writes are synchronous; a pending acknowledgement can finish before the next write.
        while (useCapabilityDraft.getState().saving) await Promise.resolve()
        if (!(await persist(snapshot))) break
        if (useCapabilityDraft.getState().changes === snapshot)
          useCapabilityDraft.setState({ changes: null, dirty: false })
      }
    } finally {
      autoFlushRunning = false
    }
  }
  function change(items: Capability[]) {
    setDraft((old) => ({ ...old, items }))
  }
  function patch(id: string, value: Partial<Capability>) {
    change(draft.items.map((item) => (item.id === id ? { ...item, ...value } : item)))
  }
  function reorderPinned(ids: string[]) {
    const pinned = new Map(draft.items.filter((item) => item.pinned).map((item) => [item.id, item]))
    if (
      ids.length !== pinned.size ||
      new Set(ids).size !== pinned.size ||
      ids.some((id) => !pinned.has(id))
    )
      return
    let index = 0
    change(draft.items.map((item) => (item.pinned ? pinned.get(ids[index++]!)! : item)))
  }
  function copy(item?: Capability) {
    const id = crypto.randomUUID(),
      aliasBase = item ? `${item.alias}-copy` : 'custom'
    let alias = aliasBase,
      index = 1
    while (draft.items.some((c) => c.alias === alias)) alias = `${aliasBase}-${index++}`
    const value: Capability = item
      ? {
          ...item,
          id,
          builtin: undefined,
          readOnly: isPlanCapability(item),
          name: `${item.name} (${t('capability.copy')})`,
          alias,
          pinned: false,
        }
      : {
          id,
          name: '',
          description: '',
          icon: 'workflow',
          alias,
          prompt: '',
          scope: 'once',
          enabled: true,
          pinned: false,
          modifies: false,
        }
    useCapabilityDraft.setState((state) => ({
      editing: value,
      edits: { ...state.edits, [id]: value },
    }))
    return value
  }
  async function persist(next: CapabilityPreferences) {
    if (useCapabilityDraft.getState().saving) return false
    useCapabilityDraft.setState({ saving: true, saved: false })
    // Persist explicit overrides, not an installation snapshot of every discovered resource.
    const defaults = new Map(
      resolveCapabilities({ showShortcuts: true, visibleCount: 2, items: [] }, commands, t).map(
        (item) => [item.id, item],
      ),
    )
    next = {
      ...next,
      items: next.items.filter(
        (item) =>
          !item.id.startsWith('runtime:') ||
          !defaults.has(item.id) ||
          JSON.stringify(defaults.get(item.id)) !== JSON.stringify(item),
      ),
    }
    const previous = useWorkspace.getState().capabilityPreferences
    useWorkspace.setState({ storageError: null })
    useWorkspace.getState().setPreference({ capabilityPreferences: next })
    await Promise.resolve()
    const failed = Boolean(useWorkspace.getState().storageError)
    if (failed) useWorkspace.setState({ capabilityPreferences: previous })
    useCapabilityDraft.setState({ saving: false, saved: !failed })
    return !failed
  }
  async function save() {
    if (!(await persist(draft))) return false
    useCapabilityDraft.setState({ changes: null, dirty: false })
    return true
  }
  async function commitItems(transform: (items: Capability[]) => Capability[]) {
    const current = useWorkspace.getState().capabilityPreferences
    const next = { ...current, items: transform(resolveCapabilities(current, commands, t)) }
    if (!(await persist(next))) return false
    const pending = useCapabilityDraft.getState().changes
    if (pending)
      useCapabilityDraft.setState({ changes: { ...pending, items: transform(pending.items) } })
    return true
  }
  function saveItem(value: Capability) {
    return commitItems((items) =>
      items.some((item) => item.id === value.id)
        ? items.map((item) => (item.id === value.id ? value : item))
        : [...items, value],
    )
  }
  async function toggleCommand(id: string, enabled: boolean) {
    const current = useWorkspace.getState().capabilityPreferences
    const disabled = new Set(current.disabledCommandIds || [])
    if (enabled) disabled.delete(id)
    else disabled.add(id)
    const disabledCommandIds = [...disabled]
    if (!(await persist({ ...current, disabledCommandIds }))) return false
    const pending = useCapabilityDraft.getState().changes
    if (pending) useCapabilityDraft.setState({ changes: { ...pending, disabledCommandIds } })
    return true
  }
  return {
    draft,
    preferences,
    commands,
    setDraft,
    dirty,
    setDirty,
    saved,
    saving,
    setSaved,
    editing,
    edits,
    setEditing,
    updateEditing,
    storageError,
    change,
    patch,
    copy,
    reorderPinned,
    save,
    saveItem,
    commitItems,
    toggleCommand,
  }
}
export type CapabilityPreferencesController = ReturnType<typeof useCapabilityPreferences>
