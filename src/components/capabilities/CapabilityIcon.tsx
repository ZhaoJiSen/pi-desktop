import { Workflow } from 'lucide-react'
import { DynamicIcon } from 'lucide-react/dynamic'
import { lucideName } from '../../lib/capabilities/icons'
import type { CapabilityIcon as IconName } from '../../lib/capabilities/types'
const fallback = () => <Workflow aria-hidden="true" />
export function CapabilityIcon({ name }: { name: IconName }) {
  return <DynamicIcon name={lucideName(name)} aria-hidden="true" fallback={fallback} />
}
