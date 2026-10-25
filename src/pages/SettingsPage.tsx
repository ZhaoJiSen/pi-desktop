import { ListBox } from '@heroui/react'
import { SlidersHorizontal, Palette, Zap, Blocks, Plug, GitBranch } from 'lucide-react'
import { HoverScrollArea } from '../components/HoverScrollArea'
import { useT } from '../lib/i18n'
import { useWorkspace, type SettingsSectionId } from '../store/workspace'
import { AppearanceSettings } from './settings/AppearanceSettings'
import { GitSettings } from './settings/GitSettings'
import { GeneralSettings } from './settings/GeneralSettings'
import { ExtensionSettings } from './settings/ExtensionSettings'
import { ConnectionSettings } from './settings/ConnectionSettings'
import { CapabilitySettings } from './settings/CapabilitySettings'
import { RetainedView } from '../components/RetainedView'
import { usePaneTransition } from '../hooks/usePaneTransition'

const sections = [
  { id: 'general', label: 'settings.general', icon: SlidersHorizontal },
  { id: 'git', label: 'source.gitSettings', icon: GitBranch },
  { id: 'appearance', label: 'settings.appearance', icon: Palette },
  { id: 'shortcuts', label: 'capability.shortcutSettings', icon: Zap },
  { id: 'extensions', label: 'settings.extensions', icon: Blocks },
  { id: 'connection', label: 'settings.connection', icon: Plug },
] as const

export function SettingsPage() {
  const currentSection = useWorkspace((s) => s.settingsSection)
  const section =
    currentSection === 'capabilities'
      ? 'shortcuts'
      : currentSection === 'notifications'
        ? 'general'
        : currentSection
  const paneRef = usePaneTransition(section)
  const t = useT()
  return (
    <div className="utility-view settings-view settings-workspace">
      <div className="settings-split">
        <nav className="settings-navigation" aria-label={t('navigation.settings')}>
          <div className="settings-browser-heading">
            <h1 className="settings-browser-title">{t('navigation.settings')}</h1>
          </div>
          <ListBox
            aria-label={t('settings.sections')}
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={[section]}
            onSelectionChange={(keys) => {
              const next = sections.find((item) => keys !== 'all' && keys.has(item.id))
              if (next) useWorkspace.setState({ settingsSection: next.id as SettingsSectionId })
            }}
          >
            {sections.map(({ id, label, icon: Icon }) => (
              <ListBox.Item key={id} id={id} textValue={t(label)}>
                <Icon aria-hidden="true" />
                <span>{t(label)}</span>
              </ListBox.Item>
            ))}
          </ListBox>
        </nav>
        <HoverScrollArea
          className="settings-scroll"
          label={t(sections.find((item) => item.id === section)!.label)}
          shadowSize={0}
        >
          <div
            ref={paneRef}
            className="settings-content"
            role="region"
            aria-labelledby="settings-current-heading"
          >
            <div className="settings-panel-heading">
              <h2 id="settings-current-heading">
                {t(sections.find((item) => item.id === section)!.label)}
              </h2>
            </div>
            <RetainedView active={section === 'general'}>
              <div>
                <GeneralSettings />
              </div>
            </RetainedView>
            <RetainedView active={section === 'git'}>
              <div>
                <GitSettings />
              </div>
            </RetainedView>
            <RetainedView active={section === 'appearance'}>
              <div>
                <AppearanceSettings />
              </div>
            </RetainedView>
            <RetainedView active={section === 'shortcuts'}>
              <div
                id="settings-capability-panel"
                aria-label={t(
                  section === 'shortcuts' ? 'capability.shortcutSettings' : 'capability.library',
                )}
              >
                <CapabilitySettings view="shortcuts" />
              </div>
            </RetainedView>
            <RetainedView active={section === 'extensions'}>
              <div>
                <ExtensionSettings />
              </div>
            </RetainedView>
            <RetainedView active={section === 'connection'}>
              <div>
                <ConnectionSettings />
              </div>
            </RetainedView>
          </div>
        </HoverScrollArea>
      </div>
    </div>
  )
}
