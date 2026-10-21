import manifest from 'material-icon-theme/dist/material-icons.json'

const icons = manifest as {
  file: string
  fileExtensions: Record<string, string>
  fileNames: Record<string, string>
  iconDefinitions: Record<string, { iconPath: string }>
}

const files = import.meta.glob('../../../node_modules/material-icon-theme/icons/*.svg', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const byFile = new Map(
  Object.entries(files).map(([path, url]) => [path.split('/').pop() ?? '', url]),
)

export function fileIconUrl(path: string) {
  const base = path.split('/').pop()?.toLowerCase() || ''
  const extension = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : ''
  const key = icons.fileNames[base] || (extension && icons.fileExtensions[extension]) || icons.file
  const iconPath = icons.iconDefinitions[key]?.iconPath
  const file = iconPath?.split('/').pop()
  return (file && byFile.get(file)) || byFile.get('file.svg') || ''
}
