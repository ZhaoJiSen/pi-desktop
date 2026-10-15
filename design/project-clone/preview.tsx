// Visual fixture only: production components with deterministic native responses.
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/styles/vendor.css'
import '../../src/styles/index.scss'

const params = new URLSearchParams(location.search)
const scenario = params.get('scenario') || 'form'
let complete: ((value: null) => void) | undefined
let callback = 0
Object.assign(window, {
  __TAURI_INTERNALS__: {
    transformCallback: () => ++callback,
    unregisterCallback: () => {},
    invoke: async (command: string, args: Record<string, unknown>) => {
      if (command === 'cancel_clone') {
        complete?.(null)
        return
      }
      if (command !== 'clone_repository') return
      if (scenario === 'error') throw { code: 'auth' }
      const channel = args.onProgress as { onmessage: (event: unknown) => void }
      channel.onmessage({ taskId: args.taskId, stage: 'receiving', percent: 42 })
      return new Promise<null>((resolve) => {
        complete = resolve
      })
    },
  },
})
const { useWorkspace } = await import('../../src/store/workspace')
useWorkspace.setState({
  language: params.get('lang') === 'en' ? 'en' : 'zh',
  runningSessionId: null,
  piUpdating: false,
  connection: 'disconnected',
})
document.documentElement.dataset.theme = params.get('theme') || 'dark'
const { CloneRepositoryDialog } = await import('../../src/components/CloneRepositoryDialog')
createRoot(document.getElementById('root')!).render(
  createElement(CloneRepositoryDialog, {
    initialUrl: 'https://github.com/pi-desktop/workspace.git',
    onClose: () => {},
  }),
)
