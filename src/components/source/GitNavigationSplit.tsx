import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
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
  return (
    <NavigationLayoutContext.Provider value={{ layout: layout ?? defaultLayout, onLayoutChanged }}>
      {children}
    </NavigationLayoutContext.Provider>
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
      >
        {navigation}
      </Panel>
      <Separator
        className="git-column-separator git-navigation-separator"
        aria-label={t('source.resizeNavigation')}
      />
      <Panel id={reviewId} minSize={240} className="git-review-panel">
        {children}
      </Panel>
    </Group>
  )
}
