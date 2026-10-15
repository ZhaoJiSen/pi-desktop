import { useEffect, useRef, useState } from 'react'
import {
  inspectPiEnvironment,
  chooseOnboardingProject,
  onboardingDefaultPath,
  prepareOnboardingWorkspace,
  type OnboardingProject,
  type PiEnvironment,
  type PiDiagnosis,
} from '../../lib/onboarding'
import { errorText } from '../../lib/utils'
import { useWorkspace } from '../../store/workspace'
import { checkPiUpdate, suppressPiUpdatePrompt, type PiUpdate } from '../../lib/piUpdates'

export const steps = ['welcome', 'environment', 'project'] as const

export function useOnboarding(onEnter: (connect: boolean) => void) {
  const completed = useWorkspace((s) => s.onboardingCompleted)
  const executable = useWorkspace((s) => s.piExecutable)
  const updating = useWorkspace((s) => s.piUpdating)
  const [update, setUpdate] = useState<PiUpdate | null>(null)
  const [step, setStep] = useState(0)
  const [path, setPath] = useState(executable)
  const [environment, setEnvironment] = useState<PiEnvironment | null>(null)
  const [diagnosis, setDiagnosis] = useState<PiDiagnosis | null>(null)
  const [installBusy, setInstallBusy] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState('')
  const [project, setProject] = useState<OnboardingProject | null>(null)
  const [defaultPath, setDefaultPath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const lifecycleRef = useRef({ alive: true })
  const operation = useRef(false)
  useEffect(() => {
    const lifecycle = lifecycleRef.current
    lifecycle.alive = true
    void suppressPiUpdatePrompt().catch(() => {})
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
  function acceptDiagnosis(report: PiDiagnosis) {
    setDiagnosis(report)
    setEnvironment(report.kind === 'ready' ? report.environment : null)
    if (report.environment) setDefaultPath(report.environment.defaultWorkspace)
  }
  async function detect(selectedPath = path) {
    if (updating || installBusy) return
    const request = ++generation.current
    setChecking(true)
    setCheckError('')
    setEnvironment(null)
    setDiagnosis(null)
    setUpdate(null)
    try {
      const report = await inspectPiEnvironment(selectedPath)
      if (!lifecycleRef.current.alive || request !== generation.current) return
      acceptDiagnosis(report)
      const result = report.kind === 'ready' ? report.environment : null
      if (!result) return
      void checkPiUpdate(result.executable)
        .then((available) => {
          if (lifecycleRef.current.alive && request === generation.current && available?.hasUpdate)
            setUpdate(available)
        })
        .catch(() => {})
    } catch (reason) {
      if (lifecycleRef.current.alive && request === generation.current)
        setCheckError(errorText(reason))
    } finally {
      if (lifecycleRef.current.alive && request === generation.current) setChecking(false)
    }
  }
  async function chooseProject() {
    if (operation.current || updating || installBusy) return
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
    if (operation.current || updating || installBusy) return
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
  function changePath(value: string) {
    generation.current++
    setChecking(false)
    setPath(value)
    setEnvironment(null)
    setDiagnosis(null)
    setUpdate(null)
    setCheckError('')
  }
  function acceptInstallation(report: PiDiagnosis) {
    const request = ++generation.current
    acceptDiagnosis(report)
    if (report.environment) {
      setPath(report.environment.executable)
      void checkPiUpdate(report.environment.executable)
        .then((available) => {
          if (lifecycleRef.current.alive && request === generation.current && available?.hasUpdate)
            setUpdate(available)
        })
        .catch(() => {})
    }
  }
  return {
    completed,
    updating,
    update,
    setUpdate,
    step,
    setStep,
    path,
    setPath,
    environment,
    diagnosis,
    installBusy,
    setInstallBusy,
    checking,
    checkError,
    project,
    setProject,
    defaultPath,
    busy,
    error,
    setError,
    detect,
    chooseProject,
    finish,
    changePath,
    acceptInstallation,
  }
}

export type OnboardingController = ReturnType<typeof useOnboarding>
