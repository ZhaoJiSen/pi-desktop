import { Button, Popover } from '@heroui/react'
import { Brain, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { changeThinking } from '../lib/desktop'
import { useT } from '../lib/i18n'
import { modelThinkingLevels, thinkingLabel } from '../lib/thinking'
import { errorText, modelKey } from '../lib/utils'
import { isDesktop, useWorkspace } from '../store/workspace'
import { useShallow } from 'zustand/react/shallow'
import type { ThinkingLevel } from '../types'
import { ModelThinkingControl } from './ModelThinkingControl'

export function ThinkingSelector({
  isOpen,
  onOpenChange,
  placement,
  boundaryElement,
  disabled = false,
  onPendingChange,
}: {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  placement: 'top start' | 'bottom start'
  boundaryElement?: Element
  disabled?: boolean
  onPendingChange: (pending: boolean) => void
}) {
  const t = useT()
  const models = useWorkspace((state) => state.models)
  const runtimeLevels = useWorkspace((state) => state.thinkingLevels)
  const session = useWorkspace(
    useShallow((state) => {
      const current = state.sessions.find((item) => item.id === state.activeSessionId)
      return current
        ? { id: current.id, modelKey: current.modelKey, thinking: current.thinking }
        : undefined
    }),
  )
  const busy = useWorkspace(
    (state) => Boolean(state.runningSessionId) || state.connection === 'connecting',
  )
  const selected = models.find((model) => modelKey(model) === session?.modelKey)
  const levels = isDesktop ? runtimeLevels : modelThinkingLevels(selected)
  const supported = Boolean(selected?.reasoning)
  const thinking = session?.thinking ?? 'medium'
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dialog = useRef<HTMLElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => {
    if (!isOpen) return
    // Keep Escape available while the focused slider is locked for a save.
    if (busy || disabled || saving) dialog.current?.focus({ preventScroll: true })
    else if (restoreFocus.current && document.activeElement === dialog.current) {
      dialog.current
        ?.querySelector<HTMLInputElement>('input[type=range]')
        ?.focus({ preventScroll: true })
      restoreFocus.current = false
    }
  }, [isOpen, busy, disabled, saving])
  async function choose(level: ThinkingLevel) {
    if (busy || disabled || saving || !supported || !levels.includes(level)) return
    restoreFocus.current = Boolean(dialog.current?.contains(document.activeElement))
    setSaving(true)
    onPendingChange(true)
    setError('')
    try {
      await changeThinking(level)
    } catch (error) {
      setError(errorText(error))
      useWorkspace.setState({ connectionError: errorText(error) })
    } finally {
      setSaving(false)
      onPendingChange(false)
    }
  }
  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) setError('')
        onOpenChange(open)
      }}
    >
      <Button
        variant="ghost"
        className="composer-select reasoning thinking-selector-trigger"
        aria-label={t('thinking.effort')}
        aria-description={!supported ? t('thinking.unavailable') : undefined}
        isDisabled={busy || disabled || saving || !supported || !levels.length}
        data-saving-thinking={saving || undefined}
      >
        <Brain aria-hidden="true" />
        <span className="thinking-trigger-label">
          <span>{t(thinkingLabel[supported ? thinking : 'off'])}</span>
          <span className="thinking-trigger-sizer" aria-hidden="true">
            {levels.map((level) => (
              <span key={level}>{t(thinkingLabel[level])}</span>
            ))}
          </span>
        </span>
        <ChevronDown className="chevron" aria-hidden="true" />
      </Button>
      <Popover.Content
        className="thinking-popover"
        placement={placement}
        boundaryElement={boundaryElement}
        shouldFlip
        containerPadding={24}
        offset={12}
      >
        <Popover.Dialog ref={dialog} aria-label={t('thinking.effort')}>
          <ModelThinkingControl
            key={`${session?.id}:${session?.modelKey}:${levels.join(',')}`}
            value={thinking}
            modelName={selected?.name}
            levels={levels}
            supported={supported}
            disabled={busy || disabled}
            pending={saving}
            focusSelected
            onChange={choose}
          />
          {error && (
            <p className="model-selection-error" role="alert">
              {error}
            </p>
          )}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}
