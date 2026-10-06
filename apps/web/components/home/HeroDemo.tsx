'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { PricingFrame } from '@motology/types'
import { PriceLadder } from '@/components/offer/PriceLadder'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { LogoMark } from '@/components/ui/Logo'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Illustrative only, and labelled as such: no real vehicle or market data. */
const QUESTION = 'Is this 2022 RAV4 XLE a fair price?'
const FRAME: PricingFrame = {
  list_price: 36_900,
  market_price: 35_400,
  open_offer: 33_600,
  good_price: 34_500,
  walk_away: 35_400,
  over_market_pct: 4.2,
  confidence_tier: 1,
  deal_state: null,
}
const STATS = [
  { value: 14, label: 'comparables' },
  { value: 52, label: 'days on lot' },
  { value: 0, label: 'open recalls' },
]

/** 0 idle · 1 typing the question · 2 thinking · 3 answer · 4 ladder · 5 done */
type Stage = 0 | 1 | 2 | 3 | 4 | 5
const TYPE_MS = 32

export function HeroDemo({ className }: { className?: string }) {
  const [stage, setStage] = useState<Stage>(0)
  const [typed, setTyped] = useState(0)
  const timers = useRef<number[]>([])

  const clear = () => {
    timers.current.forEach(t => window.clearTimeout(t))
    timers.current = []
  }

  const play = useCallback(() => {
    clear()
    if (prefersReducedMotion()) {
      setTyped(QUESTION.length)
      setStage(5)
      return
    }
    setTyped(0)
    setStage(1)
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
    for (let i = 1; i <= QUESTION.length; i++) at(400 + i * TYPE_MS, () => setTyped(i))
    const typedAt = 400 + QUESTION.length * TYPE_MS
    at(typedAt + 250, () => setStage(2))
    at(typedAt + 1250, () => setStage(3))
    at(typedAt + 1600, () => setStage(4))
    at(typedAt + 2600, () => setStage(5))
  }, [])

  useEffect(() => {
    play()
    return clear
  }, [play])

  return (
    <div className={cn('card relative overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold tracking-tight">Price check</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Always laid out, so the header does not shift when it appears. */}
          <button
            type="button"
            onClick={play}
            disabled={stage !== 5}
            className={cn(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted transition-opacity hover:bg-surface-2 hover:text-ink',
              stage !== 5 && 'invisible opacity-0',
            )}
          >
            <Icon name="refresh" size={12} /> Replay
          </button>
          <Badge>Example</Badge>
        </div>
      </div>

      {/* The finished frame, invisible, sizes the card: the hero never shifts while the demo plays. */}
      <div className="grid p-4 sm:p-5" aria-hidden>
        <div className="invisible [grid-area:1/1]">
          <DemoBody stage={5} typed={QUESTION.length} still />
        </div>
        <div className="[grid-area:1/1]">
          <DemoBody stage={stage} typed={typed} />
        </div>
      </div>

      {/* What screen readers (and the page without JavaScript) get. */}
      <p className="sr-only">
        Example: a 2022 Toyota RAV4 XLE listed at $36,900 is 4.2% above similar cars nearby. Motology suggests opening
        at $33,600, a good price of $34,500 and walking away above $35,400.
      </p>
    </div>
  )
}

function DemoBody({ stage, typed, still = false }: { stage: Stage; typed: number; still?: boolean }) {
  const answered = stage >= 3
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div
          className={cn(
            'min-h-[40px] max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2.5 text-sm text-brand-fg transition-opacity',
            stage === 0 && 'opacity-0',
          )}
        >
          {QUESTION.slice(0, typed)}
          {stage === 1 && <span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-brand-fg" />}
        </div>
      </div>

      {stage === 2 && (
        <div className="flex items-center gap-1 pl-1 pt-1">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      )}

      {answered && (
        <div className="animate-msg-in space-y-4">
          <p className="text-sm leading-relaxed">
            Listed{' '}
            <span className="font-semibold text-bad">
              <AnimatedNumber value={4.2} from={still ? undefined : 0} format="percent" durationMs={900} /> above
            </span>{' '}
            similar cars nearby. Open at <span className="font-semibold">$33,600</span> and don&apos;t go past{' '}
            <span className="font-semibold">$35,400</span>.
          </p>
          <div className="rounded-xl border border-border p-3.5">
            <PriceLadder frame={FRAME} revealed={stage >= 4} countFrom={still ? undefined : 30_000} />
          </div>
          <div
            className={cn(
              'grid grid-cols-3 gap-2 text-center transition-all duration-500',
              stage >= 5 ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
            )}
          >
            {STATS.map(s => (
              <div key={s.label} className="rounded-xl bg-surface-2 px-2 py-2.5">
                <p className="text-base font-semibold">
                  {stage >= 5 ? <AnimatedNumber value={s.value} from={still ? undefined : 0} format="integer" /> : '0'}
                </p>
                <p className="text-[11px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
          </div>
  )
}
