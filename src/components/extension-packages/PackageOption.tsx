import { Tooltip } from '@heroui/react'
import { PackageLoadingIcon } from './PackageLoadingIcon'
import { Check, ChevronRight, CircleAlert, Puzzle } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { PackageUpdateState } from '../../lib/packageUpdates'

export function PackageOption({
  name,
  subtitle,
  installedLabel,
  updateLabel,
  updateState,
}: {
  name: string
  subtitle: string
  installedLabel?: string
  updateLabel?: string
  updateState?: PackageUpdateState
}) {
  const nameRef = useRef<HTMLElement>(null)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const element = nameRef.current
    if (!element) return
    const measure = () => setTruncated(element.scrollWidth > element.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [name])

  return (
    <>
      <span className="package-option-icon" aria-hidden="true">
        <Puzzle />
      </span>
      <span className="package-option-copy">
        <Tooltip delay={450} closeDelay={100} isDisabled={!truncated}>
          <Tooltip.Trigger<'span'>
            render={(props) => <span {...props} />}
            className="package-option-name"
            role={undefined}
            tabIndex={-1}
          >
            <strong ref={nameRef}>{name}</strong>
          </Tooltip.Trigger>
          <Tooltip.Content placement="top start" offset={4} className="package-name-tooltip">
            {name}
          </Tooltip.Content>
        </Tooltip>
        <small>{subtitle}</small>
      </span>
      {installedLabel && (
        <span className="package-option-installed">
          <Check aria-hidden="true" />
          {installedLabel}
        </span>
      )}
      {updateState?.status === 'updating' ? (
        <PackageLoadingIcon />
      ) : updateState?.status === 'done' ? (
        <Check className="package-row-done" />
      ) : updateState?.status === 'failed' ? (
        <CircleAlert className="package-row-failed" />
      ) : updateLabel ? (
        <span className="package-update-dot" aria-label={updateLabel} />
      ) : (
        <ChevronRight />
      )}
    </>
  )
}
