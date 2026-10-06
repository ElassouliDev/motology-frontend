import type { CurrentOffer } from '@motology/types'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { EMPTY, formatCurrency, formatInteger, hasValue, humanize } from '@/lib/format'
import { cn } from '@/lib/utils'

const ACTIONS: Record<string, { label: string; tone: BadgeTone; hint: string }> = {
  accept: { label: 'Likely accepted', tone: 'ok', hint: 'The dealer is likely to take this offer.' },
  counter: { label: 'Likely counter', tone: 'warn', hint: 'Expect the dealer to come back with a counter.' },
  reject: { label: 'Likely declined', tone: 'bad', hint: 'This offer is probably too low to get a response.' },
}

interface Props {
  offer: CurrentOffer
  /** From `askingPriceOf`, so this card and the ladder never disagree. */
  askingPrice: number | null
  /** From `dealScoreOf`; omit where the page already shows the score. */
  dealScore?: number | null
  className?: string
  compact?: boolean
}

export function OfferCard({ offer, askingPrice, dealScore = null, className, compact = false }: Props) {
  const key = offer.action?.toLowerCase() ?? ''
  const known = ACTIONS[key]
  const actionLabel = known?.label ?? (offer.action ? humanize(offer.action) : null)

  return (
    <section aria-label="Your current offer" className={cn(!compact && 'card p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted">
            Your offer{hasValue(offer.round) && <> · round {formatInteger(offer.round)}</>}
          </p>
          <p className="tabular mt-0.5 text-2xl font-semibold tracking-tight">
            {hasValue(offer.user_offer) ? <AnimatedNumber value={offer.user_offer} /> : formatCurrency(null)}
          </p>
        </div>
        {actionLabel && actionLabel !== EMPTY && <Badge tone={known?.tone ?? 'neutral'}>{actionLabel}</Badge>}
      </div>

      {known && <p className="mt-2 text-sm text-muted">{known.hint}</p>}

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        {hasValue(offer.counter_price) && (
          <div>
            <dt className="text-[13px] text-muted">Expected counter</dt>
            <dd className="tabular font-semibold">{formatCurrency(offer.counter_price)}</dd>
          </div>
        )}
        <div>
          <dt className="text-[13px] text-muted">Dealer asking</dt>
          <dd className="tabular font-semibold">{formatCurrency(askingPrice)}</dd>
        </div>
        {hasValue(dealScore) && (
          <div>
            <dt className="text-[13px] text-muted">Deal score</dt>
            <dd className="tabular font-semibold">{formatInteger(dealScore)}</dd>
          </div>
        )}
      </dl>
    </section>
  )
}
