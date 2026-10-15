import type { ExtensionPackagesController } from '../useExtensionPackages'

export type PackageLibraryProps = ExtensionPackagesController['library'] &
  Pick<ExtensionPackagesController, 'packageCount' | 'changeMode' | 'feedback'>
