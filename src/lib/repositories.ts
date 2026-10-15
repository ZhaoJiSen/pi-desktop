import { Channel, invoke } from '@tauri-apps/api/core'
import { isDesktop, useWorkspace } from '../store/workspace'
import { t } from './i18n'

export interface CloneProgress {
  taskId: string
  stage: 'connecting' | 'receiving' | 'resolving' | 'checkout' | 'finalizing'
  percent?: number
}

function hasControl(value: string): boolean {
  return [...value].some(
    (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
  )
}

export function repositoryUrl(value: string): string | null {
  const input = value.trim()
  if (!input || input.length > 4096 || /\s/.test(input) || hasControl(input)) return null
  if (/^[\w.-]+@[\w.-]+:[\w./~-]+$/.test(input)) {
    return input.split(':')[1].split('/').filter(Boolean).length >= 1 ? input : null
  }
  try {
    if (!/^(https|ssh):\/\//.test(input)) return null
    const url = new URL(input)
    if (
      !['https:', 'ssh:'].includes(url.protocol) ||
      !url.hostname ||
      url.password ||
      (url.protocol === 'https:' && url.username) ||
      url.search ||
      url.hash ||
      !url.pathname.split('/').filter(Boolean).length
    )
      return null
    return input
  } catch {
    return null
  }
}

export function repositoryName(url: string): string {
  const part = url.replace(/\/+$/, '').split(/[/:]/).pop() || ''
  try {
    return [...decodeURIComponent(part).replace(/\.git$/i, '')]
      .map((character) =>
        hasControl(character) || /[<>:"/\\|?*]/.test(character) ? '-' : character,
      )
      .join('')
  } catch {
    return ''
  }
}

export function validRepositoryName(value: string): boolean {
  return Boolean(
    value &&
    value === value.trim() &&
    new TextEncoder().encode(value).length <= 120 &&
    !/[<>:"/\\|?*]/.test(value) &&
    !hasControl(value) &&
    !/[. ]$/.test(value) &&
    !/^\.{1,2}$/.test(value) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value),
  )
}

export function cloneTarget(parent: string, name: string): string {
  const separator = /^[a-z]:\\|^\\\\/i.test(parent) ? '\\' : '/'
  return `${parent.replace(/[\\/]+$/, '')}${separator}${name}`
}

export function cloneError(reason: unknown): string {
  const code = typeof reason === 'object' && reason !== null && 'code' in reason ? reason.code : ''
  switch (code) {
    case 'invalidUrl':
      return t('clone.invalidUrl')
    case 'invalidName':
      return t('clone.invalidName')
    case 'conflict':
      return t('clone.conflict')
    case 'parent':
      return t('clone.parentError')
    case 'gitMissing':
      return t('clone.gitMissing')
    case 'auth':
      return t('clone.authError')
    case 'network':
      return t('clone.networkError')
    case 'notFound':
      return t('clone.notFound')
    case 'busy':
      return t('clone.busy')
    default:
      return t('clone.failed')
  }
}

export function projectOperationsLocked(): boolean {
  const state = useWorkspace.getState()
  return state.piUpdating || Boolean(state.runningSessionId) || state.connection === 'connecting'
}

export async function cloneRepository(
  taskId: string,
  url: string,
  parent: string,
  name: string,
  onProgress: (progress: CloneProgress) => void,
): Promise<string | null> {
  if (!isDesktop) throw new Error(t('clone.desktopOnly'))
  if (projectOperationsLocked()) throw Object.assign(new Error(t('clone.busy')), { code: 'busy' })
  if (!repositoryUrl(url))
    throw Object.assign(new Error(t('clone.invalidUrl')), { code: 'invalidUrl' })
  if (!validRepositoryName(name))
    throw Object.assign(new Error(t('clone.invalidName')), { code: 'invalidName' })
  const channel = new Channel<CloneProgress>()
  let settled = false
  channel.onmessage = (event) => {
    if (!settled && event.taskId === taskId) onProgress(event)
  }
  try {
    return await invoke<string | null>('clone_repository', {
      taskId,
      url,
      parent,
      name,
      onProgress: channel,
    })
  } finally {
    settled = true
  }
}

export async function cancelClone(taskId: string): Promise<void> {
  await invoke('cancel_clone', { taskId })
}

const PARENT_KEY = 'pi-desktop.clone-parent'
export function lastCloneParent(): string {
  try {
    return localStorage.getItem(PARENT_KEY) || '~/Projects'
  } catch {
    return '~/Projects'
  }
}
export function rememberCloneParent(parent: string): void {
  try {
    localStorage.setItem(PARENT_KEY, parent)
  } catch {
    /* Optional preference; project persistence is separate. */
  }
}
