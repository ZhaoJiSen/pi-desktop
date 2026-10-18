import { memo } from 'react'
import { FileText } from 'lucide-react'
import { useT } from '../../lib/i18n'
import type { DiffLine } from '../../types'
import { Highlight, fileLanguage } from './Highlight'

export const Diff = memo(function Diff({ label, lines }: { label: string; lines: DiffLine[] }) {
  const t = useT()
  const adds = lines.filter((line) => line.kind === 'add').length
  const removes = lines.filter((line) => line.kind === 'remove').length
  return (
    <div className="diff">
      <div className="diff-header">
        <FileText />
        <span className="diff-file" title={label}>
          {label}
        </span>
        <span className="diff-stats">
          <span className="positive">+{adds}</span>
          {removes > 0 && <span className="negative">−{removes}</span>}
        </span>
        <span className="language">{label.split('.').at(-1)?.toUpperCase()}</span>
      </div>
      <div className="code" tabIndex={0} aria-label={t('tools.codeChanges', { file: label })}>
        {lines.map((line, index) => (
          <div className={`code-line ${line.kind}`} key={index}>
            <span className="line-no">{line.number ?? ''}</span>
            <code className="source">
              <span className="change">
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '−' : ' '}
              </span>
              <Highlight text={line.text} language={fileLanguage(label)} />
            </code>
          </div>
        ))}
      </div>
    </div>
  )
})
