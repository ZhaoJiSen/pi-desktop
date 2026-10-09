import { useEffect, useState } from 'react'
import { loadBuiltinCommands, type DiscoverableCommand } from '../../lib/commands'
import { useWorkspace } from '../../store/workspace'
import { useT } from '../../lib/i18n'

export function useComposerCommands() {
  const runtime = useWorkspace((s) => s.commands)
  const executable = useWorkspace((s) => s.piExecutable)
  const connection = useWorkspace((s) => s.connection)
  const t = useT()
  const key = `${executable}:${connection}`
  const [catalog, setCatalog] = useState({
    key: '',
    builtin: [] as DiscoverableCommand[],
    failed: false,
  })
  useEffect(() => {
    let cancelled = false
    void loadBuiltinCommands(executable)
      .then((builtin) => {
        if (!cancelled) setCatalog({ key, builtin, failed: false })
      })
      .catch(() => {
        if (!cancelled) setCatalog({ key, builtin: [], failed: true })
      })
    return () => {
      cancelled = true
    }
  }, [executable, key])
  return {
    commands: [
      ...(catalog.key === key ? catalog.builtin : []),
      ...(connection === 'connected' ? runtime : []),
    ],
    loading: catalog.key !== key || connection === 'connecting',
    catalogError: catalog.key === key && catalog.failed ? t('commands.catalogUnavailable') : '',
  }
}
