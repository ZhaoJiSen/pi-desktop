import {
  Braces,
  File,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  Settings,
} from 'lucide-react'

const iconProps = { className: 'source-tree-icon', 'aria-hidden': true } as const

export function FileTreeIcon({
  name,
  kind,
  expanded,
}: {
  name: string
  kind: 'file' | 'dir' | 'link'
  expanded: boolean
}) {
  if (kind === 'dir') return expanded ? <FolderOpen {...iconProps} /> : <Folder {...iconProps} />
  if (kind === 'link') return <Link2 {...iconProps} />
  if (/(^\.env(?:\.|$)|config\.|\.config$)/i.test(name)) return <Settings {...iconProps} />
  if (/\.(json|jsonc|ya?ml|toml)$/i.test(name)) return <Braces {...iconProps} />
  if (/\.(md|mdx|txt|log)$/i.test(name)) return <FileText {...iconProps} />
  if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) return <FileImage {...iconProps} />
  if (/\.(tsx?|jsx?|vue|svelte|css|s[ac]ss|html|rs|py|sh)$/i.test(name))
    return <FileCode2 {...iconProps} />
  return <File {...iconProps} />
}
