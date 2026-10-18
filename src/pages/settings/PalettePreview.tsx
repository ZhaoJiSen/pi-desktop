import type { CSSProperties } from 'react'
import { ArrowUp } from 'lucide-react'
import {
  accentColors,
  accentForeground,
  type AccentColor,
  type ColorMode,
} from '../../lib/appearance'
import type { Palette } from '../../types'

export function PalettePreview({
  palette,
  mode,
  accent,
  className = '',
}: {
  palette: Palette
  mode: ColorMode
  accent?: AccentColor
  className?: string
}) {
  const style = accent
    ? ({
        '--accent': accentColors[accent][mode],
        '--accent-foreground': accentForeground(mode),
      } as CSSProperties)
    : undefined
  return (
    <span
      className={`palette-preview ${className}`}
      data-palette={palette}
      data-theme={mode}
      style={style}
      aria-hidden="true"
    >
      <span className="palette-preview-sidebar">
        <i />
        <i />
        <i />
      </span>
      <span className="palette-preview-main">
        <span className="palette-preview-text" />
        <span className="palette-preview-code">
          <i />
          <i />
          <i />
        </span>
        <span className="palette-preview-composer">
          <span />
          <ArrowUp />
        </span>
      </span>
    </span>
  )
}
