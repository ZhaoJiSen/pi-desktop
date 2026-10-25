import { Alert, Button, Popover } from '@heroui/react'
import { Info, X } from 'lucide-react'
import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { UsageComposition } from './UsageComposition'
import { UsageTrend } from './UsageTrend'
import { UsageHeatmap } from './UsageHeatmap'
import { money } from './usageData'
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
  chosen,
  rows,
  partTotal,
  selectedDay,
  selectDay,
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
  | 'chosen'
  | 'rows'
  | 'partTotal'
  | 'selectedDay'
  | 'selectDay'
>) {
  const t = useT()
  return (
    <>
      <div className="usage-summary">
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
        </dl>

        <UsageHeatmap
          sessions={chosen}
          daySessions={rows.length}
          selectedDay={scope === 'all' ? selectedDay : null}
          onSelectDay={scope === 'all' ? selectDay : undefined}
        />
        <div className="usage-visualizations">
          <UsageTrend
            sessions={chosen}
            selectedDay={scope === 'all' ? selectedDay : null}
            onSelectDay={scope === 'all' ? selectDay : undefined}
          />
          <UsageComposition total={total} partTotal={partTotal} />
        </div>
      </div>
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
    </>
  )
}
