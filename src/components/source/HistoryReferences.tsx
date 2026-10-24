import { GitBranch, Tag } from 'lucide-react'
import { historyReferences } from '../../lib/source/historyLabels'
import { OverflowTooltip } from '../OverflowTooltip'

export function HistoryReferences({ refs }: { refs: string }) {
  const items = historyReferences(refs)
  return (
    <OverflowTooltip
      className="git-ref-label"
      text={refs}
      tooltip={
        <span className="git-ref-tooltip-list">
          {items.map((item) => (
            <span className="git-ref-tooltip-item git-kind" data-kind={item.kind} key={item.raw}>
              {item.kind === 'tag' ? <Tag /> : <GitBranch />}
              <span>{item.raw}</span>
            </span>
          ))}
        </span>
      }
    >
      {items.map((item, index) => (
        <span className="git-ref-token git-kind" data-kind={item.kind} key={item.raw}>
          {index > 0 && <span className="git-ref-comma">, </span>}
          {item.kind === 'tag' && <Tag aria-label="tag" />}
          <span>{item.label}</span>
        </span>
      ))}
    </OverflowTooltip>
  )
}
