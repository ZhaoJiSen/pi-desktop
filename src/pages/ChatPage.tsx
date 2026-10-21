import { useQuestions } from '../components/conversation/QuestionContext'
import { Composer } from '../components/Composer'
import { Conversation } from '../components/Conversation'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { useSource } from '../components/source/context'
import { SourcePanel } from '../components/source/SourcePanel'
import { useWorkspaceActions } from '../layouts/WorkspaceActions'
import { useWorkspace } from '../store/workspace'

export function ChatPage() {
  const active = useWorkspace((state) => state.activeSessionId)
  const { questions } = useQuestions()
  const hasQuestion = questions.some(
    (item) =>
      item.request.sessionId === active || (!item.request.sessionId && item.status === 'pending'),
  )
  const centered = useWorkspace((state) => {
    const session = state.sessions.find((item) => item.id === state.activeSessionId)
    return Boolean(session && session.messages.length === 0)
  })
  const { onProject } = useWorkspaceActions()
  const source = useSource()
  return (
    <div className={source?.open ? 'chat-stage has-source' : 'chat-stage'}>
      <div className={centered && !hasQuestion ? 'chat-page is-empty' : 'chat-page'}>
        <Conversation onProject={onProject} />
        <div className="composer-area">
          <ConnectionNotice />
          <Composer key={active} />
        </div>
      </div>
      {source?.open && <SourcePanel />}
    </div>
  )
}
