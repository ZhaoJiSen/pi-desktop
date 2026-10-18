import { Button, Label, Slider } from '@heroui/react'
import { Brain, RotateCcw } from 'lucide-react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ThinkingLevel } from '../types'
import { useT } from '../lib/i18n'
import { defaultThinkingLevel, thinkingLabel, orderedThinkingLevels } from '../lib/thinking'

const MotionThumb = motion.create(Slider.Thumb)

export function ModelThinkingControl({
  value,
  levels,
  supported,
  disabled,
  pending = false,
  focusSelected,
  onChange,
  modelName,
}: {
  value: ThinkingLevel
  modelName?: string
  levels: ThinkingLevel[]
  supported: boolean
  disabled: boolean
  pending?: boolean
  focusSelected: boolean
  onChange: (level: ThinkingLevel) => Promise<void>
}) {
  const t = useT()
  const reducedMotion = useReducedMotion()
  const available = orderedThinkingLevels.filter((level) => levels.includes(level))
  const [preview, setPreview] = useState<number | null>(null)
  const committing = useRef(false)
  const thumbInput = useRef<HTMLInputElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState(0)
  const acceptedIndex = Math.max(0, available.indexOf(value))
  const position = preview ?? acceptedIndex
  const progress = position / Math.max(1, available.length - 1)
  // One spring drives both the ball and fill. Input and labels stay immediate;
  // only their visual position has a short, critically damped follow-through.
  const visualProgress = useSpring(progress, {
    stiffness: 2400,
    damping: 42,
    mass: 0.18,
    restDelta: 0.0001,
    restSpeed: 0.001,
  })
  const thumbX = useTransform(visualProgress, (next) => next * trackWidth - 14)
  const fillClip = useTransform(
    visualProgress,
    (next) => `inset(0 ${(1 - next) * trackWidth}px 0 0 round 999px)`,
  )
  useLayoutEffect(() => {
    if (reducedMotion) visualProgress.jump(progress)
    else visualProgress.set(progress)
  }, [progress, reducedMotion, visualProgress])
  useLayoutEffect(() => {
    const element = track.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setTrackWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [supported, available.length])
  const index = Math.max(0, Math.min(available.length - 1, Math.round(position)))
  const current = available[index] ?? value
  const currentLabel = t(thinkingLabel[current])
  const spectrum = current === 'xhigh' || current === 'max'
  const resetIndex = Math.max(0, available.indexOf(defaultThinkingLevel(available)))
  const resetLevel = available[resetIndex]
  const subtitle = spectrum ? t('thinking.deepHint') : modelName || t('thinking.effort')
  useLayoutEffect(() => {
    // This HeroUI version formats slider values as numbers. Expose the actual
    // discrete level to assistive technology instead of its internal index.
    thumbInput.current?.setAttribute('aria-valuetext', currentLabel)
  }, [currentLabel, position, pending])
  const levelAt = (next: number | number[]) =>
    available[
      Math.max(
        0,
        Math.min(available.length - 1, Math.round(Array.isArray(next) ? (next[0] ?? 0) : next)),
      )
    ]
  async function commit(next: number | number[]) {
    const level = levelAt(next)
    if (disabled || !supported || !level || committing.current) return
    // The pointer moves continuously; only the released position becomes a
    // discrete level. Snap locally before waiting for the runtime response.
    if (level === value) {
      setPreview(null)
      return
    }
    committing.current = true
    setPreview(available.indexOf(level))
    try {
      await onChange(level)
    } finally {
      committing.current = false
      setPreview(null)
    }
  }
  return (
    <div
      className="model-thinking-control"
      data-level={supported && available.length ? current : 'off'}
      data-disabled={disabled || undefined}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      data-spectrum={(supported && available.length && spectrum) || undefined}
      onKeyDownCapture={(event) => {
        if (!(event.target instanceof HTMLInputElement) || event.target.type !== 'range') return
        const next = {
          ArrowRight: index + 1,
          ArrowUp: index + 1,
          ArrowLeft: index - 1,
          ArrowDown: index - 1,
          PageUp: index + 1,
          PageDown: index - 1,
          Home: 0,
          End: available.length - 1,
        }[event.key]
        if (next === undefined) return
        // Keep keyboard navigation discrete even though pointer input is fine-grained.
        event.preventDefault()
        event.stopPropagation()
        if (available.length > 1) void commit(next)
      }}
    >
      {supported && available.length ? (
        <Slider
          className="model-thinking-slider"
          minValue={0}
          maxValue={Math.max(1, available.length - 1)}
          step={0.001}
          value={position}
          isDisabled={disabled || pending || available.length < 2}
          onChange={(next) => {
            if (!committing.current) setPreview(Array.isArray(next) ? (next[0] ?? 0) : next)
          }}
          onChangeEnd={(next) => void commit(next)}
        >
          <Label className="sr-only">{t('thinking.effort')}</Label>
          <div className="thinking-presentation">
            <Brain className="thinking-mode-icon" aria-hidden="true" />
            <div className="thinking-caption">
              <Slider.Output>{currentLabel}</Slider.Output>
              <span className="thinking-subtitle" title={subtitle}>
                {subtitle}
              </span>
            </div>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="thinking-reset"
              aria-label={t('thinking.resetTo', { level: t(thinkingLabel[resetLevel ?? current]) })}
              isDisabled={
                disabled || pending || !resetLevel || current === resetLevel || available.length < 2
              }
              onPress={() => void commit(resetIndex)}
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          </div>
          <Slider.Track ref={track}>
            <Slider.Fill
              render={(props) => (
                <div
                  {...props}
                  style={{
                    ...props.style,
                    // One rounded fill spans the transparent thumb gutters too.
                    // Its mask follows the same spring as the ball, so endcaps
                    // cannot retain a separate color after a level change.
                    left: -14,
                    width: 'calc(100% + 28px)',
                  }}
                >
                  <motion.div className="thinking-fill-reveal" style={{ clipPath: fillClip }}>
                    {props.children}
                  </motion.div>
                </div>
              )}
            >
              <motion.span
                className="thinking-spectrum"
                aria-hidden="true"
                initial={false}
                animate={{ opacity: spectrum ? 1 : 0 }}
                transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeOut' }}
              >
                <span className="thinking-sparkles" aria-hidden="true">
                  {[
                    ['9%', '30%'],
                    ['18%', '68%'],
                    ['28%', '25%'],
                    ['38%', '60%'],
                    ['49%', '39%'],
                    ['60%', '72%'],
                    ['72%', '28%'],
                    ['84%', '58%'],
                  ].map(([left, top], i) => (
                    <motion.span
                      key={i}
                      className="thinking-sparkle"
                      style={{ left, top }}
                      initial={false}
                      animate={
                        reducedMotion || !spectrum
                          ? { opacity: 0.5, x: 0, y: 0, scale: 1 }
                          : {
                              opacity: [0.25, 0.95, 0.25],
                              x: [-2, 2, -2],
                              y: [1, -1, 1],
                              scale: [0.7, 1.2, 0.7],
                            }
                      }
                      transition={
                        reducedMotion || !spectrum
                          ? { duration: 0 }
                          : {
                              duration: 2.2 + (i % 3) * 0.25,
                              delay: i * -0.23,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            }
                      }
                    />
                  ))}
                </span>
              </motion.span>
            </Slider.Fill>
            <Slider.Marks aria-hidden="true">
              {available.map((level, i) => (
                <span
                  key={level}
                  className="model-thinking-tick"
                  data-active={i <= index || undefined}
                  style={{
                    left: available.length > 1 ? `${(i / (available.length - 1)) * 100}%` : '0%',
                  }}
                />
              ))}
            </Slider.Marks>
            <MotionThumb
              inputRef={thumbInput}
              autoFocus={focusSelected}
              style={{ left: 0, x: thumbX, y: '-50%' }}
            >
              {({ isDragging }) => (
                <motion.span
                  className="thinking-thumb-ball"
                  aria-hidden="true"
                  initial={false}
                  animate={{ scale: !reducedMotion && isDragging ? 1.16 : 1 }}
                  transition={
                    reducedMotion
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 600, damping: 30 }
                  }
                />
              )}
            </MotionThumb>
          </Slider.Track>
        </Slider>
      ) : (
        <>
          <div className="model-thinking-heading">
            <Brain aria-hidden="true" />
            {t('thinking.effort')}
          </div>
          <p className="model-thinking-unavailable">
            {t(supported ? 'thinking.noLevels' : 'thinking.unavailable')}
          </p>
        </>
      )}
    </div>
  )
}
