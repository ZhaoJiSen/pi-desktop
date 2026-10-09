import { Button } from '@heroui/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FolderOpen,
  MessageSquare,
  Puzzle,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { PiLogo } from '../components/PiLogo'
import { WindowControls } from '../components/Chrome'
import { useT } from '../lib/i18n'
import {
  checkPiEnvironment,
  chooseOnboardingProject,
  onboardingDefaultPath,
  prepareOnboardingWorkspace,
  type OnboardingProject,
  type PiEnvironment,
} from '../lib/onboarding'
import { errorText } from '../lib/utils'
import { useWorkspace } from '../store/workspace'

const steps = ['welcome', 'environment', 'project'] as const
export function OnboardingPage({ onEnter }: { onEnter: (connect: boolean) => void }) {
  const t = useT()
  const completed = useWorkspace((s) => s.onboardingCompleted)
  const executable = useWorkspace((s) => s.piExecutable)
  const language = useWorkspace((s) => s.language)
  const theme = useWorkspace((s) => s.theme)
  const [step, setStep] = useState(0)
  const [path, setPath] = useState(executable)
  const [environment, setEnvironment] = useState<PiEnvironment | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [project, setProject] = useState<OnboardingProject | null>(null)
  const [defaultPath, setDefaultPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const lifecycleRef = useRef({ alive: true })
  const heading = useRef<HTMLHeadingElement>(null)
  const operation = useRef(false)
  useEffect(() => {
    const lifecycle = lifecycleRef.current
    lifecycle.alive = true
    let cancelled = false
    void onboardingDefaultPath()
      .then((value) => {
        if (!cancelled) setDefaultPath(value)
      })
      .catch(() => {})
    return () => {
      cancelled = true
      lifecycle.alive = false
    }
  }, [])
  useEffect(() => {
    heading.current?.focus()
  }, [step])
  async function detect() {
    const request = ++generation.current
    setChecking(true)
    setCheckError('')
    setEnvironment(null)
    try {
      const result = await checkPiEnvironment(path)
      if (!lifecycleRef.current.alive || request !== generation.current) return
      setEnvironment(result)
      setDefaultPath(result.defaultWorkspace)
    } catch (reason) {
      if (lifecycleRef.current.alive && request === generation.current)
        setCheckError(errorText(reason))
    } finally {
      if (lifecycleRef.current.alive && request === generation.current) setChecking(false)
    }
  }
  async function chooseProject() {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setError('')
    try {
      const selected = await chooseOnboardingProject()
      if (selected) setProject(selected)
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  async function finish(skip = false) {
    if (operation.current) return
    operation.current = true
    setBusy(true)
    setError('')
    try {
      if (!skip) await prepareOnboardingWorkspace(project)
      const store = useWorkspace.getState()
      store.setPreference({ piExecutable: environment?.executable || path.trim() || 'pi' })
      onEnter(Boolean(environment))
      store.completeOnboarding()
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      operation.current = false
      setBusy(false)
    }
  }
  return (
    <div className="onboarding-screen" data-step={steps[step]}>
      <header className="onboarding-chrome" data-tauri-drag-region="deep">
        <WindowControls />
        <div className="onboarding-preferences" data-tauri-drag-region="false">
          <select
            aria-label={t('settings.language')}
            value={language}
            onChange={(e) =>
              useWorkspace.getState().setPreference({ language: e.target.value as 'zh' | 'en' })
            }
          >
            <option value="zh">简体中文</option>
            <option value="en">English</option>
          </select>
          <select
            aria-label={t('settings.appearance')}
            value={theme}
            onChange={(e) =>
              useWorkspace
                .getState()
                .setPreference({ theme: e.target.value as 'light' | 'dark' | 'system' })
            }
          >
            {(['light', 'dark', 'system'] as const).map((value) => (
              <option key={value} value={value}>
                {t(`settings.theme.${value}`)}
              </option>
            ))}
          </select>
        </div>
      </header>
      <motion.div
        className="onboarding-body"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <aside className="onboarding-intro">
          <PiLogo size={48} />
          <span className="onboarding-product">Pi Desktop</span>
          <p>{t('onboarding.tagline')}</p>
          <ol className="onboarding-steps" aria-label={t('onboarding.progress')}>
            {steps.map((name, index) => (
              <li
                key={name}
                aria-current={step === index ? 'step' : undefined}
                data-active={step === index}
                data-done={step > index}
              >
                <span>{step > index ? <Check /> : index + 1}</span>
                {t(`onboarding.step.${name}`)}
              </li>
            ))}
          </ol>
        </aside>
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
            {step === 0 && (
              <div className="onboarding-features">
                {(
                  [
                    { icon: MessageSquare, name: 'sessions' },
                    { icon: Puzzle, name: 'management' },
                    { icon: RefreshCw, name: 'sync' },
                  ] as const
                ).map(({ icon: Icon, name }) => (
                  <div key={name}>
                    <Icon />
                    <div>
                      <h2>{t(`onboarding.feature.${name}`)}</h2>
                      <p>{t(`onboarding.feature.${name}Help`)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {step === 1 && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void detect()
                  }}
                >
                  <label className="field-label" htmlFor="onboarding-executable">
                    {t('settings.executable')}
                  </label>
                  <div className="onboarding-path-row">
                    <input
                      id="onboarding-executable"
                      className="field-input"
                      value={path}
                      placeholder="pi"
                      onChange={(e) => {
                        generation.current++
                        setChecking(false)
                        setPath(e.target.value)
                        setEnvironment(null)
                        setCheckError('')
                      }}
                    />
                    <Button type="submit" variant="secondary" isDisabled={checking}>
                      {t(checking ? 'onboarding.checking' : 'onboarding.detect')}
                    </Button>
                  </div>
                </form>
                <p className="onboarding-path-help">{t('settings.executableHelp')}</p>
                <div className="onboarding-check" aria-live="polite" aria-busy={checking}>
                  {checking ? (
                    <>
                      <PiLogo size={24} loading />
                      <span>{t('onboarding.checking')}</span>
                    </>
                  ) : environment ? (
                    <>
                      <Check />
                      <div>
                        <strong>{t('onboarding.available')}</strong>
                        <p>
                          Pi {environment.version}
                          {environment.nodeVersion ? ` · Node ${environment.nodeVersion}` : ''}
                        </p>
                        <code>{environment.executable}</code>
                      </div>
                    </>
                  ) : checkError ? (
                    <>
                      <CircleAlert />
                      <div>
                        <strong>{t('onboarding.unavailable')}</strong>
                        <p role="alert">{checkError}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <Terminal />
                      <span>{t('onboarding.checkHint')}</span>
                    </>
                  )}
                </div>
                {checkError && (
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
            )}
            {step === 2 && (
              <>
                <div className="onboarding-project-options">
                  <Button
                    variant="secondary"
                    className="onboarding-project-option"
                    aria-pressed={Boolean(project)}
                    onPress={() => void chooseProject()}
                    isDisabled={busy}
                  >
                    <FolderOpen />
                    <span>
                      <strong>{t('onboarding.chooseProject')}</strong>
                      <small>{project?.path || t('onboarding.chooseProjectHelp')}</small>
                    </span>
                    {project && <Check />}
                  </Button>
                  <Button
                    variant="secondary"
                    className="onboarding-project-option"
                    aria-pressed={!project}
                    onPress={() => setProject(null)}
                    isDisabled={busy}
                  >
                    <MessageSquare />
                    <span>
                      <strong>{t('onboarding.defaultWorkspace')}</strong>
                      <small>{defaultPath || t('onboarding.defaultWorkspaceHelp')}</small>
                    </span>
                    {!project && <Check />}
                  </Button>
                </div>
                <p className="onboarding-path-help">{t('onboarding.projectHelp')}</p>
                {!environment && <p className="onboarding-offline">{t('onboarding.offline')}</p>}
              </>
            )}
          </motion.div>
          {error && (
            <p className="onboarding-error" role="alert">
              {error}
            </p>
          )}
          <footer className="onboarding-actions">
            <Button
              variant="ghost"
              isDisabled={busy || checking}
              onPress={() =>
                completed ? useWorkspace.getState().closeOnboarding() : void finish(true)
              }
            >
              {t(completed ? 'onboarding.close' : 'onboarding.skip')}
            </Button>
            <div>
              {step > 0 && (
                <Button
                  variant="ghost"
                  isDisabled={busy || checking}
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
                <Button variant="ghost" isDisabled={busy || checking} onPress={() => setStep(2)}>
                  {t('onboarding.configureLater')}
                </Button>
              )}
              <Button
                className="onboarding-primary"
                isDisabled={busy || checking || (step === 1 && !environment)}
                onPress={() => {
                  if (step === 2) void finish()
                  else {
                    setStep(step + 1)
                    if (step === 0) void detect()
                  }
                }}
              >
                {t(
                  busy
                    ? 'onboarding.preparing'
                    : step === 2
                      ? 'onboarding.start'
                      : 'onboarding.continue',
                )}
                <ArrowRight />
              </Button>
            </div>
          </footer>
        </section>
      </motion.div>
    </div>
  )
}
