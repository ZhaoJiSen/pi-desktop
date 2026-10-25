import { useT } from '../../lib/i18n'
import { SkeletonBar } from './SkeletonBar'

export function UsagePageSkeleton() {
  const t = useT()
  return (
    <div className="utility-view usage-view">
      <div className="usage-content">
        <div className="usage-toolbar">
          <header className="usage-heading">
            <h1 className="utility-page-title">{t('navigation.usage')}</h1>
          </header>
          <SkeletonBar width="180px" className="workspace-skeleton-control" />
        </div>
        <div className="usage-body">
          <div className="usage-session-heading">
            <div className="workspace-skeleton-copy">
              <SkeletonBar width="220px" />
              <SkeletonBar width="160px" />
            </div>
          </div>
          <div className="usage-summary">
            <dl className="usage-overview">
              <div className="usage-primary">
                <dt>
                  {t('usage.estimatedCost')}
                  <span className="usage-currency">USD</span>
                </dt>
                <dd>
                  <SkeletonBar width="100px" />
                </dd>
              </div>
              <div>
                <dt>{t('usage.totalTokens')}</dt>
                <dd>
                  <SkeletonBar width="100px" />
                </dd>
              </div>
            </dl>
            <section className="usage-heatmap usage-chart-panel">
              <header className="usage-chart-heading">
                <h3>{t('usage.annualUsage')}</h3>
              </header>
              <p className="usage-heatmap-period">
                <SkeletonBar width="210px" />
              </p>
              <div className="usage-heatmap-summary">
                <SkeletonBar width="65%" />
              </div>
              <SkeletonBar className="workspace-skeleton-calendar" />
              <div className="usage-heatmap-bottom">
                <div className="usage-heatmap-inspection">
                  <SkeletonBar width="70%" />
                </div>
              </div>
              <p className="usage-heatmap-pan">{t('usage.panYear')}</p>
            </section>
            <div className="usage-visualizations">
              <section className="usage-trend usage-chart-panel">
                <header className="usage-chart-heading">
                  <h3>{t('usage.dailyUsage')}</h3>
                </header>
                <SkeletonBar className="workspace-skeleton-chart" />
              </section>
              <section className="usage-composition usage-chart-panel">
                <header className="usage-chart-heading">
                  <h3>{t('usage.composition')}</h3>
                </header>
                <SkeletonBar className="workspace-skeleton-chart" />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
