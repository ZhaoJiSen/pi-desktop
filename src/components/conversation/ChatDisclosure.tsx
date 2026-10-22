import { ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'motion/react'

/** Animate the clipping row without synchronously measuring long chat bodies. */
export function ChatDisclosure({
  className,
  triggerClassName,
  label,
  action,
  children,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  leadingIndicator = false,
}: {
  className: string
  triggerClassName: string
  label: ReactNode
  action?: ReactNode
  children: ReactNode
  expanded?: boolean
  defaultExpanded?: boolean
  onExpandedChange?: (open: boolean) => void
  leadingIndicator?: boolean
}) {
  const id = useId()
  const [ownExpanded, setOwnExpanded] = useState(defaultExpanded)
  const open = expanded ?? ownExpanded
  const reducedMotion = useReducedMotion()
  const [hidden, setHidden] = useState(!open)
  const [fromFind, setFromFind] = useState(false)
  const instant = Boolean(reducedMotion || fromFind)
  if (open && hidden) setHidden(false)
  if (!open && instant && !hidden) setHidden(true)
  const panel = useRef<HTMLDivElement>(null)
  const cancelFrame = useRef(0)
  useEffect(() => () => cancelAnimationFrame(cancelFrame.current), [])
  useLayoutEffect(() => {
    // React's hidden attribute type does not yet include the searchable value.
    if (hidden) panel.current?.setAttribute('hidden', 'until-found')
  }, [hidden])
  useEffect(() => {
    const element = panel.current
    const reveal = () => {
      // Browser find must reveal its destination before scrolling to the match.
      setFromFind(true)
      if (expanded === undefined) setOwnExpanded(true)
      onExpandedChange?.(true)
    }
    element?.addEventListener('beforematch', reveal)
    return () => element?.removeEventListener('beforematch', reveal)
  }, [expanded, onExpandedChange])
  const indicator = (
    <span
      className={leadingIndicator ? 'chevron' : 'tool-chevron'}
      data-expanded={open || undefined}
      aria-hidden="true"
    >
      {leadingIndicator ? <ChevronRight /> : <ChevronDown />}
    </span>
  )
  return (
    <div className={`chat-disclosure ${className}`} data-expanded={open || undefined}>
      <h3 className="chat-disclosure-heading">
        <button
          type="button"
          id={`${id}-trigger`}
          className={`chat-disclosure-trigger ${triggerClassName}`}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          onClick={() => {
            setFromFind(false)
            if (expanded === undefined) setOwnExpanded(!open)
            onExpandedChange?.(!open)
          }}
        >
          {leadingIndicator && indicator}
          {label}
          {!leadingIndicator && indicator}
        </button>
        {action}
      </h3>
      <div
        ref={panel}
        className="chat-disclosure-content"
        data-expanded={open || undefined}
        data-instant={instant || undefined}
        id={`${id}-content`}
        role="group"
        aria-labelledby={`${id}-trigger`}
        aria-hidden={!open}
        inert={!open && !hidden}
        hidden={hidden}
        onTransitionEnd={(event) => {
          if (
            event.target === event.currentTarget &&
            event.propertyName === 'grid-template-rows' &&
            !open
          )
            setHidden(true)
        }}
        onTransitionCancel={(event) => {
          if (event.target !== event.currentTarget || event.propertyName !== 'grid-template-rows')
            return
          cancelAnimationFrame(cancelFrame.current)
          cancelFrame.current = requestAnimationFrame(() => {
            const element = panel.current
            if (
              element &&
              element.dataset.expanded !== 'true' &&
              !(
                typeof element.getAnimations === 'function' &&
                element
                  .getAnimations()
                  .some((animation) => animation.playState === 'running' || animation.pending)
              )
            )
              setHidden(true)
          })
        }}
      >
        <div className="chat-disclosure-body">{children}</div>
      </div>
    </div>
  )
}
