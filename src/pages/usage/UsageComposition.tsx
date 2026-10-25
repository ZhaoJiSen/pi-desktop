import { useT } from '../../lib/i18n'
import { tokens } from '../../lib/utils'
import { parts } from './usageData'
import type { UsageController } from './useUsagePage'

export function UsageComposition({
  total,
  partTotal,
}: Pick<UsageController, 'total' | 'partTotal'>) {
  const t = useT()
  return (
    <section className="usage-composition usage-chart-panel" aria-label={t('usage.composition')}>
      <header className="usage-chart-heading">
        <h3>{t('usage.composition')}</h3>
      </header>
      <dl className="usage-parts">
        {parts.map((key) => {
          const share = partTotal ? (total[key] / partTotal) * 100 : 0
          const percentage = share > 0 && share < 0.1 ? '<0.1%' : `${Number(share.toFixed(1))}%`
          return (
            <div key={key}>
              <dt>
                <span className={`usage-dot usage-part-${key}`} aria-hidden="true" />
                {t(`usage.${key}`)}
              </dt>
              <dd title={total[key].toLocaleString()}>
                {tokens(total[key])}
                <span className="usage-part-share">{percentage}</span>
              </dd>
            </div>
          )
        })}
      </dl>
    </section>
  )
}
