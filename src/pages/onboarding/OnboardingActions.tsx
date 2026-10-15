import { Button } from '@heroui/react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { useWorkspace } from '../../store/workspace'
import type { OnboardingController } from './useOnboarding'

export function OnboardingActions({
  completed,
  busy,
  checking,
  updating,
  installBusy,
  finish,
  step,
  setStep,
  setError,
  environment,
  detect,
}: Pick<
  OnboardingController,
  | 'completed'
  | 'busy'
  | 'checking'
  | 'updating'
  | 'installBusy'
  | 'finish'
  | 'step'
  | 'setStep'
  | 'setError'
  | 'environment'
  | 'detect'
>) {
  const t = useT()
  return (
    <footer className="onboarding-actions">
      <Button
        variant="ghost"
        isDisabled={busy || checking || updating || installBusy}
        onPress={() => (completed ? useWorkspace.getState().closeOnboarding() : void finish(true))}
      >
        {t(completed ? 'onboarding.close' : 'onboarding.skip')}
      </Button>
      <div>
        {step > 0 && (
          <Button
            variant="ghost"
            isDisabled={busy || checking || updating || installBusy}
            onPress={() => {
              setStep(step - 1)
              setError('')
            }}
          >
            <ArrowLeft />
            {t('onboarding.back')}
          </Button>
        )}
        {step === 1 && !environment && (
          <Button
            variant="ghost"
            isDisabled={busy || checking || updating || installBusy}
            onPress={() => setStep(2)}
          >
            {t('onboarding.configureLater')}
          </Button>
        )}
        <Button
          className="onboarding-primary"
          isDisabled={busy || checking || updating || installBusy || (step === 1 && !environment)}
          onPress={() => {
            if (step === 2) void finish()
            else {
              setStep(step + 1)
              if (step === 0) void detect()
            }
          }}
        >
          {t(
            busy ? 'onboarding.preparing' : step === 2 ? 'onboarding.start' : 'onboarding.continue',
          )}
          <ArrowRight />
        </Button>
      </div>
    </footer>
  )
}
