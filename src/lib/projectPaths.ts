export function projectPath(value: string): string | null {
  const path = value.trim()
  if (!/^(\/|~\/|[a-z]:[\\/]|\\\\[^\\])/i.test(path)) return null
  if (path === '/' || path === '~/' || /^[a-z]:[\\/]$/i.test(path)) return path
  return path.replace(/[\\/]+$/, '')
}
