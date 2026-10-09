import { Chip, Tooltip } from '@heroui/react'
import { PackageLoadingIcon } from './PackageLoadingIcon'
import { Check, ChevronRight, CircleAlert, Puzzle } from 'lucide-react'
import { useTextTruncated } from '../../hooks/useTextTruncated'
import type { PackageUpdateState } from '../../lib/packageUpdates'

export function PackageOption({
  name,
  subtitle,
  installedLabel,
  disabledLabel,
  updateLabel,
  updateState,
}: {
  name: string
  subtitle: string
  installedLabel?: string
  disabledLabel?: string
  updateLabel?: string
  updateState?: PackageUpdateState
}) {
  const { ref: nameRef, truncated } = useTextTruncated(name)

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
        <span className="package-option-meta">
          <small>{subtitle}</small>
          {disabledLabel && (
            <Chip size="sm" variant="soft" className="package-option-disabled">
              {disabledLabel}
            </Chip>
          )}
        </span>
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
