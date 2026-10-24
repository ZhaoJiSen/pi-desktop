import type { en } from './en'
import { capabilities } from './zh/capabilities'
import { core } from './zh/core'
import { packages } from './zh/packages'
import { settings } from './zh/settings'
import { workspace } from './zh/workspace'

export const zh = {
  ...core,
  ...capabilities,
  ...settings,
  ...workspace,
  ...packages,
} as const satisfies Record<keyof typeof en, string>
