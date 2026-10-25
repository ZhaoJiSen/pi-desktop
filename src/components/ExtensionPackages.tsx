import { usePaneTransition } from '../hooks/usePaneTransition'
import { SidebarLayout } from '../layouts/SidebarLayout'
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
  const paneRef = usePaneTransition('extensions', { reveal: true })

  return (
    <div ref={paneRef} className="package-manager">
      <SidebarLayout
        className={`package-workspace ${manager.mobileDetail ? 'detail-open' : ''}`}
        collapseAt={780}
        label={t('layout.resizeExtensions')}
        sidebar={
          <PackageLibrary
            {...manager.library}
            packageCount={manager.packageCount}
            changeMode={manager.changeMode}
            feedback={manager.feedback}
          />
        }
      >
        <PackageDetail {...manager.detail} feedback={manager.feedback} />
      </SidebarLayout>
      <PackageToast {...manager.toast} />
      <RemovePackageDialog {...manager.removeDialog} />
    </div>
  )
}
