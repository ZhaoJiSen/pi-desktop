import { Button, Description, Header, Label, ListBox, Popover, ScrollShadow } from '@heroui/react'
import { Shapes, Settings2, Check, ChevronRight } from 'lucide-react'
import { useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { navigateToCapabilities } from '../../router/navigation'
import { matchesCapability, capabilitySource } from '../../lib/capabilities/display'
import type { Capability, CapabilitySelection } from '../../lib/capabilities/types'
import { CapabilityIcon } from '../capabilities/CapabilityIcon'
import { CapabilitySearch } from '../capabilities/CapabilitySearch'

export function ComposerPrompts({
  capabilities,
  selection,
  disabled,
  onSelect,
  unavailable,
  unavailableReason,
}: {
  capabilities: Capability[]
  selection: CapabilitySelection
  disabled: boolean
  onSelect: (capability: Capability) => Promise<boolean>
  unavailable: (capability: Capability) => boolean
  unavailableReason: (capability: Capability) => string
}) {
  const preferences = useWorkspace((state) => state.capabilityPreferences)
  const [more, setMore] = useState(false),
    [search, setSearch] = useState('')
  const [selecting, setSelecting] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const t = useT(),
    reduced = useReducedMotion()
  const enabled = capabilities.filter((c) => c.enabled)
  const shortcuts = preferences.showShortcuts
    ? enabled.filter((c) => c.pinned).slice(0, preferences.visibleCount)
    : []
  const filtered = enabled.filter((c) => matchesCapability(c, search))
  const groups = search.trim()
    ? [{ name: 'capability.results' as const, items: filtered }]
    : [
        {
          name: 'capability.frequent' as const,
          items: filtered.filter((c) => c.pinned && c.scope !== 'session'),
        },
        { name: 'capability.modes' as const, items: filtered.filter((c) => c.scope === 'session') },
        {
          name: 'capability.other' as const,
          items: filtered.filter((c) => !c.pinned && c.scope !== 'session'),
        },
      ]
  const selected = (c: Capability) => selection.mode?.id === c.id || selection.task?.id === c.id
  async function choose(item: Capability) {
    if (disabled || selecting || unavailable(item)) return
    setSelecting(true)
    try {
      if (await onSelect(item)) setMore(false)
    } finally {
      setSelecting(false)
    }
  }
  return (
    <div className="composer-prompts">
      <div className="composer-prompt-actions" role="group" aria-label={t('capability.shortcuts')}>
        {shortcuts.map((item, index) => (
          <motion.div
            key={item.id}
            className={index > 0 ? 'composer-prompt-secondary' : undefined}
            whileTap={reduced ? undefined : { scale: 0.97 }}
          >
            <Button
              variant="ghost"
              className="composer-prompt-button"
              aria-pressed={selected(item)}
              isDisabled={disabled || selecting || unavailable(item)}
              onPress={() => void choose(item)}
            >
              <CapabilityIcon name={item.icon} />
              <span>{item.name}</span>
            </Button>
          </motion.div>
        ))}
        <Popover
          isOpen={more}
          onOpenChange={(open) => {
            setMore(open)
            if (!open) setSearch('')
          }}
        >
          <Button
            variant="ghost"
            className="composer-prompt-button composer-prompt-more"
            aria-label={t('capability.more')}
            isDisabled={disabled || selecting}
          >
            <Shapes />
            <span>{t('capability.choose')}</span>
          </Button>
          <Popover.Content
            placement="top start"
            className="composer-prompts-menu capability-picker"
            containerPadding={16}
            offset={8}
          >
            <Popover.Dialog aria-label={t('capability.more')}>
              <div
                className="capability-picker-body"
                onKeyDownCapture={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    event.stopPropagation()
                    setMore(false)
                  }
                }}
              >
                <CapabilitySearch
                  value={search}
                  onChange={setSearch}
                  autoFocus
                  onNavigate={() => list.current?.focus()}
                />
                <ScrollShadow className="composer-prompts-options" size={12}>
                  <ListBox
                    ref={list}
                    aria-label={t('capability.more')}
                    selectionMode="none"
                    disabledKeys={filtered.filter(unavailable).map((c) => c.id)}
                    onAction={(id) => {
                      const item = filtered.find((c) => c.id === id)
                      if (item) void choose(item)
                    }}
                    renderEmptyState={() => (
                      <p className="capability-empty">{t('capability.empty')}</p>
                    )}
                  >
                    {groups
                      .filter((group) => group.items.length)
                      .map((group) => (
                        <ListBox.Section key={group.name}>
                          <Header>{t(group.name)}</Header>
                          {group.items.map((item) => (
                            <ListBox.Item
                              key={item.id}
                              id={item.id}
                              textValue={`${item.name} ${item.alias}`}
                              className="capability-picker-item"
                            >
                              <CapabilityIcon name={item.icon} />
                              <div className="capability-picker-copy">
                                <div>
                                  <Label>{item.name}</Label>
                                  <span className="capability-picker-alias">
                                    {search.trim() && item.target
                                      ? capabilitySource(item, t)
                                      : `/${item.alias}`}
                                  </span>
                                </div>
                                <Description>
                                  {unavailable(item) ? unavailableReason(item) : item.description}
                                </Description>
                                {item.target && !search.trim() && (
                                  <span className="capability-picker-source">
                                    {capabilitySource(item, t)}
                                  </span>
                                )}
                              </div>
                              {selected(item) && (
                                <Check
                                  className="capability-picker-check"
                                  aria-label={t('capability.selected')}
                                />
                              )}
                            </ListBox.Item>
                          ))}
                        </ListBox.Section>
                      ))}
                  </ListBox>
                </ScrollShadow>
                <Button
                  variant="ghost"
                  className="capability-manage"
                  onPress={() => {
                    setMore(false)
                    void navigateToCapabilities()
                  }}
                >
                  <Settings2 />
                  <span>{t('capability.manage')}</span>
                  <ChevronRight />
                </Button>
              </div>
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      </div>
    </div>
  )
}
