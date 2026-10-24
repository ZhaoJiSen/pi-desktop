import { ListBox, Select } from '@heroui/react'
import { useState } from 'react'
import { useT } from '../../lib/i18n'
import { fetchIntervals, saveFetchInterval } from '../../lib/source/sync'
import { useGitFetchInterval } from '../../hooks/useGitFetchInterval'
import { useProjectSource } from '../../components/source/useProjectSource'
import { OverflowTooltip } from '../../components/OverflowTooltip'
import { useWorkspace } from '../../store/workspace'
import { SettingsSection } from './SettingsSection'

export function GitSettings() {
  const t = useT()
  const projects = useWorkspace((state) => state.projects)
  const current = useProjectSource()
  const [selected, setSelected] = useState<string | null>(null)
  const project =
    projects.find((item) => item.id === selected) ??
    projects.find((item) => item.path === current.path) ??
    projects[0]
  return (
    <SettingsSection id="settings-git" title={t('source.gitSyncSettings')}>
      {!project ? (
        <p className="settings-help">{t('source.noProject')}</p>
      ) : (
        <div className="settings-rows settings-git-rows">
          <div className="settings-row">
            <div className="settings-row-text">
              <span id="settings-git-repository-label">{t('source.project')}</span>
              <p className="settings-help">{t('source.repositoryPreferences')}</p>
            </div>
            <Select
              className="settings-git-select"
              aria-labelledby="settings-git-repository-label"
              variant="secondary"
              value={project.id}
              onChange={(id) => setSelected(String(id))}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover placement="bottom end" className="settings-git-repositories">
                <ListBox>
                  {projects.map((item) => (
                    <ListBox.Item id={item.id} key={item.id} textValue={item.name}>
                      <span className="settings-git-repository-option">
                        <OverflowTooltip text={item.name} />
                        <OverflowTooltip as="small" text={item.path} />
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <FetchPreference key={project.path} path={project.path} />
        </div>
      )}
    </SettingsSection>
  )
}

function FetchPreference({ path }: { path: string }) {
  const t = useT()
  const minutes = useGitFetchInterval(path)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <>
      <div className="settings-row">
        <div className="settings-row-text">
          <span id="settings-git-fetch-label">{t('source.autoFetch')}</span>
          <p className="settings-help">{t('source.autoFetchHelp')}</p>
        </div>
        <Select
          className="settings-git-select"
          aria-labelledby="settings-git-fetch-label"
          variant="secondary"
          value={String(minutes)}
          onChange={(key) => {
            try {
              saveFetchInterval(path, Number(key))
              setError(false)
              setSaved(true)
            } catch {
              setError(true)
              setSaved(false)
            }
          }}
        >
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover placement="bottom end">
            <ListBox>
              {fetchIntervals.map((value) => (
                <ListBox.Item
                  id={String(value)}
                  key={value}
                  textValue={
                    value ? t('source.fetchInterval', { minutes: value }) : t('source.autoFetchOff')
                  }
                >
                  {value ? t('source.fetchInterval', { minutes: value }) : t('source.autoFetchOff')}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      {error ? (
        <p className="settings-git-feedback is-error" role="alert">
          {t('source.fetchPreferenceFailed')}
        </p>
      ) : saved ? (
        <p className="settings-git-feedback" role="status">
          {t('source.fetchPreferenceSaved')}
        </p>
      ) : null}
    </>
  )
}
