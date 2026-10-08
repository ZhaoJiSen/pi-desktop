import { Button } from '@heroui/react'
import { CircleCheck, Info, X } from 'lucide-react'
import { useT } from '../lib/i18n'

export function RuntimeNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const t = useT()
  // Only adapt a known plugin message; arbitrary extension text stays intact.
  const loaded = /^Ponytail loaded: (lite|full|ultra|off)$/.exec(message)
  const modes: Record<string, string> = { lite: '轻量模式', full: '完整模式', ultra: '高强度模式', off: '已关闭' }
  const Icon = loaded ? CircleCheck : Info
  return <div className="runtime-notice" role="status">
    <Icon className={`runtime-notice-icon${loaded ? ' is-success' : ''}`} aria-hidden="true" />
    <div className="runtime-notice-copy">
      <span className="runtime-notice-title" title={loaded ? message : undefined}>{loaded ? t('Ponytail 已加载') : message}</span>
      {loaded && <span className="runtime-notice-detail">{t('pi 插件')} · {t(modes[loaded[1]])} ({loaded[1]})</span>}
    </div>
    <Button isIconOnly variant="ghost" className="icon-button" aria-label={t('关闭')} onPress={onDismiss}><X /></Button>
  </div>
}
