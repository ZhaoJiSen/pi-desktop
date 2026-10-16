import { Alert, Button, Skeleton } from '@heroui/react'
import { Check, CircleAlert, Terminal } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { OnboardingController } from './useOnboarding'

export function EnvironmentStatus({
  environment,
  checkError,
  diagnosis,
  checking,
  setPath,
  detect,
}: Pick<
  OnboardingController,
  'environment' | 'checkError' | 'diagnosis' | 'checking' | 'setPath' | 'detect'
>) {
  const t = useT()
  return (
    <Alert
      className="onboarding-check"
      status={environment ? 'success' : checkError || diagnosis ? 'danger' : 'default'}
      aria-live="polite"
      aria-busy={checking}
    >
      <Alert.Indicator>
        {checking ? (
          <Skeleton animationType="pulse" className="onboarding-check-mark" aria-hidden="true" />
        ) : environment ? (
          <Check />
        ) : checkError ? (
          <CircleAlert />
        ) : (
          <Terminal />
        )}
      </Alert.Indicator>
      <Alert.Content>
        {checking ? (
          <>
            <span className="sr-only">{t('onboarding.checking')}</span>
            <div className="onboarding-check-skeleton" aria-hidden="true">
              <Skeleton animationType="pulse" className="onboarding-check-line is-title" />
              <Skeleton animationType="pulse" className="onboarding-check-line is-meta" />
              <Skeleton animationType="pulse" className="onboarding-check-line is-path" />
            </div>
          </>
        ) : environment ? (
          <>
            <Alert.Title>{t('onboarding.available')}</Alert.Title>
            <Alert.Description>
              Pi {environment.version}
              {environment.nodeVersion ? ` · Node ${environment.nodeVersion}` : ''}
            </Alert.Description>
            <code>{environment.executable}</code>
            {diagnosis?.kind === 'ready' && (
              <>
                {diagnosis.compatibility === 'verified' && (
                  <p className="pi-environment-note">{t('piEnvironment.verified')}</p>
                )}
                {diagnosis.pathRecovered && (
                  <p className="pi-environment-note">{t('piEnvironment.pathRecovered')}</p>
                )}
                {diagnosis.authentication === 'missing' && (
                  <>
                    <p className="pi-environment-note">{t('piEnvironment.authMissing')}</p>
                    <a
                      href="https://pi.dev/docs/latest/quickstart#3-choose-a-model"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t('piEnvironment.authHelp')} ↗
                    </a>
                  </>
                )}
              </>
            )}
          </>
        ) : diagnosis ? (
          <>
            <Alert.Title>
              {t(`piEnvironment.${diagnosis.kind === 'ready' ? 'rpcError' : diagnosis.kind}`)}
            </Alert.Title>
            {diagnosis.environment && (
              <Alert.Description>
                Pi {diagnosis.environment.version} · {diagnosis.environment.executable}
              </Alert.Description>
            )}
            {diagnosis.detail && <Alert.Description>{diagnosis.detail}</Alert.Description>}
            {diagnosis.compatibility === 'unsupported' && (
              <Alert.Description>{t('piEnvironment.unsupported')}</Alert.Description>
            )}
            {diagnosis.discoveredExecutable && (
              <>
                <code>{diagnosis.discoveredExecutable}</code>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setPath(diagnosis.discoveredExecutable!)
                    void detect(diagnosis.discoveredExecutable!)
                  }}
                >
                  {t('piEnvironment.useDiscovered')}
                </Button>
              </>
            )}
          </>
        ) : checkError ? (
          <>
            <Alert.Title>{t('onboarding.unavailable')}</Alert.Title>
            <Alert.Description>
              <span role="alert">{checkError}</span>
            </Alert.Description>
          </>
        ) : (
          <Alert.Description>{t('onboarding.checkHint')}</Alert.Description>
        )}
      </Alert.Content>
    </Alert>
  )
}
