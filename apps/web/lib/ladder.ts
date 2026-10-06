/**
 * Layout for the price ladder graphic. Positions only: every price shown is an
 * engine value passed through unchanged.
 */
import type { CurrentOffer, PricingFrame } from '@motology/types'

export type LadderKind = 'open' | 'good' | 'walk' | 'market' | 'asking' | 'offer' | 'counter'

export interface LadderPoint {
  kind: LadderKind
  label: string
  value: number
  /** 0..100, left to right. */
  position: number
}

export interface LadderZone {
  tone: 'ok' | 'warn' | 'bad'
  from: number
  to: number
}

export interface Ladder {
  points: LadderPoint[]
  zones: LadderZone[]
}

const LABELS: Record<LadderKind, string> = {
  open: 'Opening offer',
  good: 'Good price',
  walk: 'Walk-away',
  market: 'Market value',
  asking: 'Dealer asking',
  offer: 'Your offer',
  counter: 'Dealer counter',
}

/** Inset so markers at either end are not clipped by the bar's rounded caps. */
const INSET = 6

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

/**
 * The asking price every view shows: the pricing frame's list price (what the
 * ladder is built on), falling back to the offer's when there is no frame.
 */
export function askingPriceOf(frame: PricingFrame | null, offer: CurrentOffer | null): number | null {
  if (finite(frame?.list_price)) return frame.list_price
  return finite(offer?.asking_price) ? offer.asking_price : null
}

/** The deal score every view shows: the running score, else the last offer's. */
export function dealScoreOf(state: { deal_score: number | null; current_offer: CurrentOffer | null }): number | null {
  const score = state.deal_score ?? state.current_offer?.deal_score
  return typeof score === 'number' && Number.isFinite(score) ? score : null
}

export function buildLadder(frame: PricingFrame | null, offer: CurrentOffer | null = null): Ladder | null {
  const raw: [LadderKind, number | null | undefined][] = [
    ['open', frame?.open_offer],
    ['good', frame?.good_price],
    ['walk', frame?.walk_away],
    ['market', frame?.market_price],
    ['asking', frame?.list_price ?? offer?.asking_price],
    ['offer', offer?.user_offer],
    ['counter', offer?.counter_price],
  ]
  const present = raw.filter((entry): entry is [LadderKind, number] => finite(entry[1]))
  if (present.length < 2) return null

  const values = present.map(([, v]) => v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const place = (v: number) => (span === 0 ? 50 : INSET + ((v - min) / span) * (100 - 2 * INSET))

  const points = present
    .map(([kind, value]) => ({ kind, label: LABELS[kind], value, position: place(value) }))
    .sort((a, b) => a.value - b.value)

  const at = (kind: LadderKind) => points.find(p => p.kind === kind)?.position
  const zones: LadderZone[] = []
  const open = at('open')
  const good = at('good')
  const walk = at('walk')
  if (good !== undefined) zones.push({ tone: 'ok', from: 0, to: good })
  else if (open !== undefined) zones.push({ tone: 'ok', from: 0, to: open })
  if (walk !== undefined) {
    const start = good ?? open ?? 0
    if (walk > start) zones.push({ tone: 'warn', from: start, to: walk })
    zones.push({ tone: 'bad', from: walk, to: 100 })
  }

  return { points, zones }
}
