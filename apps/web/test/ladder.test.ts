import { describe, expect, it } from 'vitest'
import type { CurrentOffer, PricingFrame } from '@motology/types'
import { buildLadder } from '@/lib/ladder'

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

describe('buildLadder', () => {
  it('passes engine prices through unchanged and orders them low to high', () => {
    const ladder = buildLadder(FRAME)!
    expect(ladder.points.map(p => [p.kind, p.value])).toEqual([
      ['open', 33_600],
      ['good', 34_500],
      ['walk', 35_400],
      ['market', 35_400],
      ['asking', 36_900],
    ])
  })

  it('keeps every marker inside the bar', () => {
    const ladder = buildLadder(FRAME)!
    for (const p of ladder.points) {
      expect(p.position).toBeGreaterThanOrEqual(6)
      expect(p.position).toBeLessThanOrEqual(94)
    }
    expect(ladder.points[0]!.position).toBe(6)
    expect(ladder.points.at(-1)!.position).toBe(94)
  })

  it('colours strong, fair and over-the-limit zones from the buyer targets', () => {
    const ladder = buildLadder(FRAME)!
    expect(ladder.zones.map(z => z.tone)).toEqual(['ok', 'warn', 'bad'])
    expect(ladder.zones.at(-1)!.to).toBe(100)
  })

  it('needs at least two prices', () => {
    expect(buildLadder(null)).toBeNull()
    expect(buildLadder({ ...FRAME, open_offer: null, good_price: null, walk_away: null, market_price: null })).toBeNull()
  })

  it('ignores missing, zero and non-finite values instead of plotting them', () => {
    const ladder = buildLadder({ ...FRAME, market_price: Number.NaN, good_price: 0 })!
    expect(ladder.points.map(p => p.kind)).toEqual(['open', 'walk', 'asking'])
  })

  it('adds the buyer offer and dealer counter, and uses the offer asking price when the frame has none', () => {
    const offer: CurrentOffer = {
      user_offer: 34_000,
      asking_price: 36_900,
      round: 1,
      action: 'counter',
      counter_price: 35_900,
      deal_score: null,
    }
    const ladder = buildLadder({ ...FRAME, list_price: null }, offer)!
    expect(ladder.points.find(p => p.kind === 'offer')?.value).toBe(34_000)
    expect(ladder.points.find(p => p.kind === 'counter')?.value).toBe(35_900)
    expect(ladder.points.find(p => p.kind === 'asking')?.value).toBe(36_900)
  })

  it('centres everything when all prices are equal', () => {
    const ladder = buildLadder({ ...FRAME, list_price: 30_000, market_price: 30_000, open_offer: null, good_price: null, walk_away: null })!
    expect(ladder.points.every(p => p.position === 50)).toBe(true)
  })
})
