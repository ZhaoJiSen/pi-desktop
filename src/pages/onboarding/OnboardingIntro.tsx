import { Chip } from '@heroui/react'
import { Check } from 'lucide-react'
import { PiLogo } from '../../components/PiLogo'
import { useT } from '../../lib/i18n'
import { steps } from './useOnboarding'

export function OnboardingIntro({ step }: { step: number }) {
  const t = useT()
  return (
    <aside className="onboarding-intro">
      <PiLogo size={48} />
      <span className="onboarding-product">Pi Desktop</span>
      <p>{t('onboarding.tagline')}</p>
      <ol className="onboarding-steps" aria-label={t('onboarding.progress')}>
        {steps.map((name, index) => {
          const active = step === index
          const done = step > index
          return (
            <li
              key={name}
              aria-current={active ? 'step' : undefined}
              data-active={active}
              data-done={done}
            >
              <Chip
                className="onboarding-step-mark"
                size="sm"
                color={active ? 'accent' : done ? 'success' : 'default'}
                variant={active ? 'primary' : done ? 'soft' : 'tertiary'}
              >
                {done ? <Check /> : index + 1}
              </Chip>
              <span>{t(`onboarding.step.${name}`)}</span>
            </li>
          )
        })}
      </ol>
    </aside>
  )
}
