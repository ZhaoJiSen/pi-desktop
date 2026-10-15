import { motion, useReducedMotion } from 'motion/react'
import { SidebarLayout } from '../layouts/SidebarLayout'
import { useT } from '../lib/i18n'
import { CommandsBrowser } from './commands/CommandsBrowser'
import { CommandDetail } from './commands/CommandDetail'
import { CommandEmpty } from './commands/CommandFeedback'
import { useCommandsPage, type CommandServices } from './commands/useCommandsPage'

export function CommandsPage({ services }: { services?: CommandServices }) {
  const t = useT()
  const reducedMotion = useReducedMotion()
  const controller = useCommandsPage(services)
  const { connected, item } = controller
  return (
    <motion.div
      className={`utility-view commands-view ${connected ? '' : 'is-empty'}`}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {!connected ? (
        <CommandEmpty title={t('commands.disconnected')} detail={t('commands.connectHint')} />
      ) : (
        <SidebarLayout
          className="commands-workspace"
          collapseAt={780}
          label={t('layout.resizeCommands')}
          sidebar={<CommandsBrowser {...controller} />}
        >
          {item && <CommandDetail {...controller} item={item} />}
        </SidebarLayout>
      )}
    </motion.div>
  )
}
