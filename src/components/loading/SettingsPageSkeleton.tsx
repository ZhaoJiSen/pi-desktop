import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import { SkeletonBar } from './SkeletonBar'

const sections = [
  ['general', 'settings.general'],
  ['git', 'source.gitSettings'],
  ['appearance', 'settings.appearance'],
  ['shortcuts', 'capability.shortcutSettings'],
  ['extensions', 'settings.extensions'],
  ['connection', 'settings.connection'],
] as const

export function SettingsPageSkeleton() {
  const t = useT()
  const selected = useWorkspace((s) => s.settingsSection)
  const section = sections.find(([id]) => id === selected) ?? sections[0]
  return (
    <div className="utility-view settings-view settings-workspace">
      <div className="settings-split">
        <nav className="settings-navigation">
          <div className="settings-browser-heading">
            <h1 className="settings-browser-title">{t('navigation.settings')}</h1>
          </div>
          <div className="list-box">
            {sections.map(([id, label]) => (
              <div
                className="list-box-item"
                data-selected={id === section[0] ? 'true' : undefined}
                key={id}
              >
                <SkeletonBar className="workspace-skeleton-icon" />
                <span>{t(label)}</span>
              </div>
            ))}
          </div>
        </nav>
        <div className="settings-scroll hover-scroll-area">
          <div className="hover-scroll-viewport">
            <div className="settings-content">
              <div className="settings-panel-heading">
                <h2>{t(section[1])}</h2>
              </div>
              <div className="settings-section">
                <div className="settings-rows">
                  {[0, 1, 2, 3].map((row) => (
                    <div className="settings-row" key={row}>
                      <div className="workspace-skeleton-copy">
                        <SkeletonBar width="52%" />
                        <SkeletonBar width="85%" />
                      </div>
                      <SkeletonBar className="workspace-skeleton-control" width="100px" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
