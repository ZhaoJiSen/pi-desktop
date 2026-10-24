import { Chip } from '@heroui/react'
import { commitLabel } from '../../lib/source/historyLabels'
import { OverflowTooltip } from '../OverflowTooltip'

export function HistorySubject({ subject }: { subject: string }) {
  const label = commitLabel(subject)
  return (
    <>
      {label.prefix && (
        <Chip size="sm" variant="soft" className="git-kind git-subject-kind" data-kind={label.kind}>
          {label.kind}
        </Chip>
      )}
      <OverflowTooltip className="git-log-subject-text" text={subject}>
        {label.prefix
          .slice(label.kind.length)
          .trimStart()
          .replace(/^[:：]\s*/, '')}
        {label.message}
      </OverflowTooltip>
    </>
  )
}
