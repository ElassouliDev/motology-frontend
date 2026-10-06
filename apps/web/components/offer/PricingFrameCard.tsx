import type { CurrentOffer, PricingFrame } from '@motology/types'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { confidenceTierLabel } from '@/lib/confidence'
import { formatPercentMagnitude, hasValue, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PriceLadder } from './PriceLadder'

interface Props {
  frame: PricingFrame
  offer?: CurrentOffer | null
  className?: string
}

export function PricingFrameCard({ frame, offer = null, className }: Props) {
  const tier = confidenceTierLabel(frame.confidence_tier)
  const overMarket = frame.over_market_pct
  return (
    <section aria-label="Pricing" className={cn('card p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Your price plan</h2>
        {tier && <Badge tone={tier.tone}>{tier.label}</Badge>}
      </div>
      {hasValue(overMarket) && (
        <p className="mt-2 text-sm text-muted">
          Asking price is{' '}
          <span className={cn('tabular font-semibold', overMarket > 0 ? 'text-bad' : 'text-ok')}>
            {overMarket === 0
              ? 'right at'
              : `${formatPercentMagnitude(overMarket)} ${overMarket > 0 ? 'above' : 'below'}`}
          </span>{' '}
          market value{frame.deal_state ? ` · ${humanize(frame.deal_state)}` : ''}.
        </p>
      )}
      <PriceLadder frame={frame} offer={offer} className="mt-5" />
      <p className="mt-5 flex items-start gap-2 text-[13px] text-muted">
        <Icon name="lock" size={14} className="mt-0.5 shrink-0" />
        Your opening offer and good price stay private. If you connect with the dealership, it sees the market
        value you were shown and any offer you make.
      </p>
    </section>
  )
}
