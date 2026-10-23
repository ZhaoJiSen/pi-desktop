import type { ReactNode } from 'react'

/** Navigation stays mounted and scrolls independently of the file content. */
export function SourceBrowser({
  navigation,
  children,
  history = false,
  navigationCollapsed = false,
}: {
  navigation: ReactNode
  children: ReactNode
  history?: boolean
  navigationCollapsed?: boolean
}) {
  return (
    <div
      className={history ? 'source-browser is-history' : 'source-browser'}
      data-navigation-collapsed={navigationCollapsed || undefined}
    >
      <div className="source-browser-navigation" hidden={navigationCollapsed}>
        {navigation}
      </div>
      <div className="source-browser-content">{children}</div>
    </div>
  )
}
