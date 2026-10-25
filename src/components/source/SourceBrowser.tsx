import type { ReactNode } from 'react'
import { GitNavigationSplit } from './GitNavigationSplit'
import { SourceBrowserSplit } from './SourceBrowserSplit'

/** Navigation stays mounted and scrolls independently of the file content. */
export function SourceBrowser({
  navigation,
  children,
  history = false,
  navigationCollapsed = false,
  resizable = false,
}: {
  navigation: ReactNode
  children: ReactNode
  history?: boolean
  navigationCollapsed?: boolean
  resizable?: boolean
}) {
  if (resizable)
    return (
      <GitNavigationSplit
        id="changes"
        navigation={<div className="source-browser-navigation">{navigation}</div>}
      >
        <div className="source-browser-content">{children}</div>
      </GitNavigationSplit>
    )
  return (
    <SourceBrowserSplit history={history} collapsed={navigationCollapsed}>
      <div className="source-browser-navigation" hidden={navigationCollapsed}>
        {navigation}
      </div>
      <div className="source-browser-content">{children}</div>
    </SourceBrowserSplit>
  )
}
