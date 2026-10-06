import Link from 'next/link'
import type { MotologyState } from '@motology/types'
import { Icon } from '@/components/ui/Icon'
import { OfferCard } from '@/components/offer/OfferCard'
import { OutTheDoorCard } from '@/components/offer/OutTheDoorCard'
import { PricingFrameCard } from '@/components/offer/PricingFrameCard'
import { vehicleTitle } from '@/lib/format'
import { askingPriceOf, dealScoreOf } from '@/lib/ladder'

interface Props {
  state: MotologyState | null
  conversationId: string | null
  /** Shown when there is no vehicle in the engine state yet. */
  stockNumber?: string
  /** The prices were quoted for a different ZIP than the buyer's current one. */
  stale?: { quotedZip: string | null; zip: string | null; onRequote: () => void; disabled?: boolean } | null
}

const TRACKED = [
  'Market value from comparable cars near you',
  'Opening offer, good price and walk-away',
  'How the dealer is likely to respond to your offer',
  'Out-the-door total with tax and fees for your ZIP',
]

export function DealPanel({ state, conversationId, stockNumber, stale = null }: Props) {
  const vehicle = state?.vehicle ?? null
  const frame = state?.pricing_frame ?? null
  const offer = state?.current_offer ?? null
  const otd = state?.out_the_door ?? null
  const vehicleStock = vehicle?.stock_number ?? stockNumber ?? null

  if (!vehicle && !frame && !offer && !otd) {
    return (
      <div className="space-y-5">
        {stockNumber && (
          <Link
            href={`/vehicle/${encodeURIComponent(stockNumber)}`}
            className="card flex items-center gap-3 p-3.5 text-sm hover:border-ink/20"
          >
            <Icon name="car" className="text-brand" />
            <span>
              <span className="block font-medium">Stock #{stockNumber}</span>
              <span className="text-muted">View car details</span>
            </span>
          </Link>
        )}
        <div className="rounded-card border border-dashed border-border p-5">
          <p className="font-semibold">Your deal will appear here</p>
          <p className="mt-1 text-sm text-muted">As you talk, Motology keeps track of:</p>
          <ul className="mt-4 space-y-2.5">
            {TRACKED.map(t => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {vehicle && (
        <div className="card p-4">
          <p className="text-[13px] text-muted">Car</p>
          {vehicleStock ? (
            <Link
              href={`/vehicle/${encodeURIComponent(vehicleStock)}`}
              className="mt-0.5 inline-flex items-center gap-1 font-semibold hover:text-brand"
            >
              {vehicleTitle(vehicle)} <Icon name="arrow-right" size={14} />
            </Link>
          ) : (
            <p className="mt-0.5 font-semibold">{vehicleTitle(vehicle)}</p>
          )}
        </div>
      )}
      {frame && stale && (
        <div role="status" className="rounded-xl border border-warn/30 bg-warn/10 p-3.5 text-sm">
          <p className="flex items-start gap-2 font-medium text-warn">
            <Icon name="map-pin" size={16} className="mt-0.5 shrink-0" />
            {stale.quotedZip
              ? `These prices are for ZIP ${stale.quotedZip}.`
              : 'These prices were quoted without your ZIP.'}
          </p>
          <button
            type="button"
            onClick={stale.onRequote}
            disabled={stale.disabled}
            className="mt-2 font-semibold text-ink underline-offset-2 hover:underline disabled:opacity-50"
          >
            {stale.zip ? `Re-price near ${stale.zip}` : 'Re-price without a ZIP'}
          </button>
        </div>
      )}
      {frame && <PricingFrameCard frame={frame} offer={offer} className={stale ? 'opacity-60' : undefined} />}
      {otd && <OutTheDoorCard estimate={otd} className={stale ? 'opacity-60' : undefined} />}
      {offer && state && (
        <OfferCard offer={offer} askingPrice={askingPriceOf(frame, offer)} dealScore={dealScoreOf(state)} />
      )}
      {conversationId && (
        <Link
          href={`/offer/${encodeURIComponent(conversationId)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
        >
          Open full deal summary <Icon name="arrow-right" size={14} />
        </Link>
      )}
    </div>
  )
}
