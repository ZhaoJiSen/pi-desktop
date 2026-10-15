import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { shortPath } from '../lib/utils'
import type { Project } from '../types'
import { RemoveConfirmationDialog } from './RemoveConfirmationDialog'

export function RemoveProjectDialog({
  project,
  onClose,
}: {
  project: Project
  onClose: () => void
}) {
  const t = useT()
  return (
    <RemoveConfirmationDialog
      title={t('projects.removeTitle')}
      name={project.name}
      detail={shortPath(project.path)}
      description={t('projects.removeDescription')}
      confirmLabel={t('projects.remove')}
      onClose={onClose}
      onConfirm={() => {
        useWorkspace.getState().removeProject(project.id)
        onClose()
      }}
    />
  )
}
