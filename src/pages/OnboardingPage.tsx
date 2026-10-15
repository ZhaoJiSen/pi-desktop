import { motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { WindowControls } from '../components/Chrome'
import { useT } from '../lib/i18n'
import { useOnboarding, steps } from './onboarding/useOnboarding'
import { OnboardingIntro } from './onboarding/OnboardingIntro'
import { WelcomeStep } from './onboarding/WelcomeStep'
import { EnvironmentStep } from './onboarding/EnvironmentStep'
import { ProjectStep } from './onboarding/ProjectStep'
import { OnboardingActions } from './onboarding/OnboardingActions'

export function OnboardingPage({ onEnter }: { onEnter: (connect: boolean) => void }) {
  const t = useT()
  const controller = useOnboarding(onEnter)
  const { step, error } = controller
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [step])
  return (
    <div className="onboarding-screen" data-step={steps[step]}>
      <header className="onboarding-chrome" data-tauri-drag-region="deep">
        <WindowControls />
      </header>
      <motion.div
        className="onboarding-body"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <OnboardingIntro step={step} />
        <section className="onboarding-panel" aria-labelledby="onboarding-title">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="onboarding-step-content"
          >
            <h1 id="onboarding-title" ref={heading} tabIndex={-1}>
              {t(`onboarding.title.${steps[step]!}`)}
            </h1>
            <p className="onboarding-description">{t(`onboarding.description.${steps[step]!}`)}</p>
            {step === 0 && <WelcomeStep />}
            {step === 1 && <EnvironmentStep {...controller} />}
            {step === 2 && <ProjectStep {...controller} />}
          </motion.div>
          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}
          <OnboardingActions {...controller} />
        </section>
      </motion.div>
    </div>
  )
}
