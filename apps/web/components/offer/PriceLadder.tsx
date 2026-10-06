import type { CurrentOffer, PricingFrame } from '@motology/types'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { buildLadder, type LadderKind } from '@/lib/ladder'
import { cn } from '@/lib/utils'

const ZONE_TONES = { ok: 'bg-ok/25', warn: 'bg-warn/25', bad: 'bg-bad/20' } as const

const MARKERS: Record<LadderKind, string> = {
  open: 'bg-ok',
  good: 'bg-ok',
  walk: 'bg-bad',
  market: 'bg-ink',
  asking: 'bg-muted',
  offer: 'bg-accent ring-2 ring-accent-fg/70',
  counter: 'bg-warn',
}

const BUYER_ONLY: ReadonlySet<LadderKind> = new Set(['open', 'good', 'walk'])

interface Props {
  frame: PricingFrame | null
  offer?: CurrentOffer | null
  className?: string
  /** False holds the markers at the left edge, so flipping it slides them in. */
  revealed?: boolean
  /** Count the prices up from this value when they first appear. */
  countFrom?: number
}

/**
 * Where the numbers sit relative to each other. Green is a strong deal, amber
 * is fair, red is past the buyer's walk-away.
 */
export function PriceLadder({ frame, offer = null, className, revealed = true, countFrom }: Props) {
  const ladder = buildLadder(frame, offer)
  if (!ladder) return null

  return (
    <figure className={cn('space-y-4', className)}>
      <div aria-hidden className="relative h-2.5 rounded-full bg-surface-2">
        {ladder.zones.map(z => (
          <span
            key={z.tone}
            className={cn(
              'absolute inset-y-0 transition-[left,width] duration-700 ease-out',
              ZONE_TONES[z.tone],
              z.from === 0 && 'rounded-l-full',
              z.to === 100 && 'rounded-r-full',
            )}
            style={{ left: `${revealed ? z.from : 0}%`, width: `${revealed ? Math.max(0, z.to - z.from) : 0}%` }}
          />
        ))}
        {ladder.points.map(p => (
          <span
            key={p.kind}
            className={cn(
              'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-card',
              'transition-[left,opacity] duration-[900ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]',
              MARKERS[p.kind],
              !revealed && 'opacity-0',
            )}
            style={{ left: `${revealed ? p.position : 0}%` }}
          />
        ))}
      </div>
      <figcaption className="sr-only">Price ladder, from lowest to highest price.</figcaption>
      <ul className="space-y-1.5 text-sm">
        {ladder.points.map(p => (
          <li key={p.kind} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-muted">
              <span aria-hidden className={cn('h-2 w-2 rounded-full', MARKERS[p.kind].split(' ')[0], p.kind === 'offer' && 'ring-1 ring-accent-fg/70')} />
              {p.label}
              {BUYER_ONLY.has(p.kind) && <span className="sr-only">(private to you)</span>}
            </span>
            <span className={cn('tabular font-semibold', p.kind === 'offer' ? 'text-brand' : 'text-ink')}>
              <AnimatedNumber value={p.value} from={countFrom} />
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
