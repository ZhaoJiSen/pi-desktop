import { Button, Description, Input, Label, TextField } from '@heroui/react'
import { useT } from '../../lib/i18n'
import { PiUpdateContent } from '../../components/PiUpdateDialog'
import { PiInstallPanel } from '../../components/PiInstallPanel'
import { EnvironmentStatus } from './EnvironmentStatus'
import type { OnboardingController } from './useOnboarding'

export function EnvironmentStep({
  updating,
  installBusy,
  path,
  checking,
  detect,
  environment,
  diagnosis,
  checkError,
  setPath,
  changePath,
  update,
  setUpdate,
  setInstallBusy,
  acceptInstallation,
}: Pick<
  OnboardingController,
  | 'updating'
  | 'installBusy'
  | 'path'
  | 'checking'
  | 'detect'
  | 'environment'
  | 'diagnosis'
  | 'checkError'
  | 'setPath'
  | 'changePath'
  | 'update'
  | 'setUpdate'
  | 'setInstallBusy'
  | 'acceptInstallation'
>) {
  const t = useT()
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void detect()
        }}
      >
        <TextField
          fullWidth
          isDisabled={updating || installBusy}
          className="onboarding-executable"
          value={path}
          onChange={changePath}
        >
          <Label>{t('settings.executable')}</Label>
          <div className="onboarding-path-row">
            <Input
              id="onboarding-executable"
              className="onboarding-path"
              variant="secondary"
              placeholder="pi"
              spellCheck={false}
            />
            <Button
              type="submit"
              variant="secondary"
              isDisabled={checking || updating || installBusy}
            >
              {t(checking ? 'onboarding.checking' : 'onboarding.detect')}
            </Button>
          </div>
          <Description>{t('settings.executableHelp')}</Description>
        </TextField>
      </form>
      <EnvironmentStatus
        environment={environment}
        checkError={checkError}
        diagnosis={diagnosis}
        checking={checking}
        setPath={setPath}
        detect={detect}
      />
      {update && (
        <section className="pi-update-inline" aria-label={t('piUpdate.title')}>
          <h2>{t('piUpdate.title')}</h2>
          <PiUpdateContent
            update={update}
            onUpdated={(result) => {
              setUpdate(null)
              void detect(result.executable)
            }}
          />
        </section>
      )}
      {(diagnosis?.kind === 'missing' || diagnosis?.canRepair) && !checking && (
        <PiInstallPanel
          key={path}
          executable={path}
          onBusyChange={setInstallBusy}
          onInstalled={acceptInstallation}
        />
      )}
      {(checkError ||
        (diagnosis &&
          diagnosis.kind !== 'ready' &&
          diagnosis.kind !== 'missing' &&
          !diagnosis.canRepair)) && (
        <div className="onboarding-recovery">
          <p>{t('onboarding.recovery')}</p>
          <p>
            {t('onboarding.verifyTerminal')} <code>pi --version</code>
          </p>
          <p>
            {t('onboarding.installHelp')}{' '}
            <a href="https://pi.dev/" target="_blank" rel="noreferrer">
              pi.dev ↗
            </a>
          </p>
        </div>
      )}
    </>
  )
}
