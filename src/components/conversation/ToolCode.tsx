import { ScrollShadow } from '@heroui/react'
import { Highlight } from './Highlight'

export function ToolCode({ text, language = '' }: { text: string; language?: string }) {
  return (
    <div className="tool-output-surface">
      <ScrollShadow className="tool-scroll" orientation="vertical" size={28}>
        <pre className="tool-text" tabIndex={0}>
          <code>
            <Highlight text={text} language={language} />
          </code>
        </pre>
      </ScrollShadow>
    </div>
  )
}
