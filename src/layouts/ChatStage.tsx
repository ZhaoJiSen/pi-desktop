import type { ReactNode } from 'react'
import { useSource } from '../components/source/context'
import { SourcePanel } from '../components/source/SourcePanel'
import { useSourcePanelLayout } from '../components/source/useSourcePanelLayout'

export function ChatStage({ children, empty }: { children: ReactNode; empty: boolean }) {
  const source = useSource()
  const { stageRef, width, maxWidth, expanded, canSplit, onWidth, restore } = useSourcePanelLayout(
    Boolean(source?.open),
  )
  return (
    <div
      ref={stageRef}
      className={source?.open ? 'chat-stage has-source' : 'chat-stage'}
      data-source-expanded={expanded || undefined}
    >
      <div
        className={empty ? 'chat-page is-empty' : 'chat-page'}
        inert={expanded || undefined}
        aria-hidden={expanded || undefined}
      >
        {children}
      </div>
      <SourcePanel
        width={width}
        maxWidth={maxWidth}
        expanded={expanded}
        onWidth={onWidth}
        onShowConversation={() => {
          if (canSplit) restore()
          else source?.setOpen(false)
        }}
      />
    </div>
  )
}
