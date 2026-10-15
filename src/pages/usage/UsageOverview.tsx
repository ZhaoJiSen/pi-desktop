import { Alert, Button, Popover } from '@heroui/react'
import { Info, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { money, parts } from './usageData'
import type { UsageController } from './useUsagePage'

export function UsageOverview({
  noticeDismissed,
  dismissCostNotice,
  costHelpOpen,
  setCostHelpOpen,
  costHelpButton,
  known,
  total,
  scope,
  recorded,
  chosen,
  partTotal,
}: Pick<
  UsageController,
  | 'noticeDismissed'
  | 'dismissCostNotice'
  | 'costHelpOpen'
  | 'setCostHelpOpen'
  | 'costHelpButton'
  | 'known'
  | 'total'
  | 'scope'
  | 'recorded'
  | 'chosen'
  | 'partTotal'
>) {
  const t = useT()
  return (
    <>
      {!noticeDismissed && (
        <Alert
          className="usage-cost-notice"
          status="default"
          role="note"
          aria-label={t('usage.aboutCosts')}
        >
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t('usage.costNotice')}</Alert.Description>
          </Alert.Content>
          <Button
            isIconOnly
            variant="ghost"
            className="usage-notice-close"
            aria-label={t('usage.dismissCostNotice')}
            onPress={dismissCostNotice}
          >
            <X aria-hidden="true" />
          </Button>
        </Alert>
      )}
      <dl className="usage-overview" aria-label={t('usage.overview')}>
        <div className="usage-primary">
          <dt>
            {t('usage.estimatedCost')}
            <span className="usage-currency">USD</span>
            <Popover isOpen={costHelpOpen} onOpenChange={setCostHelpOpen}>
              <Button
                ref={costHelpButton}
                isIconOnly
                variant="ghost"
                className="usage-cost-help"
                aria-label={t('usage.aboutCosts')}
              >
                <Info aria-hidden="true" />
              </Button>
              <Popover.Content className="usage-cost-popover" placement="bottom start" offset={8}>
                <Popover.Dialog aria-label={t('usage.aboutCosts')}>
                  <Popover.Heading>{t('usage.aboutCosts')}</Popover.Heading>
                  <p>{t('usage.sourceNote')}</p>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          </dt>
          <dd>{known ? money(total.cost) : '—'}</dd>
        </div>
        <div>
          <dt>{t('usage.totalTokens')}</dt>
          <dd title={known ? total.total.toLocaleString() : undefined}>
            {known ? tokens(total.total) : '—'}
          </dd>
        </div>
        {scope === 'all' && (
          <div>
            <dt>{t('usage.recordedSessions')}</dt>
            <dd>
              {recorded.length}
              <span className="usage-count-unit">/ {chosen.length}</span>
            </dd>
          </div>
        )}
      </dl>

      <section className="usage-composition" aria-label={t('usage.composition')}>
        <div className="usage-part-track" aria-hidden="true">
          {parts.map((key) => (
            <span
              key={key}
              className={`usage-part-${key}`}
              style={{ flexGrow: partTotal ? total[key] / partTotal : 0 }}
            />
          ))}
        </div>
        <dl className="usage-parts">
          {parts.map((key) => (
            <div key={key}>
              <dt>
                <span className={`usage-dot usage-part-${key}`} aria-hidden="true" />
                {t(`usage.${key}`)}
              </dt>
              <dd title={known ? total[key].toLocaleString() : undefined}>
                {known ? tokens(total[key]) : '—'}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  )
}
