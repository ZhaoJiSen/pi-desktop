import { useT } from '../lib/i18n'
import type { Page } from '../router/paths'
import { Chip } from '@heroui/react'
import { useCommandHeaderCount } from '../pages/commands/commandHeaderCount'

function CommandCount() {
  const count = useCommandHeaderCount()
  return (
    <Chip size="sm" variant="soft" className="commands-count workspace-command-count">
      {count}
    </Chip>
  )
}

// One heading stays above both content and loading layers, so their opacity
// animations cannot dim it or draw two copies of the same glyphs.
export function WorkspacePageTitle({ page }: { page: Page }) {
  const t = useT()
  const title =
    page === 'commands'
      ? t('capability.library')
      : page === 'extensions'
        ? t('navigation.extensions')
        : page === 'git'
          ? t('source.workspace')
          : null
  return title ? (
    <h1 className="workspace-page-title utility-page-title">
      <span className="workspace-page-label">{title}</span>
      {page === 'commands' && <CommandCount />}
    </h1>
  ) : null
}
