import { Skeleton } from '@heroui/react'

export function SkeletonBar({
  width = '100%',
  className = '',
}: {
  width?: string
  className?: string
}) {
  return (
    <Skeleton
      animationType="pulse"
      className={`workspace-skeleton-bar ${className}`}
      style={{ width }}
    />
  )
}
