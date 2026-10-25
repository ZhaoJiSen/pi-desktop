import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels'
import { useT } from '../../lib/i18n'

/** Keep file navigation mounted while resizing or temporarily hiding it. */
export function SourceBrowserSplit({
  children,
  history,
  collapsed,
}: {
  children: [ReactNode, ReactNode]
  history: boolean
  collapsed: boolean
}) {
  const t = useT()
  const id = useId()
  const element = useRef<HTMLDivElement | null>(null)
  const navigation = useRef<PanelImperativeHandle | null>(null)
  const [vertical, setVertical] = useState(false)
  useLayoutEffect(() => {
    const node = element.current
    if (!node) return
    const measure = () => {
      const width = node.clientWidth
      if (width > 0) setVertical(width <= 576)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (collapsed) navigation.current?.collapse()
    else navigation.current?.expand()
  }, [collapsed, vertical])
  return (
    <Group
      elementRef={element}
      orientation={vertical ? 'vertical' : 'horizontal'}
      className={`source-browser source-browser-split${history ? ' is-history' : ''}`}
      data-navigation-collapsed={collapsed || undefined}
      data-stacked={vertical || undefined}
    >
      <Panel
        id={`${id}-navigation`}
        panelRef={navigation}
        defaultSize={vertical ? '26%' : 240}
        minSize={vertical ? 132 : 180}
        maxSize={vertical ? '60%' : '55%'}
        collapsible
        collapsedSize={0}
        className="source-browser-navigation-panel"
      >
        {children[0]}
      </Panel>
      <Separator
        className="source-browser-separator"
        aria-label={t('source.resizeNavigation')}
        hidden={collapsed}
        disabled={collapsed}
      />
      <Panel
        id={`${id}-content`}
        minSize={vertical ? 100 : 200}
        className="source-browser-review-panel"
      >
        {children[1]}
      </Panel>
    </Group>
  )
}
