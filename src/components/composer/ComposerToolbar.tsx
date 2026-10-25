import { Button, Spinner } from '@heroui/react'
import { ArrowUp, Square } from 'lucide-react'
import { abortPrompt } from '../../lib/desktop'
import { useT } from '../../lib/i18n'
import { ModelSelector } from '../ModelSelector'
import { ThinkingSelector } from '../ThinkingSelector'
import { useState } from 'react'
export function ComposerToolbar({
  running,
  preparing,
  sendDisabled,
  selector,
  setSelector,
  placement,
  boundaryElement,
}: {
  running: boolean
  preparing: boolean
  sendDisabled: boolean
  selector: 'model' | 'thinking' | null
  setSelector: (selector: 'model' | 'thinking' | null) => void
  placement: 'top start' | 'bottom start'
  boundaryElement?: Element
}) {
  const [pending, setPending] = useState<'model' | 'thinking' | null>(null)
  const t = useT()
  return (
    <div className="composer-toolbar">
      <div className="composer-toolbar-start">
        <ModelSelector
          isOpen={selector === 'model'}
          onOpenChange={(open) => setSelector(open ? 'model' : null)}
          disabled={pending === 'thinking'}
          onPendingChange={(saving) => setPending(saving ? 'model' : null)}
          placement={placement}
          boundaryElement={boundaryElement}
        />
        <ThinkingSelector
          isOpen={selector === 'thinking'}
          onOpenChange={(open) => setSelector(open ? 'thinking' : null)}
          disabled={pending === 'model'}
          onPendingChange={(saving) => setPending(saving ? 'thinking' : null)}
          placement={placement}
          boundaryElement={boundaryElement}
        />
      </div>
      <div className="send-area">
        <div>
          <Button
            type={running ? 'button' : 'submit'}
            isIconOnly
            className="send"
            data-loading={preparing || undefined}
            isPending={preparing}
            aria-label={t(running ? 'composer.stop' : 'composer.send')}
            isDisabled={sendDisabled}
            onPress={running ? () => void abortPrompt() : undefined}
          >
            {running ? (
              <Square className="stop-icon" />
            ) : preparing ? (
              <Spinner
                className="send-spinner"
                size="sm"
                color="current"
                aria-hidden="true"
                role="presentation"
              />
            ) : (
              <ArrowUp />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
