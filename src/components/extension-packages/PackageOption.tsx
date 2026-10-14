import { Chip } from '@heroui/react'
import { Check, CircleAlert, Puzzle } from 'lucide-react'
import type { PackageUpdateState } from '../../lib/packageUpdates'
import { SidebarOption } from '../SidebarOption'
import { PackageLoadingIcon } from './PackageLoadingIcon'

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
  const trailing =
    updateState?.status === 'updating' ? (
      <PackageLoadingIcon />
    ) : updateState?.status === 'done' ? (
      <Check className="package-row-done" />
    ) : updateState?.status === 'failed' ? (
      <CircleAlert className="package-row-failed" />
    ) : updateLabel ? (
      <span className="package-update-dot" aria-label={updateLabel} />
    ) : undefined

  return (
    <SidebarOption
      icon={<Puzzle />}
      title={name}
      subtitle={subtitle}
      badge={
        disabledLabel ? (
          <Chip size="sm" variant="soft" className="package-option-disabled sidebar-option-badge">
            {disabledLabel}
          </Chip>
        ) : undefined
      }
      accessory={
        installedLabel ? (
          <span className="package-option-installed">
            <Check aria-hidden="true" />
            {installedLabel}
          </span>
        ) : undefined
      }
      trailing={trailing}
    />
  )
}
