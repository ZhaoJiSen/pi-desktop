import { Button, FieldError, Input, Label, Modal, ProgressBar, TextField } from '@heroui/react'
import { open } from '@tauri-apps/plugin-dialog'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../lib/i18n'
import { openProject } from '../lib/desktop'
import { projectPath } from '../lib/projectPaths'
import {
  cancelClone,
  cloneError,
  cloneRepository,
  cloneTarget,
  lastCloneParent,
  rememberCloneParent,
  repositoryName,
  repositoryUrl,
  validRepositoryName,
  type CloneProgress,
} from '../lib/repositories'
import { navigateToPage } from '../router/navigation'
import { isDesktop } from '../store/workspace'

export function CloneRepositoryDialog({
  initialUrl = '',
  onClose,
}: {
  initialUrl?: string
  onClose: () => void
}) {
  const t = useT()
  const [url, setUrl] = useState(initialUrl)
  const [parent, setParent] = useState(lastCloneParent)
  const [name, setName] = useState(repositoryName(initialUrl))
  const nameEdited = useRef(false)
  const task = useRef<string | null>(null)
  const [progress, setProgress] = useState<CloneProgress | null>(null)
  const [pending, setPending] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [clonedPath, setClonedPath] = useState<string | null>(null)
  const [touched, setTouched] = useState({ url: false, parent: false, name: false })
  const busy = pending || choosing
  const valid = Boolean(repositoryUrl(url) && projectPath(parent) && validRepositoryName(name))

  useEffect(
    () => () => {
      const active = task.current
      task.current = null
      if (active) void cancelClone(active).catch(() => {})
    },
    [],
  )

  async function openCloned(path: string) {
    const id = await openProject(path)
    if (!task.current) return
    if (!id) throw new Error('busy')
    await navigateToPage('chat')
    onClose()
  }

  async function submit() {
    if (task.current || busy || (!clonedPath && !valid) || !isDesktop) return
    const id = crypto.randomUUID()
    task.current = id
    setPending(true)
    setProgress(null)
    setError('')
    setNotice('')
    try {
      if (clonedPath) {
        await openCloned(clonedPath)
        return
      }
      const path = await cloneRepository(id, url.trim(), parent.trim(), name, (event) => {
        if (task.current === id) setProgress(event)
      })
      if (task.current !== id) return
      if (!path) {
        setNotice(t('clone.cancelled'))
        return
      }
      setClonedPath(path)
      rememberCloneParent(parent.trim())
      setProgress(null)
      try {
        await openCloned(path)
      } catch {
        setError(t('clone.openFailed'))
      }
    } catch (reason) {
      if (task.current === id) setError(clonedPath ? t('clone.openFailed') : cloneError(reason))
    } finally {
      if (task.current === id) {
        task.current = null
        setPending(false)
        setProgress(null)
        setCancelling(false)
      }
    }
  }

  async function chooseParent() {
    if (busy) return
    setChoosing(true)
    try {
      const selected = await open({ directory: true, multiple: false, title: t('clone.parent') })
      if (typeof selected === 'string') {
        setParent(selected)
        setError('')
      }
    } catch {
      setError(t('clone.parentError'))
    } finally {
      setChoosing(false)
    }
  }

  async function cancel() {
    if (!task.current || cancelling) return
    setCancelling(true)
    try {
      await cancelClone(task.current)
    } catch {
      setCancelling(false)
      setError(t('clone.failed'))
    }
  }

  const status = cancelling
    ? t('clone.cancelling')
    : clonedPath
      ? t('clone.opening')
      : t(`clone.${progress?.stage || 'connecting'}`)
  return (
    <Modal.Backdrop
      isOpen
      isDismissable={!busy}
      isKeyboardDismissDisabled={busy}
      onOpenChange={(value) => {
        if (!value && !busy) onClose()
      }}
      className="dialog-backdrop"
    >
      <Modal.Container size="sm">
        <Modal.Dialog className="form-dialog clone-dialog" aria-busy={pending}>
          <Modal.Header>
            <Modal.Heading>{t('clone.title')}</Modal.Heading>
            <Modal.CloseTrigger isDisabled={busy} aria-label={t('common.close')} />
          </Modal.Header>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <Modal.Body>
              <TextField
                value={url}
                isInvalid={touched.url && Boolean(url.trim()) && !repositoryUrl(url)}
                isDisabled={busy || Boolean(clonedPath)}
                onChange={(value) => {
                  setUrl(value)
                  setError('')
                  setNotice('')
                  if (!nameEdited.current) setName(repositoryName(value))
                }}
              >
                <Label>{t('clone.url')}</Label>
                <Input
                  autoFocus
                  placeholder="https://github.com/owner/repository.git"
                  spellCheck={false}
                  autoComplete="off"
                  onBlur={() => setTouched((value) => ({ ...value, url: true }))}
                />
                <FieldError>{t('clone.invalidUrl')}</FieldError>
              </TextField>
              <TextField
                value={parent}
                isInvalid={touched.parent && Boolean(parent.trim()) && !projectPath(parent)}
                isDisabled={busy || Boolean(clonedPath)}
                onChange={(value) => {
                  setParent(value)
                  setError('')
                }}
              >
                <Label>{t('clone.parent')}</Label>
                <div className="clone-location">
                  <Input
                    spellCheck={false}
                    onBlur={() => setTouched((value) => ({ ...value, parent: true }))}
                  />
                  <Button
                    variant="secondary"
                    isDisabled={busy || Boolean(clonedPath) || !isDesktop}
                    onPress={() => void chooseParent()}
                  >
                    {t('clone.choose')}
                  </Button>
                </div>
                <FieldError>{t('clone.parentError')}</FieldError>
              </TextField>
              <TextField
                value={name}
                isInvalid={touched.name && Boolean(name) && !validRepositoryName(name)}
                isDisabled={busy || Boolean(clonedPath)}
                onChange={(value) => {
                  nameEdited.current = true
                  setName(value)
                  setError('')
                }}
              >
                <Label>{t('clone.name')}</Label>
                <Input
                  spellCheck={false}
                  onBlur={() => setTouched((value) => ({ ...value, name: true }))}
                />
                <FieldError>{t('clone.invalidName')}</FieldError>
              </TextField>
              <p className="clone-target">
                <span>{t('clone.target')}</span>
                <span>{clonedPath || cloneTarget(parent, name)}</span>
              </p>
              <div className="clone-feedback">
                {pending && (
                  <div className="clone-progress">
                    <div className="clone-progress-label" role="status">
                      <span>{status}</span>
                      {progress?.percent !== undefined && !cancelling && (
                        <span>{progress.percent}%</span>
                      )}
                    </div>
                    <ProgressBar
                      aria-label={status}
                      isIndeterminate={progress?.percent === undefined || cancelling}
                      value={progress?.percent}
                      size="sm"
                    >
                      <ProgressBar.Track>
                        <ProgressBar.Fill />
                      </ProgressBar.Track>
                    </ProgressBar>
                  </div>
                )}
                {!isDesktop && <p className="clone-note">{t('clone.desktopOnly')}</p>}
                {notice && (
                  <p className="clone-note" role="status">
                    {notice}
                  </p>
                )}
                {error && (
                  <p className="clone-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              {pending ? (
                <Button
                  variant="secondary"
                  isDisabled={
                    !progress ||
                    progress.stage === 'finalizing' ||
                    cancelling ||
                    Boolean(clonedPath)
                  }
                  onPress={() => void cancel()}
                >
                  {cancelling ? t('clone.cancelling') : t('clone.cancel')}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" isDisabled={choosing} onPress={onClose}>
                    {t('common.cancel')}
                  </Button>
                  <Button
                    className="clone-submit"
                    type="submit"
                    isDisabled={choosing || !isDesktop || (!clonedPath && !valid)}
                  >
                    {t(clonedPath ? 'clone.retryOpen' : 'clone.submit')}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </form>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
