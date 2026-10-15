import { Button, Tabs } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useT } from '../lib/i18n'
import { selectChat } from '../router/navigation'
import { useUsagePage } from './usage/useUsagePage'
import { UsageOverview } from './usage/UsageOverview'
import { UsageConversations } from './usage/UsageConversations'
import { UsageProjectFilter } from './usage/UsageProjectFilter'
import { UsageEmpty } from './usage/UsageEmpty'

export function UsagePage() {
  const controller = useUsagePage()
  const {
    scope,
    changeScope,
    showAllTools,
    emptyView,
    session,
    known,
    projectName,
    chosen,
    recorded,
  } = controller
  const reducedMotion = useReducedMotion()
  const t = useT()
  return (
    <motion.div
      className={`utility-view usage-view${emptyView ? ' is-empty' : ''}`}
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="usage-heading">
        <h1 className="utility-page-title">{t('navigation.usage')}</h1>
      </header>
      <Tabs
        className="usage-content"
        selectedKey={scope}
        onSelectionChange={(key) => changeScope(key as typeof scope)}
      >
        <div className="usage-toolbar">
          <Tabs.List className="usage-scope" aria-label={t('usage.scope')}>
            {(['current', 'all'] as const).map((value) => (
              <Tabs.Tab key={value} id={value}>
                {t(`sessions.${value}`)}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
          {scope === 'all' && showAllTools && <UsageProjectFilter {...controller} />}
        </div>

        <Tabs.Panel key={scope} id={scope}>
          <motion.div
            className="usage-body"
            key={scope}
            initial={reducedMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16 }}
          >
            {scope === 'current' && session && known && (
              <div className="usage-session-heading">
                <div>
                  <h2>{session.title || t('sessions.new')}</h2>
                  <p>
                    {projectName(session)}
                    <span aria-hidden="true"> · </span>
                    {session.modelKey.split('/').slice(1).join('/') || t('usage.noModel')}
                  </p>
                </div>
                {known && (
                  <Button
                    variant="ghost"
                    className="usage-open"
                    onPress={() => selectChat(session.id)}
                  >
                    {t('usage.openConversation')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                )}
              </div>
            )}

            {known && <UsageOverview {...controller} />}

            {scope === 'all' ? (
              <UsageConversations {...controller} />
            ) : (
              !known && <UsageEmpty session={session} projectName={projectName} />
            )}

            {scope === 'all' && chosen.length > recorded.length && (
              <footer className="usage-footnote">
                <p>
                  {t(
                    chosen.length - recorded.length === 1
                      ? 'usage.missingUsage.one'
                      : 'usage.missingUsage.other',
                    { count: chosen.length - recorded.length },
                  )}
                </p>
              </footer>
            )}
          </motion.div>
        </Tabs.Panel>
      </Tabs>
    </motion.div>
  )
}
