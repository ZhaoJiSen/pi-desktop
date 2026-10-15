import { AlertDialog, Button, ProgressBar } from '@heroui/react'
import { Download } from 'lucide-react'
import { useRef, useState } from 'react'
import { isDesktop } from '../store/workspace'
import { useT } from '../lib/i18n'
import {
  installPi,
  preparePiInstall,
  type PiDiagnosis,
  type PiInstallPlan,
  type PiInstallProgress,
} from '../lib/onboarding'
import { errorText } from '../lib/utils'

export function PiInstallPanel({
  executable,
  onInstalled,
  onBusyChange,
}: {
  executable: string
  onInstalled: (report: PiDiagnosis) => void
  onBusyChange: (busy: boolean) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [plan, setPlan] = useState<PiInstallPlan | null>(null)
  const [phase, setPhase] = useState<'preparing' | PiInstallProgress['stage'] | null>(null)
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const working = useRef(false)
  async function prepare() {
    if (working.current) return
    working.current = true
    setOpen(true)
    setPlan(null)
    setPhase('preparing')
    setError('')
    onBusyChange(true)
    try {
      setPlan(await preparePiInstall(executable))
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      working.current = false
      setPhase(null)
      onBusyChange(false)
    }
  }
  async function install() {
    if (working.current || !plan) return
    working.current = true
    setPhase('installing')
    setError('')
    setOutput('')
    onBusyChange(true)
    try {
      const report = await installPi(plan.id, (event) => {
        setPhase(event.stage)
        if (event.text) setOutput((current) => (current + event.text).slice(-32768))
      })
      setOpen(false)
      onInstalled(report)
    } catch (reason) {
      // A plan is single use. A retry must review a newly prepared command.
      setPlan(null)
      setError(errorText(reason))
    } finally {
      working.current = false
      setPhase(null)
      onBusyChange(false)
    }
  }
  function close() {
    if (!working.current) setOpen(false)
  }
  return (
    <>
      <section className="pi-install-entry" aria-label={t('piInstall.title')}>
        <p>{t('piInstall.intro')}</p>
        <div className="pi-install-entry-actions">
          <Button
            variant="secondary"
            isDisabled={Boolean(phase)}
            onPress={() => {
              setOutput('')
              void prepare()
            }}
          >
            {t('piInstall.review')}
          </Button>
          <a href="https://pi.dev/docs/latest/quickstart" target="_blank" rel="noreferrer">
            {t('piInstall.manual')} ↗
          </a>
        </div>
      </section>
      <AlertDialog.Backdrop
        isOpen={open}
        isDismissable={false}
        isKeyboardDismissDisabled={Boolean(phase)}
        onOpenChange={(value) => {
          if (!value) close()
        }}
        className="dialog-backdrop"
      >
        <AlertDialog.Container size="lg">
          {isDesktop && (
            <div className="pi-install-drag-region" data-tauri-drag-region aria-hidden="true" />
          )}
          <AlertDialog.Dialog className="pi-install-dialog" aria-busy={Boolean(phase)}>
            <AlertDialog.Header>
              <AlertDialog.Icon status="accent">
                <Download aria-hidden="true" />
              </AlertDialog.Icon>
              <AlertDialog.Heading>{t('piInstall.title')}</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body className="pi-install-panel">
              <p>{t('piInstall.intro')}</p>
              <p>{t('piInstall.requirements')}</p>
              {plan && (
                <details className="pi-install-plan" open={!phase}>
                  <summary>{t('piInstall.details')}</summary>
                  <dl>
                    <div>
                      <dt>{t('piInstall.source')}</dt>
                      <dd>
                        <a
                          href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"
                          target="_blank"
                          rel="noreferrer"
                        >
                          @earendil-works/pi-coding-agent
                        </a>
                        <br />
                        {plan.source}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('piInstall.version')}</dt>
                      <dd>
                        Pi {plan.version} · Node {plan.nodeVersion}
                      </dd>
                    </div>
                    <div>
                      <dt>{t('piInstall.directory')}</dt>
                      <dd>{plan.directory}</dd>
                    </div>
                  </dl>
                  <p>{t('piInstall.effects')}</p>
                  <pre className="pi-install-command" aria-label={t('piInstall.command')}>
                    <code>{plan.command}</code>
                  </pre>
                </details>
              )}
              {phase && (
                <div className="pi-install-progress">
                  <p role="status">
                    {t(
                      phase === 'preparing'
                        ? 'piInstall.preparing'
                        : phase === 'verifying'
                          ? 'piInstall.verifying'
                          : 'piInstall.installing',
                    )}
                  </p>
                  <ProgressBar aria-label={t('piInstall.progress')} isIndeterminate size="sm">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>
              )}
              {output && (
                <details open className="pi-install-output">
                  <summary>{t('piInstall.output')}</summary>
                  <pre tabIndex={0}>{output}</pre>
                </details>
              )}
              {error && (
                <p className="onboarding-error" role="alert">
                  {error}
                </p>
              )}

              <div className="pi-install-help">
                <a href="https://pi.dev/docs/latest/quickstart" target="_blank" rel="noreferrer">
                  {t('piInstall.manual')} ↗
                </a>
                {error && (
                  <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">
                    {t('piInstall.nodeHelp')} ↗
                  </a>
                )}
              </div>
            </AlertDialog.Body>
            <AlertDialog.Footer className="pi-install-actions">
              <Button variant="secondary" isDisabled={Boolean(phase)} onPress={close}>
                {t('piInstall.cancel')}
              </Button>
              {plan ? (
                <Button isPending={Boolean(phase)} onPress={() => void install()}>
                  {t(
                    phase === 'verifying'
                      ? 'piInstall.verifying'
                      : phase === 'installing'
                        ? 'piInstall.installing'
                        : 'piInstall.confirm',
                  )}
                </Button>
              ) : (
                <Button isDisabled={Boolean(phase)} onPress={() => void prepare()}>
                  {t(error ? 'piInstall.retry' : 'piInstall.review')}
                </Button>
              )}
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  )
}
