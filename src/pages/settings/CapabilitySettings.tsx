import { Button, ListBox, Select } from '@heroui/react'
import { ArrowUpRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { navigateToCapabilities } from '../../router/navigation'
import { PinnedCapabilities } from './PinnedCapabilities'
import { CapabilityIcon } from '../../components/capabilities/CapabilityIcon'
import { CapabilityPreferencesControls } from '../../components/capabilities/CapabilityPreferencesControls'
import { SettingsSection } from './SettingsSection'
import { SettingsSwitch } from './SettingsSwitch'
import { useCapabilityPreferences } from './useCapabilityPreferences'

export function CapabilitySettings({ view = 'shortcuts' }: { view?: 'shortcuts' | 'library' }) {
  const t = useT()
  const controller = useCapabilityPreferences()
  const { draft, setDraft, patch, reorderPinned } = controller
  const pinned = draft.items.filter((item) => item.pinned)
  const visible = pinned
    .filter((item) => item.enabled)
    .slice(0, draft.showShortcuts ? draft.visibleCount : 0)
  return (
    <SettingsSection
      id="settings-capabilities"
      title={t(view === 'shortcuts' ? 'capability.shortcutSettings' : 'capability.library')}
    >
      <div hidden={view !== 'shortcuts'} className="capability-shortcuts-panel">
        <div className="settings-switches">
          <SettingsSwitch
            label={t('capability.shortcuts')}
            description={t('capability.shortcutsHelp')}
            isSelected={draft.showShortcuts}
            onChange={(showShortcuts) => {
              setDraft({ ...draft, showShortcuts })
            }}
          />
          <div className="settings-row capability-count-row">
            <div className="settings-row-text">
              <span id="capability-count-label">{t('capability.count')}</span>
              <p className="settings-help">{t('capability.countHelp')}</p>
            </div>
            <Select
              className="capability-count"
              aria-labelledby="capability-count-label"
              value={String(draft.visibleCount)}
              variant="secondary"
              isDisabled={!draft.showShortcuts}
              onChange={(value) => {
                setDraft({ ...draft, visibleCount: Number(value) })
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {Array.from({ length: 7 }, (_, i) => (
                    <ListBox.Item id={String(i)} key={i} textValue={String(i)}>
                      {i}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>
        <div className="capability-shortcut-preview" aria-label={t('capability.preview')}>
          <span>{t('capability.preview')}</span>
          <div>
            {visible.map((item) => (
              <span key={item.id} className="capability-preview-item">
                <CapabilityIcon name={item.icon} />
                {item.name}
              </span>
            ))}
            <span className="capability-preview-item">{t('capability.choose')}</span>
          </div>
        </div>
        <div className="capability-list-heading">
          <h3>{t('capability.pinnedOrder')}</h3>
        </div>
        <p className="settings-help">{t('capability.pinnedHelp')}</p>
        <PinnedCapabilities
          items={pinned}
          onReorder={reorderPinned}
          onUnpin={(id) => patch(id, { pinned: false })}
        />
        {!pinned.length && <p className="capability-empty">{t('capability.noPinned')}</p>}
      </div>
      <div className="settings-row capability-library-link">
        <div className="settings-row-text">
          <span>{t('capability.library')}</span>
          <p className="settings-help">{t('library.manageHelp')}</p>
        </div>
        <Button variant="secondary" size="sm" onPress={() => void navigateToCapabilities()}>
          {t('library.openLibrary')}
          <ArrowUpRight />
        </Button>
      </div>
      <CapabilityPreferencesControls controller={controller} />
    </SettingsSection>
  )
}
