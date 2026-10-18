export function TextShimmer({
  children,
  active = true,
  className,
}: {
  children: string
  active?: boolean
  className?: string
}) {
  return (
    <span className={[active && 'text-shimmer', className].filter(Boolean).join(' ') || undefined}>
      {children}
    </span>
  )
}
