import { Spinner } from '@heroui/react'

export function SourceNotice({
  kind,
  text,
}: {
  kind: 'loading' | 'empty' | 'error'
  text: string
}) {
  return (
    <div className={`source-notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <Spinner className="source-spinner" size="sm" color="current" />}
      <p>{text}</p>
    </div>
  )
}
