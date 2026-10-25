import { Button, Tooltip } from '@heroui/react'
import { ChartNoAxesCombined, Grid2X2, GitBranch, House, Settings, Terminal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { LayoutGroup, motion } from 'motion/react'
import { useId } from 'react'
import { useT } from '../lib/i18n'
import { useCurrentPage } from '../router/hooks'
import { navigateToPage } from '../router/navigation'
import type { Page } from '../router/paths'
import { preloadPage } from '../router/preload'
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference'

interface RailItemProps {
  icon: LucideIcon
  label: string
  active?: boolean
  onPress: () => void
  onPreload: () => void
  reduced: boolean
}

function RailItem({ icon: Icon, label, active, onPress, onPreload, reduced }: RailItemProps) {
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
          onHoverStart={onPreload}
          onFocus={onPreload}
        >
          {active &&
            (reduced ? (
              <span className="rail-selection" />
            ) : (
              <motion.span
                className="rail-selection"
                layoutId="rail-selection"
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            ))}
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
  const id = useId()
  const reduced = useReducedMotionPreference()
  const view = useCurrentPage()
  const t = useT()
  const item = (page: Page, icon: LucideIcon, label: string) => (
    <RailItem
      icon={icon}
      label={label}
      active={view === page}
      reduced={reduced}
      onPress={() => void navigateToPage(page)}
      onPreload={() => preloadPage(page)}
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
      <LayoutGroup id={id}>
        <div className="rail-primary">
          {item('chat', House, t('navigation.home'))}
          {item('git', GitBranch, t('source.workspace'))}
          {item('extensions', Grid2X2, t('navigation.extensions'))}
          {item('commands', Terminal, t('navigation.commands'))}
          {item('usage', ChartNoAxesCombined, t('navigation.usage'))}
        </div>
        <div className="rail-bottom">{item('settings', Settings, t('navigation.settings'))}</div>
      </LayoutGroup>
    </motion.nav>
  )
}
