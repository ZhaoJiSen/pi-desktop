import { motion, useReducedMotion } from 'motion/react'
import { PackageToast } from './extension-packages/PackageToast'
import { PackageLibrary } from './extension-packages/PackageLibrary'
import { PackageDetail } from './extension-packages/PackageDetail'
import { RemovePackageDialog } from './extension-packages/RemovePackageDialog'
import { useExtensionPackages } from './extension-packages/useExtensionPackages'

export { PackageServices } from './extension-packages/services'

export function ExtensionPackages() {
  const manager = useExtensionPackages()
  const reduced = useReducedMotion()

  return (
    <motion.div
      className="package-manager"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className={`package-workspace ${manager.mobileDetail ? 'detail-open' : ''}`}>
        <PackageLibrary
          {...manager.library}
          packageCount={manager.packageCount}
          changeMode={manager.changeMode}
          feedback={manager.feedback}
        />
        <PackageDetail {...manager.detail} feedback={manager.feedback} />
      </div>
      <PackageToast {...manager.toast} />
      <RemovePackageDialog {...manager.removeDialog} />
    </motion.div>
  )
}
