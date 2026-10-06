import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { isMotologyApiError } from '@motology/api-client'
import type { ConversationState } from '@motology/types'
import { OfferCard } from '@/components/offer/OfferCard'
import { OutTheDoorCard } from '@/components/offer/OutTheDoorCard'
import { PricingFrameCard } from '@/components/offer/PricingFrameCard'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { formatInteger, hasValue, vehicleTitle } from '@/lib/format'
import { askingPriceOf, dealScoreOf } from '@/lib/ladder'
import { toPublicError } from '@/lib/server/errors'
import { gatewayRequestOptions, getMotologyClient } from '@/lib/server/motology'
import { CONVERSATION_COOKIE, isValidConversationId } from '@/lib/session'

export const metadata: Metadata = {
  title: 'Your deal',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string }>
}

type ConversationResult =
  | { status: 'ok'; conversation: ConversationState }
  | { status: 'error'; message: string }

async function loadConversation(id: string): Promise<ConversationResult | null> {
  try {
    return { status: 'ok', conversation: await getMotologyClient().getConversation(id, await gatewayRequestOptions()) }
  } catch (err) {
    if (isMotologyApiError(err) && err.code === 'http' && err.status === 404) return null
    return { status: 'error', message: toPublicError(err, 'offer page').message }
  }
}

export default async function OfferPage({ params }: Props) {
  const { id } = await params

  // Without buyer accounts, the session cookie is the only proof of ownership:
  // a conversation is only viewable from the browser that holds it. Anything
  // else is reported as "not found" so ids cannot be probed.
  const owned = (await cookies()).get(CONVERSATION_COOKIE)?.value
  if (!isValidConversationId(id) || owned !== id) notFound()

  const result = await loadConversation(id)
  if (!result) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link href="/chat" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <Icon name="arrow-left" size={15} /> Back to chat
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Your deal</h1>
      {result.status === 'error' ? (
        <div role="alert" className="card mt-6 flex items-start gap-3 p-5 text-sm">
          <Icon name="alert" className="shrink-0 text-bad" />
          <p>{result.message}</p>
        </div>
      ) : (
        <OfferDetails conversation={result.conversation} />
      )}
    </div>
  )
}

function OfferDetails({ conversation }: { conversation: ConversationState }) {
  const { vehicle, current_offer, pricing_frame } = conversation
  const deal_score = dealScoreOf(conversation)

  return (
    <div className="mt-6 space-y-5">
      {vehicle && (
        <div className="card flex items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <p className="text-[13px] text-muted">Car</p>
            {vehicle.stock_number ? (
              <Link
                href={`/vehicle/${encodeURIComponent(vehicle.stock_number)}`}
                className="mt-0.5 inline-flex items-center gap-1 font-semibold hover:text-brand"
              >
                {vehicleTitle(vehicle)} <Icon name="arrow-right" size={14} />
              </Link>
            ) : (
              <p className="mt-0.5 font-semibold">{vehicleTitle(vehicle)}</p>
            )}
          </div>
          {hasValue(deal_score) && (
            <div className="text-right">
              <p className="text-[13px] text-muted">Deal score</p>
              <p className="tabular text-xl font-semibold">{formatInteger(deal_score)}</p>
            </div>
          )}
        </div>
      )}

      {pricing_frame ? (
        <PricingFrameCard frame={pricing_frame} offer={current_offer} />
      ) : (
        <EmptyCard
          title="No price plan yet"
          body="Ask Motology whether a car is fairly priced and your opening offer, good price and walk-away will show up here."
        />
      )}

      {current_offer ? (
        <OfferCard offer={current_offer} askingPrice={askingPriceOf(pricing_frame, current_offer)} />
      ) : (
        <EmptyCard
          title="No offer yet"
          body="When you're ready, tell Motology what you'd offer and it will show you how the dealer is likely to respond."
        />
      )}

      {conversation.out_the_door && <OutTheDoorCard estimate={conversation.out_the_door} />}

      <Link href="/chat" className={buttonClass({ size: 'lg' }, 'w-full sm:w-auto')}>
        <Icon name="message" size={16} /> Continue negotiating
      </Link>
    </div>
  )
}

function EmptyCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-card border border-dashed border-border p-5">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </div>
  )
}
