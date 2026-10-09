import { Button, Tooltip } from '@heroui/react'
import { PanelLeft } from 'lucide-react'
import { isDesktop, useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'

export function WindowControls() {
  return isDesktop ? (
    <div className="native-controls-space" aria-hidden="true" />
  ) : (
    <div className="traffic" aria-hidden="true">
      <i />
      <i />
      <i />
    </div>
  )
}

export function SidebarToggle() {
  const open = useWorkspace((state) => state.sidebarOpen)
  const toggle = useWorkspace((state) => state.toggleSidebar)
  const t = useT()
  const label = t(open ? 'sidebar.collapse' : 'sidebar.expand')
  return (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1} data-tauri-drag-region="false">
        <Button
          isIconOnly
          variant="ghost"
          className="icon-button sidebar-toggle"
          data-tauri-drag-region="false"
          onPress={toggle}
          aria-label={label}
        >
          <PanelLeft />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
    </Tooltip>
  )
}
