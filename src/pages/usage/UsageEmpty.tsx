import { Button } from '@heroui/react'
import { ArrowRight, ChartNoAxesColumn } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { selectChat } from '../../router/navigation'
import type { UsageController } from './useUsagePage'

export function UsageEmpty({
  session,
  projectName,
}: Pick<UsageController, 'session' | 'projectName'>) {
  const t = useT()
  return (
    <div className="usage-empty" role="status">
      <ChartNoAxesColumn aria-hidden="true" />
      <h3>{t(session ? 'usage.noUsage' : 'usage.noSession')}</h3>
      <p>{t(session ? 'usage.noCurrentUsageHint' : 'usage.noSessionHint')}</p>
      {session && (
        <p className="usage-empty-context">
          {session.title || t('sessions.new')}
          <span aria-hidden="true"> · </span>
          {projectName(session)}
        </p>
      )}
      {session && (
        <Button variant="secondary" onPress={() => selectChat(session.id)}>
          {t('usage.openConversation')}
          <ArrowRight aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}
