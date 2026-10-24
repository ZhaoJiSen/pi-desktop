import { capabilities } from './en/capabilities'
import { core } from './en/core'
import { packages } from './en/packages'
import { settings } from './en/settings'
import { workspace } from './en/workspace'

export const en = {
  ...core,
  ...capabilities,
  ...settings,
  ...workspace,
  ...packages,
} as const
