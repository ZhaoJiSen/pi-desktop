import type { ReactNode } from 'react'

/** Navigation stays mounted and scrolls independently of the file content. */
export function SourceBrowser({
  navigation,
  children,
  history = false,
}: {
  navigation: ReactNode
  children: ReactNode
  history?: boolean
}) {
  return (
    <div className={history ? 'source-browser is-history' : 'source-browser'}>
      <div className="source-browser-navigation">{navigation}</div>
      <div className="source-browser-content">{children}</div>
    </div>
  )
}
