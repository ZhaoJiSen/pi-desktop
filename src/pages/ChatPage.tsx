import { Composer } from '../components/Composer'
import { Conversation } from '../components/Conversation'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { useWorkspaceActions } from '../layouts/WorkspaceActions'
import { useWorkspace } from '../store/workspace'

export function ChatPage() {
  const active = useWorkspace((state) => state.activeSessionId)
  const { onProject } = useWorkspaceActions()
  return (
    <>
      <Conversation onProject={onProject} />
      <div className="composer-area">
        <ConnectionNotice />
        <Composer key={active} />
      </div>
    </>
  )
}
