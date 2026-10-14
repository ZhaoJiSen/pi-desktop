import {
  Alert,
  Button,
  Chip,
  Description,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Skeleton,
  TextField,
} from '@heroui/react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  FolderOpen,
  MessageSquare,
  Puzzle,
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
      onEnter(!skip && Boolean(environment))
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
              <ListBox
                className="onboarding-features"
                aria-label={t('onboarding.title.welcome')}
                selectionMode="none"
              >
                {(
                  [
                    { icon: MessageSquare, name: 'sessions' },
                    { icon: Puzzle, name: 'management' },
                    { icon: Terminal, name: 'commands' },
                  ] as const
                ).map(({ icon: Icon, name }) => (
                  <ListBox.Item
                    key={name}
                    id={name}
                    textValue={`${t(`onboarding.feature.${name}`)} ${t(`onboarding.feature.${name}Help`)}`}
                    className="onboarding-feature"
                  >
                    <Icon />
                    <span>
                      <span className="onboarding-feature-title">
                        {t(`onboarding.feature.${name}`)}
                      </span>
                      <span className="onboarding-feature-help">
                        {t(`onboarding.feature.${name}Help`)}
                      </span>
                    </span>
                  </ListBox.Item>
                ))}
              </ListBox>
            )}
            {step === 1 && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void detect()
                  }}
                >
                  <TextField
                    fullWidth
                    className="onboarding-executable"
                    value={path}
                    onChange={(value) => {
                      generation.current++
                      setChecking(false)
                      setPath(value)
                      setEnvironment(null)
                      setCheckError('')
                    }}
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
                      <Button type="submit" variant="secondary" isDisabled={checking}>
                        {t(checking ? 'onboarding.checking' : 'onboarding.detect')}
                      </Button>
                    </div>
                    <Description>{t('settings.executableHelp')}</Description>
                  </TextField>
                </form>
                <Alert
                  className="onboarding-check"
                  status={environment ? 'success' : checkError ? 'danger' : 'default'}
                  aria-live="polite"
                  aria-busy={checking}
                >
                  <Alert.Indicator>
                    {checking ? (
                      <Skeleton
                        animationType="pulse"
                        className="onboarding-check-mark"
                        aria-hidden="true"
                      />
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
                          <Skeleton
                            animationType="pulse"
                            className="onboarding-check-line is-title"
                          />
                          <Skeleton
                            animationType="pulse"
                            className="onboarding-check-line is-meta"
                          />
                          <Skeleton
                            animationType="pulse"
                            className="onboarding-check-line is-path"
                          />
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
                <RadioGroup
                  aria-label={t('onboarding.title.project')}
                  className="onboarding-project-options"
                  value={project ? 'folder' : 'default'}
                  isDisabled={busy}
                  onChange={(value) => {
                    if (value === 'default') setProject(null)
                  }}
                >
                  <Radio
                    value="folder"
                    className="onboarding-project-option"
                    onPointerUp={(event) => {
                      if (busy || event.button !== 0) return
                      void chooseProject()
                    }}
                    onKeyDown={(event) => {
                      if (busy || (event.key !== 'Enter' && event.key !== ' ')) return
                      event.preventDefault()
                      void chooseProject()
                    }}
                  >
                    <Radio.Content className="onboarding-project-option-content">
                      <FolderOpen />
                      <span className="onboarding-project-option-copy">
                        <strong>{t('onboarding.chooseProject')}</strong>
                        <small>{project?.path || t('onboarding.chooseProjectHelp')}</small>
                      </span>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                    </Radio.Content>
                  </Radio>
                  <Radio value="default" className="onboarding-project-option">
                    <Radio.Content className="onboarding-project-option-content">
                      <MessageSquare />
                      <span className="onboarding-project-option-copy">
                        <strong>{t('onboarding.defaultWorkspace')}</strong>
                        <small>{defaultPath || t('onboarding.defaultWorkspaceHelp')}</small>
                      </span>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                    </Radio.Content>
                  </Radio>
                </RadioGroup>
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
