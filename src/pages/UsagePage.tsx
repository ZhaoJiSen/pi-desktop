import { Button } from '@heroui/react'
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { useWorkspace } from '../store/workspace'
import { useT } from '../lib/i18n'
import { cost, tokens } from '../lib/utils'
import { selectChat } from '../router/navigation'

export function UsagePage() {
  const sessions = useWorkspace((state) => state.sessions)
  const active = useWorkspace((state) => state.activeSessionId)
  const session = sessions.find((item) => item.id === active)
  const [scope, setScope] = useState<'current' | 'all'>('current')
  const t = useT()
  const chosen = scope === 'all' ? sessions : session ? [session] : []
  const total = chosen.reduce(
    (sum, item) => ({
      input: sum.input + item.usage.input,
      output: sum.output + item.usage.output,
      cacheRead: sum.cacheRead + item.usage.cacheRead,
      cacheWrite: sum.cacheWrite + item.usage.cacheWrite,
      total: sum.total + item.usage.total,
      cost: sum.cost + item.usage.cost,
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, cost: 0 },
  )
  return (
    <div className="utility-view">
      <div className="view-toolbar">
        <div className="segment">
          <Button
            variant="ghost"
            className={scope === 'current' ? 'active' : ''}
            onPress={() => setScope('current')}
          >
            {t('sessions.current')}
          </Button>
          <Button
            variant="ghost"
            className={scope === 'all' ? 'active' : ''}
            onPress={() => setScope('all')}
          >
            {t('sessions.all')}
          </Button>
        </div>
      </div>
      <dl className="usage-breakdown">
        {(
          [
            ['usage.totalTokens', tokens(total.total)],
            ['usage.estimatedCost', cost(total.cost)],
            ['usage.input', tokens(total.input)],
            ['usage.output', tokens(total.output)],
            ['usage.cacheRead', tokens(total.cacheRead)],
            ['usage.cacheWrite', tokens(total.cacheWrite)],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt>{t(label)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="table-scroll">
        <table className="usage-table">
          <thead>
            <tr>
              <th>{t('usage.conversation')}</th>
              <th>{t('usage.model')}</th>
              <th>{t('usage.tokens')}</th>
              <th>{t('usage.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {chosen
              .filter((item) => item.messages.length)
              .map((item) => (
                <tr key={item.id}>
                  <td>
                    <Button variant="ghost" onPress={() => selectChat(item.id)}>
                      {item.title || t('sessions.new')}
                      <ArrowUpRight />
                    </Button>
                  </td>
                  <td>{item.modelKey.split('/').slice(1).join('/') || '—'}</td>
                  <td>{tokens(item.usage.total)}</td>
                  <td>{cost(item.usage.cost)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
