import { Button, Tooltip } from '@heroui/react'
import { Check, Copy, AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n'

export function HistoryHash({ hash }: { hash: string }) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  const label =
    state === 'idle'
      ? t('source.copyHash', { hash })
      : t(state === 'copied' ? 'source.copied' : 'source.copyFailed')
  async function copy() {
    if (timer.current) clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(hash)
      setState('copied')
    } catch {
      setState('failed')
    }
    timer.current = setTimeout(() => setState('idle'), 1800)
  }
  return (
    <span className="git-log-hash-cell" data-copy-state={state}>
      <code>{hash.slice(0, 7)}</code>
      <Tooltip delay={450}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="git-log-hash"
          aria-label={label}
          data-copy-state={state}
          onClick={(event) => event.stopPropagation()}
          onPress={() => void copy()}
        >
          {state === 'copied' ? <Check /> : state === 'failed' ? <AlertCircle /> : <Copy />}
        </Button>
        <Tooltip.Content placement="bottom">{label}</Tooltip.Content>
      </Tooltip>
      <span className="sr-only" role="status">
        {state === 'idle' ? '' : label}
      </span>
    </span>
  )
}
