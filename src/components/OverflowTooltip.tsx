import { Tooltip } from '@heroui/react'
import {
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react'
import { isTextTruncated, observeTextTruncation } from '../lib/textOverflow'

type TextTag = 'span' | 'small' | 'strong' | 'code' | 'bdi'
type Props = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  text: string
  tooltip?: ReactNode
  as?: TextTag
}

// Keep HeroUI's positioning ref and the measurement ref attached to the same
// node before hover starts, including when Tooltip's warmup opens immediately.
function TextTarget({
  tag: Tag,
  props,
  target,
}: {
  tag: TextTag
  props: ComponentPropsWithRef<'span'>
  target: RefObject<HTMLElement | null>
}) {
  const element = useRef<HTMLSpanElement>(null)
  useImperativeHandle(props.ref, () => element.current!)
  useImperativeHandle(target, () => element.current!)
  return <Tag {...props} ref={element} />
}

/** Preserve the text's layout; show completion only while a real ellipsis exists. */
export function OverflowTooltip({
  text,
  tooltip,
  children,
  className = '',
  as = 'span',
  ...rest
}: Props) {
  const target = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    if (open && target.current)
      return observeTextTruncation(
        target.current,
        (clipped) => {
          if (!clipped) setOpen(false)
        },
        true,
      )
  }, [open, text])
  return (
    <Tooltip
      delay={400}
      closeDelay={100}
      isOpen={open}
      onOpenChange={(next) => setOpen(next && isTextTruncated(target.current, true))}
    >
      <Tooltip.Trigger<'span'>
        render={(props) => <TextTarget tag={as} props={props} target={target} />}
        role={undefined}
        tabIndex={-1}
        className={`overflow-tooltip-text ${className}`}
        {...rest}
      >
        {children ?? text}
      </Tooltip.Trigger>
      <Tooltip.Content placement="top start" offset={6} className="overflow-text-tooltip">
        {tooltip ?? text}
      </Tooltip.Content>
    </Tooltip>
  )
}
