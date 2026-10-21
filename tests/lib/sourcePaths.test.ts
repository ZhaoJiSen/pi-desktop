import { describe, expect, it } from 'vitest'
import {
  agentTouchedPaths,
  normalizeProjectPath,
  pathTouched,
  toolFilePath,
} from '../../src/lib/source/paths'
import type { Message } from '../../src/types'

describe('project paths', () => {
  it('strips the project root and rejects paths that leave it', () => {
    expect(
      normalizeProjectPath('~/Projects/pi-desktop/src/models.ts', '~/Projects/pi-desktop'),
    ).toBe('src/models.ts')
    expect(normalizeProjectPath('../secret.ts')).toBeNull()
    expect(normalizeProjectPath('/etc/passwd')).toBeNull()
  })

  it('reads the path an edit tool changed and skips a running call', () => {
    const messages: Message[] = [
      {
        id: '1',
        role: 'assistant',
        timestamp: 1,
        blocks: [
          {
            type: 'tool',
            id: 'running',
            name: 'edit',
            label: 'src/models.ts',
            args: { path: 'src/models.ts' },
            status: 'running',
            output: '',
          },
          {
            type: 'tool',
            id: 'done',
            name: 'edit',
            label: 'src/components/model-selector.tsx',
            args: { file_path: 'src/components/model-selector.tsx' },
            status: 'done',
            output: '',
            diff: [{ kind: 'add', text: 'line', number: 1 }],
          },
        ],
      },
    ]
    const running = messages[0]?.blocks[0]
    const done = messages[0]?.blocks[1]
    if (running?.type !== 'tool' || done?.type !== 'tool') throw new Error('expected tools')
    expect(toolFilePath(running)).toBe('src/models.ts')
    expect(toolFilePath(done)).toBe('src/components/model-selector.tsx')
    expect([...agentTouchedPaths(messages)]).toEqual(['src/components/model-selector.tsx'])
  })

  it('marks a directory when an edited file is inside it', () => {
    const paths = new Set(['newdir/a.ts', 'src/a.ts'])
    expect(pathTouched(paths, 'newdir/')).toBe(true)
    expect(pathTouched(paths, 'src/a.ts')).toBe(true)
    expect(pathTouched(paths, 'src')).toBe(true)
    expect(pathTouched(paths, 'src-extra')).toBe(false)
    expect(pathTouched(paths, 'other/')).toBe(false)
  })
})
