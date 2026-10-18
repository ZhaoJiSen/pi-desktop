import { Button, Popover, ScrollShadow } from '@heroui/react'
import { useDebounce } from 'ahooks'
import { Check, ChevronDown, Search } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { changeModel } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { errorText, modelKey, tokens } from '../lib/utils'
import type { Model } from '../types'

export function ModelSelector({
  isOpen,
  onOpenChange,
  placement = 'bottom start',
  boundaryElement,
  disabled = false,
  onPendingChange,
}: {
  isOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: 'top start' | 'bottom start'
  boundaryElement?: Element
  disabled?: boolean
  onPendingChange?: (pending: boolean) => void
} = {}) {
  const reducedMotion = useReducedMotion()
  const models = useWorkspace((state) => state.models)
  const recent = useWorkspace((state) => state.recentModels)
  const session = useWorkspace((state) =>
    state.sessions.find((item) => item.id === state.activeSessionId),
  )
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isOpen ?? internalOpen
  function setOpen(value: boolean) {
    setInternalOpen(value)
    onOpenChange?.(value)
    if (!value) {
      setQuery('')
      setError('')
    }
  }
  const [query, setQuery] = useState('')
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    // Disabling a focused option moves native focus out of the dialog. Keep
    // keyboard dismissal available while a request or connection is pending.
    if (open && (busy || changing || disabled)) searchInput.current?.focus({ preventScroll: true })
  }, [open, busy, changing, disabled])
  const search = useDebounce(query.trim().toLowerCase(), { wait: 100 })
  const t = useT()
  const selected = models.find((model) => modelKey(model) === session?.modelKey)
  const label = t('models.choose')
  const filtered = models.filter((model) =>
    `${model.name} ${model.provider} ${model.id}`.toLowerCase().includes(search),
  )
  const recentModels = !search
    ? recent
        .map((key) => filtered.find((model) => modelKey(model) === key))
        .filter((model): model is Model => Boolean(model))
    : []
  const remaining = filtered.filter((model) => !recentModels.includes(model))
  const groups = new Map<string, Model[]>()
  for (const model of remaining) {
    const group = groups.get(model.provider)
    if (group) group.push(model)
    else groups.set(model.provider, [model])
  }
  async function choose(model: Model) {
    if (changing || disabled || busy) return
    if (modelKey(model) === session?.modelKey) {
      setOpen(false)
      return
    }
    setChanging(true)
    onPendingChange?.(true)
    setError('')
    try {
      await changeModel(model)
      setOpen(false)
    } catch (error) {
      setError(errorText(error))
      useWorkspace.setState({ connectionError: errorText(error) })
    } finally {
      setChanging(false)
      onPendingChange?.(false)
    }
  }
  const row = (model: Model, showProvider = false) => (
    <Button
      key={modelKey(model)}
      variant="ghost"
      className="model-row"
      isDisabled={changing || disabled || busy}
      aria-pressed={modelKey(model) === session?.modelKey}
      onPress={() => void choose(model)}
      aria-label={`${model.name}, ${model.provider}`}
    >
      <span className="model-row-copy">
        <span>{model.name}</span>
        <span className="model-description">
          {showProvider
            ? t('models.contextWithProvider', {
                provider: model.provider,
                tokens: tokens(model.contextWindow),
              })
            : t('models.contextWindow', { tokens: tokens(model.contextWindow) })}
        </span>
      </span>
      {modelKey(model) === session?.modelKey && (
        <motion.span layoutId="model-check">
          <Check />
        </motion.span>
      )}
    </Button>
  )
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        className="composer-select model-trigger"
        isDisabled={busy || changing || disabled}
        aria-label={label}
      >
        <span className="model-trigger-name" title={selected?.name || t('models.choose')}>
          {selected?.name || t('models.choose')}
        </span>
        <ChevronDown className="chevron" />
      </Button>
      <Popover.Content
        placement={placement}
        shouldFlip
        containerPadding={24}
        boundaryElement={boundaryElement}
        className="model-popover"
        offset={12}
      >
        <Popover.Dialog aria-label={label}>
          <AnimatePresence>
            <motion.div
              className="model-popover-content"
              initial={reducedMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <label className="popover-search">
                <Search />
                <input
                  ref={searchInput}
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('models.searchPlaceholder')}
                  aria-label={t('common.search')}
                />
              </label>
              <ScrollShadow className="model-options" orientation="vertical" size={12}>
                {recentModels.length > 0 && (
                  <div className="model-group" role="group" aria-label={t('models.recent')}>
                    <div className="option-label model-group-label">{t('models.recent')}</div>
                    {recentModels.map((model) => row(model, true))}
                  </div>
                )}
                {Array.from(groups, ([provider, items]) => (
                  <div key={provider} className="model-group" role="group" aria-label={provider}>
                    <div className="option-label model-group-label">{provider}</div>
                    {items.map((model) => row(model))}
                  </div>
                ))}
                {!filtered.length && <div className="popover-empty">{t('models.noResults')}</div>}
              </ScrollShadow>
              {error && (
                <p className="model-selection-error" role="alert">
                  {error}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
