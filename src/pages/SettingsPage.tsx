import { ListBox } from '@heroui/react'
import { motion, useReducedMotion } from 'motion/react'
import { SlidersHorizontal, Palette, Zap, Blocks, Plug } from 'lucide-react'
import { useT } from '../lib/i18n'
import { useWorkspace, type SettingsSectionId } from '../store/workspace'
import { AppearanceSettings } from './settings/AppearanceSettings'
import { GeneralSettings } from './settings/GeneralSettings'
import { ExtensionSettings } from './settings/ExtensionSettings'
import { ConnectionSettings } from './settings/ConnectionSettings'
import { CapabilitySettings } from './settings/CapabilitySettings'

const sections = [
  { id: 'general', label: 'settings.general', icon: SlidersHorizontal },
  { id: 'appearance', label: 'settings.appearance', icon: Palette },
  { id: 'shortcuts', label: 'capability.shortcutSettings', icon: Zap },
  { id: 'extensions', label: 'settings.extensions', icon: Blocks },
  { id: 'connection', label: 'settings.connection', icon: Plug },
] as const

export function SettingsPage() {
  const currentSection = useWorkspace((s) => s.settingsSection)
  const section = currentSection === 'capabilities' ? 'shortcuts' : currentSection
  const reduced = useReducedMotion()
  const t = useT()
  return (
    <div className="utility-view settings-view settings-workspace">
      <header className="settings-heading">
        <h1 className="utility-page-title">{t('navigation.settings')}</h1>
      </header>
      <div className="settings-layout">
        <nav className="settings-navigation" aria-label={t('navigation.settings')}>
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
        <motion.div
          layoutScroll
          className="settings-content"
          role="region"
          aria-labelledby="settings-current-heading"
        >
          <motion.div
            key={section}
            className="settings-panel-heading"
            initial={reduced ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
          >
            <h2 id="settings-current-heading">
              {t(sections.find((item) => item.id === section)!.label)}
            </h2>
          </motion.div>
          <div hidden={section !== 'general'}>
            <GeneralSettings />
          </div>
          <div hidden={section !== 'appearance'}>
            <AppearanceSettings />
          </div>
          <div
            id="settings-capability-panel"
            aria-label={t(
              section === 'shortcuts' ? 'capability.shortcutSettings' : 'capability.library',
            )}
            hidden={section !== 'shortcuts'}
          >
            <CapabilitySettings view="shortcuts" />
          </div>
          <div hidden={section !== 'extensions'}>
            <ExtensionSettings />
          </div>
          <div hidden={section !== 'connection'}>
            <ConnectionSettings />
          </div>
        </motion.div>
      </div>
    </div>
  )
}
