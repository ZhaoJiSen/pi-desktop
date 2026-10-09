import type { CSSProperties } from 'react'

// pi CLI's pi-logo.js draws these pixels using ANSI-colored half/full blocks.
// CSS cells retain its exact layout without terminal font seams or image assets.
const pixels = ['ccc.', 'b.c.', 'bb.y', 'b..y']

export function PiLogo({ loading = false, size = 64, className = '' }: { loading?: boolean; size?: number; className?: string }) {
  return <span className={`pi-logo ${className}`} role="img" aria-label="pi" data-loading={loading || undefined} style={{ '--pi-logo-size': `${size}px` } as CSSProperties}>
    {pixels.flatMap((row, y) => [...row].flatMap((color, x) => color === '.' ? [] : [
      <span key={`${y}-${x}`} className="pi-logo-pixel" data-color={color} aria-hidden="true" style={{ gridRow: y + 1, gridColumn: x + 1, '--pi-pixel-order': y * 4 + x } as CSSProperties} />,
    ]))}
  </span>
}
