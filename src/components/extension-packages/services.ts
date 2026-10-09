import { createContext } from 'react'
import { connectSession, refreshExtensionPackages } from '../../lib/desktop'
import {
  discoverPackages,
  browsePackages,
  packageInfo,
  packageMetadata,
  managePackage,
} from '../../lib/packages'

export const PackageServices = createContext({
  discoverPackages,
  browsePackages,
  packageInfo,
  packageMetadata,
  managePackage,
  refreshExtensionPackages,
  connectSession,
})
