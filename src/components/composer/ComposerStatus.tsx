import { Button, Popover } from '@heroui/react'
import { GitBranch } from 'lucide-react'
import type { Project, Usage } from '../../types'
import { useT } from '../../lib/i18n'
import { cost, tokens } from '../../lib/utils'
import { isRecentProject } from '../../lib/recentProject'

export function ComposerStatus({ project, usage }: { project?: Project; usage: Usage }) {
  const t = useT()
  const context = usage.contextPercent === null ? '—' : `${Math.round(usage.contextPercent)}%`
  return (
    <div className="composer-status" aria-label={t('composer.status')}>
      <span className="composer-branch">
        {project?.branch && !isRecentProject(project) && (
          <>
            <GitBranch />
            <span title={project.branch}>{project.branch}</span>
          </>
        )}
      </span>
      <Popover>
        <Button variant="ghost" className="composer-usage" aria-label={t('composer.usageDetails')}>
          <span>
            {t('usage.context')} {context}
          </span>
          <span className="optional-token">·</span>
          <span className="optional-token">
            {tokens(usage.total)} {t('usage.tokenUnit')}
          </span>
          <span>·</span>
          <span>
            {t('usage.estimate')} {cost(usage.cost)}
          </span>
        </Button>
        <Popover.Content placement="top end" className="composer-usage-popover">
          <Popover.Dialog aria-label={t('composer.usageDetails')}>
            <span>
              {t('usage.context')} <strong>{context}</strong>
            </span>
            <span>
              {t('usage.tokenUnit')} <strong>{tokens(usage.total)}</strong>
            </span>
            <span>
              {t('usage.estimate')} <strong>{cost(usage.cost)}</strong>
            </span>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    </div>
  )
}
