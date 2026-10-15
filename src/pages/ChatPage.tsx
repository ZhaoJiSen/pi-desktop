import { Composer } from '../components/Composer'
import { Conversation } from '../components/Conversation'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { useWorkspaceActions } from '../layouts/WorkspaceActions'
import { useWorkspace } from '../store/workspace'

export function ChatPage() {
  const active = useWorkspace((state) => state.activeSessionId)
  const centered = useWorkspace((state) => {
    const session = state.sessions.find((item) => item.id === state.activeSessionId)
    return Boolean(session && session.messages.length === 0)
  })
  const { onProject } = useWorkspaceActions()
  return (
    <div className={centered ? 'chat-page is-empty' : 'chat-page'}>
      <Conversation onProject={onProject} />
      <div className="composer-area">
        <ConnectionNotice />
        <Composer key={active} />
      </div>
    </div>
  )
}
