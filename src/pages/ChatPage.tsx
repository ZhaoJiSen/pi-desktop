import { useQuestions } from '../components/conversation/QuestionContext'
import { Composer } from '../components/Composer'
import { Conversation } from '../components/Conversation'
import { ConnectionNotice } from '../components/ConnectionNotice'
import { ChatStage } from '../layouts/ChatStage'
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
  return (
    <ChatStage empty={centered && !hasQuestion}>
      <Conversation onProject={onProject} />
      <div className="composer-area">
        <ConnectionNotice />
        <Composer key={active} />
      </div>
    </ChatStage>
  )
}
