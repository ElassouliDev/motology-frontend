'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatInteger, formatPercentMagnitude } from '@/lib/format'
import { ease, prefersReducedMotion } from '@/lib/motion'

const FORMATS = {
  currency: formatCurrency,
  integer: formatInteger,
  percent: formatPercentMagnitude,
} as const

interface Props {
  value: number
  format?: keyof typeof FORMATS
  /** Count up from this value on mount. Without it, only later changes animate. */
  from?: number
  durationMs?: number
  className?: string
}

/**
 * Display-only tween between engine values: the final frame is always the
 * exact value passed in, and screen readers only ever get that value.
 */
export function AnimatedNumber({ value, format = 'currency', from, durationMs = 700, className }: Props) {
  const fmt = FORMATS[format]
  const [shown, setShown] = useState(from ?? value)
  const current = useRef(from ?? value)

  useEffect(() => {
    const start = current.current
    if (start === value || prefersReducedMotion()) {
      current.current = value
      setShown(value)
      return
    }
    let frame = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / durationMs)
      const next = t === 1 ? value : start + (value - start) * ease(t)
      current.current = next
      setShown(next)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value, durationMs])

  return (
    <span className={className}>
      <span aria-hidden>{fmt(Math.round(shown * 10) / 10)}</span>
      <span className="sr-only">{fmt(value)}</span>
    </span>
  )
}
