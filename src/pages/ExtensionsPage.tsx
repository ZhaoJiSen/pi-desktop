import { useWorkspace } from '../store/workspace'
import { ExtensionPackages } from '../components/ExtensionPackages'

export function ExtensionsPage() {
  const sessionId = useWorkspace((state) => state.activeSessionId)
  return (
    <div className="utility-view packages-view">
      <ExtensionPackages key={sessionId} />
    </div>
  )
}
