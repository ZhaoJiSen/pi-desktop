import { expect, it } from 'vitest'
import { searchSessions } from '../../src/lib/sessionSearch'
import { makeSession } from '../../src/lib/fixtures'

it('searches titles and complete message text case-insensitively, and keeps newest-first order', () => {
  const first = { ...makeSession('project'), id: 'first', title: 'Refactor API', updatedAt: 1 }
  const second = {
    ...makeSession('project'),
    id: 'second',
    title: '',
    updatedAt: 2,
    messages: [
      {
        id: 'msg',
        role: 'assistant' as const,
        timestamp: 1,
        blocks: [{ type: 'text' as const, text: '检查 API 合约' }],
      },
    ],
  }
  expect(searchSessions([first, second], ' api ', 'New chat').map((s) => s.id)).toEqual([
    'second',
    'first',
  ])
  expect(searchSessions([first, second], '合约', 'New chat')).toEqual([second])
  expect(searchSessions([first, second], 'new chat', 'New chat')).toEqual([second])
  expect(searchSessions([first, second], '', 'New chat')).toEqual([second, first])
  expect(searchSessions([first, second], 'missing', 'New chat')).toEqual([])
  // A new immutable message must refresh search text rather than reuse old text.
  const updated = {
    ...second,
    messages: [{ ...second.messages[0], blocks: [{ type: 'text' as const, text: '修复滚动' }] }],
  }
  expect(searchSessions([updated], '合约', 'New chat')).toEqual([])
  expect(searchSessions([updated], '滚动', 'New chat')).toEqual([updated])
})
