import { Button } from '@heroui/react'
import { GripVertical, PinOff } from 'lucide-react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { CapabilityIcon } from '../../components/capabilities/CapabilityIcon'
import { useT } from '../../lib/i18n'
import type { Capability } from '../../lib/capabilities/types'

export function PinnedCapabilities({
  items,
  onReorder,
  onUnpin,
}: {
  items: Capability[]
  onReorder: (ids: string[]) => void
  onUnpin: (id: string) => void
}) {
  const t = useT()
  const [announcement, announce] = useState('')
  function move(id: string, offset: number) {
    const ids = items.map((item) => item.id),
      index = ids.indexOf(id),
      next = index + offset
    if (index < 0 || next < 0 || next >= ids.length) return
    ;[ids[index], ids[next]] = [ids[next]!, ids[index]!]
    onReorder(ids)
    announce(t('capability.orderChanged', { name: items[index]!.name, position: next + 1 }))
  }
  return (
    <>
      <span id="pinned-reorder-help" className="visually-hidden">
        {t('capability.reorderHelp')}
      </span>
      <Reorder.Group
        as="ol"
        axis="y"
        className="capability-pinned-list"
        values={items.map((item) => item.id)}
        onReorder={(ids) => {
          onReorder(ids)
          announce(t('capability.orderUpdated'))
        }}
      >
        {items.map((item) => (
          <PinnedRow key={item.id} item={item} onMove={move} onUnpin={onUnpin} />
        ))}
      </Reorder.Group>
      <span className="visually-hidden" role="status">
        {announcement}
      </span>
    </>
  )
}
function PinnedRow({
  item,
  onMove,
  onUnpin,
}: {
  item: Capability
  onMove: (id: string, offset: number) => void
  onUnpin: (id: string) => void
}) {
  const controls = useDragControls(),
    reduced = useReducedMotion(),
    t = useT()
  return (
    <Reorder.Item
      as="li"
      value={item.id}
      dragListener={false}
      dragControls={controls}
      layout="position"
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
      whileDrag={{ scale: reduced ? 1 : 1.015, zIndex: 3 }}
    >
      <Button
        className="capability-drag-handle"
        variant="ghost"
        isIconOnly
        size="sm"
        aria-label={t('capability.reorder', { name: item.name })}
        aria-describedby="pinned-reorder-help"
        onPointerDown={(event) => controls.start(event)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            onMove(item.id, event.key === 'ArrowUp' ? -1 : 1)
          }
        }}
      >
        <GripVertical />
      </Button>
      <CapabilityIcon name={item.icon} />
      <span>
        {item.name}
        {!item.enabled && <small>{t('capability.status.disabled')}</small>}
      </span>
      <Button
        variant="ghost"
        size="sm"
        isIconOnly
        aria-label={t('capability.unpinItem', { name: item.name })}
        onPress={() => onUnpin(item.id)}
      >
        <PinOff />
      </Button>
    </Reorder.Item>
  )
}
