import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CurrentOffer, MotologyState, PricingFrame } from '@motology/types'
import { DealPanel } from '@/components/chat/DealPanel'
import { DecisionCard } from '@/components/chat/DecisionCard'
import { OfferCard } from '@/components/offer/OfferCard'
import { OutTheDoorCard } from '@/components/offer/OutTheDoorCard'
import { PricingFrameCard } from '@/components/offer/PricingFrameCard'
import { statLabel } from '@/lib/format'
import { askingPriceOf, dealScoreOf } from '@/lib/ladder'

const FRAME: PricingFrame = {
  list_price: 36_900,
  market_price: 35_400,
  open_offer: 33_600,
  good_price: 34_500,
  walk_away: 35_400,
  over_market_pct: 4.2,
  confidence_tier: 1,
  deal_state: 'NEGOTIATE',
}

const OFFER = {
  user_offer: 33_000,
  round: 1,
  action: 'counter',
  counter_price: 34_900,
  asking_price: 37_250, // a stale asking price from an older evaluation
  deal_score: 40,
} as CurrentOffer

const STATE = {
  pricing_frame: FRAME,
  current_offer: OFFER,
  deal_score: 64,
  last_scenario: null,
  vehicle: { stock_number: 'A100', year: 2022, make: 'Toyota', model: 'RAV4' },
} as unknown as MotologyState

const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('deal panel', () => {
  it('shows one asking price and one deal score everywhere', () => {
    expect(askingPriceOf(FRAME, OFFER)).toBe(36_900)
    expect(askingPriceOf(null, OFFER)).toBe(37_250)
    expect(dealScoreOf(STATE)).toBe(64)
    expect(dealScoreOf({ deal_score: null, current_offer: OFFER })).toBe(40)

    const html = text(renderToStaticMarkup(<DealPanel state={STATE} conversationId="conv_1" />))
    expect(html).toContain('Dealer asking $36,900')
    expect(html).not.toContain('37,250')
    expect(html).toContain('Deal score 64')
  })

  it('marks prices quoted for another ZIP as stale and offers to re-price', () => {
    const stale = { quotedZip: '94110', zip: '10001', onRequote: () => {} }
    const html = text(renderToStaticMarkup(<DealPanel state={STATE} conversationId={null} stale={stale} />))
    expect(html).toContain('These prices are for ZIP 94110.')
    expect(html).toContain('Re-price near 10001')

    const none = text(
      renderToStaticMarkup(<DealPanel state={STATE} conversationId={null} stale={{ ...stale, quotedZip: null }} />),
    )
    expect(none).toContain('quoted without your ZIP')

    const fresh = text(renderToStaticMarkup(<DealPanel state={STATE} conversationId={null} />))
    expect(fresh).not.toContain('Re-price')
  })

  it('does not promise that the walk-away stays private', () => {
    const html = text(renderToStaticMarkup(<PricingFrameCard frame={FRAME} />))
    expect(html).toContain('opening offer and good price stay private')
    expect(html).not.toMatch(/walk-away (is|are) private/i)
  })

  it('omits the deal score where the page already shows it', () => {
    const html = text(renderToStaticMarkup(<OfferCard offer={OFFER} askingPrice={36_900} />))
    expect(html).not.toContain('Deal score')
  })
})

describe('out-the-door card', () => {
  const OTD = {
    zip_code: '94110',
    basis: 'the good price',
    price: 29_794,
    sales_tax: 2_159.66,
    fees_total: 412.5,
    out_the_door: 32_366.16,
    trade_in: 5_000,
    down_payment: 2_000,
    amount_financed: 25_366.16,
    months: 72,
    assumed_apr: 8.9,
    est_monthly_payment: 455,
  }

  it('shows the total and every line it is built from', () => {
    const html = text(renderToStaticMarkup(<OutTheDoorCard estimate={OTD} />))
    expect(html).toContain('ZIP 94110')
    expect(html).toContain('Price (the good price) $29,794')
    expect(html).toContain('Sales tax $2,160')
    expect(html).toContain('Government fees $413')
    expect(html).toContain('Amount financed $25,366')
    expect(html).toContain('72 mo at ~8.9%')
    expect(html).toContain('Dealer fees are not included')
  })

  it('appears in the deal panel only when the gateway sends one', () => {
    const withOtd = text(renderToStaticMarkup(<DealPanel state={{ ...STATE, out_the_door: OTD }} conversationId={null} />))
    expect(withOtd).toContain('Out the door')
    const without = text(renderToStaticMarkup(<DealPanel state={STATE} conversationId={null} />))
    expect(without).not.toContain('Out the door')
  })
})

describe('decision card', () => {
  it('humanises raw stat keys and keeps written labels', () => {
    expect(statLabel('market_value')).toBe('Market value')
    expect(statLabel('days-on-lot')).toBe('Days on lot')
    expect(statLabel('MarketCheck comps')).toBe('MarketCheck comps')
    expect(statLabel('Price')).toBe('Price')

    const html = text(
      renderToStaticMarkup(
        <DecisionCard
          scenario={{
            scenario_id: 'is_overpriced',
            recommendation: 'Slightly above market.',
            stats: [{ key: 'market_value', value: '$35,400' }],
            data_source: 'live',
            confidence: 0.9,
          } as never}
          pricingFrame={null}
          dealScore={null}
        />,
      ),
    )
    expect(html).toContain('Market value')
    expect(html).not.toContain('market_value')
  })
})
