import { Button, Tooltip } from '@heroui/react'
import { ChartNoAxesCombined, Grid2X2, House, Settings, Terminal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useT } from '../lib/i18n'
import { useCurrentPage } from '../router/hooks'
import { navigateToPage } from '../router/navigation'
import type { Page } from '../router/paths'

interface RailItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  onPress: () => void
}

function RailItem({ icon: Icon, label, active, onPress }: RailItemProps) {
  return (
    <Tooltip delay={450}>
      <Tooltip.Trigger role="presentation" tabIndex={-1}>
        <Button
          isIconOnly
          variant="ghost"
          className="rail-item"
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          onPress={onPress}
        >
          {active && (
            <motion.span
              className="rail-selection"
              layoutId="rail-selection"
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            />
          )}
          <Icon />
        </Button>
      </Tooltip.Trigger>
      <Tooltip.Content placement="right" offset={10}>
        {label}
      </Tooltip.Content>
    </Tooltip>
  )
}

export function ActivityRail() {
  const view = useCurrentPage()
  const t = useT()
  const item = (page: Page, icon: LucideIcon, label: string) => (
    <RailItem
      icon={icon}
      label={label}
      active={view === page}
      onPress={() => void navigateToPage(page)}
    />
  )
  return (
    <motion.nav
      className="activity-rail"
      aria-label={t('navigation.label')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rail-primary">
        {item('chat', House, t('navigation.home'))}
        {item('extensions', Grid2X2, t('navigation.extensions'))}
        {item('commands', Terminal, t('navigation.commands'))}
        {item('usage', ChartNoAxesCombined, t('navigation.usage'))}
      </div>
      <div className="rail-bottom">{item('settings', Settings, t('navigation.settings'))}</div>
    </motion.nav>
  )
}
