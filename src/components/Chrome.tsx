import { Button } from '@heroui/react'
import { PanelLeft } from 'lucide-react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'

export function WindowControls() {
  return isDesktop ? <div className="native-controls-space" aria-hidden="true" /> : <div className="traffic" aria-hidden="true"><i /><i /><i /></div>
}

export function SidebarToggle() {
  const open = useWorkspace(state => state.sidebarOpen)
  const toggle = useWorkspace(state => state.toggleSidebar)
  const t = useT()
  return <Button isIconOnly variant="ghost" className="icon-button sidebar-toggle" onPress={toggle} aria-label={t(open ? '折叠侧栏' : '展开侧栏')}><PanelLeft /></Button>
}
