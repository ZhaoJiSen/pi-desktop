import { Button } from '@heroui/react'
import { motion } from 'motion/react'
import { useT } from '../lib/i18n'
import { PiLogo } from './PiLogo'

export function StartupScreen({ error, onRetry, onContinue }: { error?: string | null; onRetry: () => void; onContinue: () => void }) {
  const t = useT()
  return <div className="startup-screen" aria-busy={!error}>
    <div className="startup-drag-region" data-tauri-drag-region />
    <motion.div className="startup-content" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}>
      <PiLogo loading={!error} className="startup-logo" />
      <div className="startup-status" role={error ? 'alert' : 'status'} aria-live="polite">
        <p className="startup-title">{t(error ? 'connection.failed' : 'startup.preparing')}</p>
        {error && <p className="startup-error">{error}</p>}
      </div>
      {error && <div className="startup-actions">
        <motion.div whileTap={{ scale: .97 }}><Button className="startup-retry" onPress={onRetry}>{t('common.retry')}</Button></motion.div>
        <Button variant="ghost" onPress={onContinue}>{t('startup.openSettings')}</Button>
      </div>}
    </motion.div>
  </div>
}
