import { Button, Description, Input, Label, TextField } from '@heroui/react'
import { Check, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { connectSession } from '../../lib/desktop'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'
import { SettingsSection } from './SettingsSection'

export function ConnectionSettings() {
  const executable = useWorkspace((state) => state.piExecutable)
  const remembered = useWorkspace((state) => state.lastCustomPiExecutable)
  const active = useWorkspace((state) => state.activeSessionId)
  const connection = useWorkspace((state) => state.connection)
  const running = useWorkspace((state) => state.runningSessionId)
  const setPreference = useWorkspace((state) => state.setPreference)
  const storageError = useWorkspace((state) => state.storageError)
  const [path, setPath] = useState(executable)
  const [customPath, setCustomPath] = useState(executable !== 'pi' ? executable : remembered)
  const [outcome, setOutcome] = useState<'saved' | 'reconnected' | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const pathTouched = useRef(false)
  useEffect(() => {
    if (!pathTouched.current) setPath(executable)
  }, [executable])
  const t = useT()
  const busy = Boolean(running) || connection === 'connecting'
  const draft = path.trim() || 'pi'
  const dirty = draft !== executable
  const rowError = storageError || saveError
  function editPath(value: string) {
    pathTouched.current = true
    setPath(value)
    if (value.trim() && value.trim() !== 'pi') setCustomPath(value.trim())
    setOutcome(null)
    setSaveError(null)
  }
  async function save() {
    if (busy) return
    const next = path.trim() || 'pi'
    pathTouched.current = true
    setPath(next)
    setOutcome(null)
    setSaveError(null)
    const previous = useWorkspace.getState()
    useWorkspace.setState({ storageError: null })
    setPreference({ piExecutable: next, lastCustomPiExecutable: next === 'pi' ? customPath : next })
    await Promise.resolve()
    const stored = useWorkspace.getState()
    if (stored.storageError) {
      useWorkspace.setState({
        piExecutable: previous.piExecutable,
        lastCustomPiExecutable: previous.lastCustomPiExecutable,
      })
      return
    }
    if (!active || stored.piUpdating) {
      setOutcome('saved')
      return
    }
    await connectSession(active, true)
    const after = useWorkspace.getState()
    if (after.storageError) return
    if (after.connection === 'connected') {
      setOutcome('reconnected')
      return
    }
    if (after.connectionError || after.connection === 'error') {
      setSaveError(after.connectionError || t('connection.failed'))
      return
    }
    setOutcome('saved')
  }
  return (
    <SettingsSection id="settings-connection" title={t('settings.connection')}>
      <p className="settings-status" role="status">
        <span>{t(`settings.status.${connection}`)}</span>
        <span className="settings-status-sep" aria-hidden="true">
          ·
        </span>
        <span className="settings-status-path">{executable}</span>
        {dirty && <span className="settings-status-flag">{t('settings.unapplied')}</span>}
      </p>
      <form
        className="connection-form"
        onSubmit={(event) => {
          event.preventDefault()
          void save()
        }}
      >
        <TextField fullWidth value={path} onChange={editPath}>
          <Label>{t('settings.executable')}</Label>
          <Input
            variant="secondary"
            className="settings-path"
            placeholder="pi"
            spellCheck={false}
          />
          <Description>{t('settings.executableHelp')}</Description>
        </TextField>
        {rowError && (
          <p className="settings-error" role="alert">
            {rowError}
          </p>
        )}
        {busy && (
          <p id="settings-reconnect-busy" className="settings-help settings-busy">
            {t('settings.reconnectBusy')}
          </p>
        )}
        <div className="settings-save-row">
          <Button
            type="button"
            variant="secondary"
            isDisabled={busy || (draft === 'pi' && !customPath)}
            onPress={() => editPath(draft === 'pi' ? customPath : 'pi')}
          >
            <RotateCcw aria-hidden="true" />
            {t(
              draft === 'pi' && customPath
                ? 'settings.restoreCustomExecutable'
                : 'settings.restoreExecutable',
            )}
          </Button>
          <div className="settings-save-actions">
            <span className="settings-saved" role="status">
              {outcome && !rowError && (
                <span key={outcome} className="settings-saved-result">
                  <Check aria-hidden="true" />
                  {t(outcome === 'reconnected' ? 'settings.reconnected' : 'settings.saved')}
                </span>
              )}
            </span>
            <Button
              type="submit"
              isDisabled={busy}
              aria-describedby={busy ? 'settings-reconnect-busy' : undefined}
            >
              <RotateCcw aria-hidden="true" />
              {t('settings.saveReconnect')}
            </Button>
          </div>
        </div>
      </form>
    </SettingsSection>
  )
}
