import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import type { GroupImperativeHandle, Layout, LayoutChangedMeta } from 'react-resizable-panels'
import { useT } from '../../lib/i18n'

const NavigationLayoutContext = createContext<{
  layout: Layout | undefined
  onLayoutChanged: (layout: Layout, meta: LayoutChangedMeta) => void
} | null>(null)

/** Both Activity views keep their content mounted, but share one saved boundary. */
export function GitNavigationLayoutProvider({ children }: { children: ReactNode }) {
  const { defaultLayout, onLayoutChanged: saveLayout } = useDefaultLayout({
    id: 'pi.git-navigation.v1',
    onlySaveAfterUserInteractions: true,
  })
  const [layout, setLayout] = useState<Layout>()
  const onLayoutChanged = useCallback(
    (next: Layout, meta: LayoutChangedMeta) => {
      // Hidden views and window constraints must not overwrite the user's width.
      if (!meta.isUserInteraction) return
      const requested = meta.requestedLayout ?? next
      setLayout(requested)
      saveLayout(requested, meta)
    },
    [saveLayout],
  )
  const value = useMemo(
    () => ({ layout: layout ?? defaultLayout, onLayoutChanged }),
    [layout, defaultLayout, onLayoutChanged],
  )
  return (
    <NavigationLayoutContext.Provider value={value}>{children}</NavigationLayoutContext.Provider>
  )
}

/** A single resize boundary shared by the Git workspace's two views. */
export function GitNavigationSplit({
  navigation,
  children,
  id,
}: {
  navigation: ReactNode
  children: ReactNode
  id: string
}) {
  const t = useT()
  const shared = useContext(NavigationLayoutContext)
  const group = useRef<GroupImperativeHandle | null>(null)
  const navigationElement = useRef<HTMLDivElement | null>(null)
  const [headingSpace, setHeadingSpace] = useState(40)
  useLayoutEffect(() => {
    const heading = navigationElement.current?.querySelector<HTMLElement>('.git-browser-heading')
    if (!heading) {
      setHeadingSpace(0)
      return
    }
    const measure = () => {
      const style = getComputedStyle(heading)
      setHeadingSpace(heading.offsetHeight + (parseFloat(style.marginBottom) || 0))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(heading)
    return () => observer.disconnect()
  }, [navigation])
  const navigationId = `${id}-navigation`
  const reviewId = `${id}-review`
  const layout = shared?.layout
  const defaultLayout = layout && {
    [navigationId]: layout.navigation!,
    [reviewId]: layout.review!,
  }
  // Activity reconnects layout effects when a view becomes visible again.
  useLayoutEffect(() => {
    if (layout) {
      group.current?.setLayout({
        [navigationId]: layout.navigation!,
        [reviewId]: layout.review!,
      })
    }
  }, [layout, navigationId, reviewId])
  return (
    <Group
      groupRef={group}
      orientation="horizontal"
      className="git-navigation-split"
      data-git-view={id}
      style={{ '--git-heading-space': `${headingSpace}px` } as CSSProperties}
      defaultLayout={defaultLayout}
      onLayoutChanged={(next, meta) => {
        const requested = meta.requestedLayout ?? next
        shared?.onLayoutChanged(
          { navigation: requested[navigationId]!, review: requested[reviewId]! },
          { ...meta, requestedLayout: undefined },
        )
      }}
    >
      <Panel
        id={navigationId}
        defaultSize={252}
        minSize={220}
        maxSize="50%"
        groupResizeBehavior="preserve-pixel-size"
        className="git-navigation-panel"
        elementRef={navigationElement}
      >
        {navigation}
      </Panel>
      <Separator
        className="git-column-separator git-navigation-separator"
        aria-label={t('source.resizeNavigation')}
      />
      <Panel id={reviewId} minSize={240} className="git-review-panel">
        <div className="git-review-content">{children}</div>
      </Panel>
    </Group>
  )
}
