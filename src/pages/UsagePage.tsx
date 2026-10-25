import { useLayoutEffect, useRef } from 'react'
import { Button, Tabs } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import { useT } from '../lib/i18n'
import { selectChat } from '../router/navigation'
import { OverflowTooltip } from '../components/OverflowTooltip'
import { useUsagePage } from './usage/useUsagePage'
import { usageScroll } from './usage/usageViewState'
import { UsageOverview } from './usage/UsageOverview'
import { UsageConversations } from './usage/UsageConversations'
import { UsageEmpty } from './usage/UsageEmpty'

export function UsagePage() {
  const view = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (view.current) view.current.scrollTop = usageScroll.read()
  }, [])
  const controller = useUsagePage()
  const {
    scope,
    changeScope,
    emptyView,
    session,
    known,
    projectName,
    chosen,
    recorded,
    activeProject,
  } = controller
  const t = useT()
  return (
    <div
      ref={view}
      onScroll={(event) => usageScroll.remember(event.currentTarget.scrollTop)}
      className={`utility-view usage-view${emptyView ? ' is-empty' : ''}`}
    >
      <Tabs
        className="usage-content"
        selectedKey={scope}
        onSelectionChange={(key) => changeScope(key as typeof scope)}
      >
        <div className="usage-toolbar">
          <header className="usage-heading">
            <h1 className="utility-page-title">{t('navigation.usage')}</h1>
          </header>
          <div className="usage-toolbar-controls">
            <Tabs.List className="usage-scope" aria-label={t('usage.scope')}>
              {(['current', 'all'] as const).map((value) => (
                <Tabs.Tab key={value} id={value}>
                  {t(`sessions.${value}`)}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </div>
        </div>

        <Tabs.Panel id={scope}>
          <div className="usage-body">
            {known && (
              <div className="usage-session-heading">
                <div className="usage-context-copy">
                  <h2>
                    <OverflowTooltip
                      text={
                        scope === 'current' && session
                          ? session.title || t('sessions.new')
                          : t('sessions.all')
                      }
                    />
                  </h2>
                  <p>
                    <OverflowTooltip
                      text={
                        scope === 'current' && session
                          ? `${projectName(session)} · ${session.modelKey.split('/').slice(1).join('/') || t('usage.noModel')}`
                          : activeProject?.name || t('usage.allProjects')
                      }
                    />
                  </p>
                </div>
                {scope === 'current' && session ? (
                  <Button
                    variant="ghost"
                    className="usage-open"
                    onPress={() => selectChat(session.id)}
                  >
                    {t('usage.openConversation')}
                    <ArrowRight aria-hidden="true" />
                  </Button>
                ) : (
                  <dl className="usage-recorded">
                    <dt>{t('usage.recordedSessions')}</dt>
                    <dd>
                      {recorded.length}
                      <span className="usage-count-unit">/ {chosen.length}</span>
                    </dd>
                  </dl>
                )}
              </div>
            )}

            {known && <UsageOverview {...controller} />}

            {scope === 'all' ? (
              <UsageConversations {...controller} />
            ) : (
              !known && <UsageEmpty session={session} projectName={projectName} />
            )}

            {scope === 'all' &&
              controller.selectedDay === null &&
              chosen.length > recorded.length && (
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
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
