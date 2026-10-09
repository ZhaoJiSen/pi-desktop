import { motion, useReducedMotion } from 'motion/react'
import { SplitPane } from './SplitPane'
import { useT } from '../lib/i18n'
import { PackageToast } from './extension-packages/PackageToast'
import { PackageLibrary } from './extension-packages/PackageLibrary'
import { PackageDetail } from './extension-packages/PackageDetail'
import { RemovePackageDialog } from './extension-packages/RemovePackageDialog'
import { useExtensionPackages } from './extension-packages/useExtensionPackages'

export { PackageServices } from './extension-packages/services'

export function ExtensionPackages() {
  const t = useT()
  const manager = useExtensionPackages()
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="package-manager"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <SplitPane
        className={`package-workspace ${manager.mobileDetail ? 'detail-open' : ''}`}
        storageKey="pi.extensions-panel-width"
        defaultWidth={340}
        minWidth={270}
        minContentWidth={360}
        collapseAt={780}
        label={t('layout.resizeExtensions')}
      >
        <PackageLibrary
          {...manager.library}
          packageCount={manager.packageCount}
          changeMode={manager.changeMode}
          feedback={manager.feedback}
        />
        <PackageDetail {...manager.detail} feedback={manager.feedback} />
      </SplitPane>
      <PackageToast {...manager.toast} />
      <RemovePackageDialog {...manager.removeDialog} />
    </motion.div>
  )
}
