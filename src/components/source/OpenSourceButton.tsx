import { Button } from '@heroui/react'
import { GitCompare } from 'lucide-react'
import { memo } from 'react'
import { useT } from '../../lib/i18n'
import { toolFilePath } from '../../lib/source/paths'
import type { ToolBlock } from '../../types'
import { useSource } from './context'
import { useProjectSource } from './useProjectSource'

const CHANGING = new Set(['edit', 'write', 'apply_patch'])

export const OpenSourceButton = memo(function OpenSourceButton({ tool }: { tool: ToolBlock }) {
  const source = useSource()
  const { path: projectPath } = useProjectSource()
  const t = useT()
  if (!source || tool.status === 'running') return null
  const path = toolFilePath(tool, projectPath)
  if (!tool.diff && !(path && CHANGING.has(tool.name))) return null
  return (
    <Button
      isIconOnly
      variant="ghost"
      className="icon-button tool-open-source"
      aria-label={t('source.openDiff')}
      onPress={() =>
        source.show({
          tab: 'changes',
          path,
          mode: 'diff',
          fallback: tool.diff,
          label: path ?? tool.label,
        })
      }
    >
      <GitCompare />
    </Button>
  )
})
