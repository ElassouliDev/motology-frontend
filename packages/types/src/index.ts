/**
 * Shared types for the Motology gateway contract (AutomotiveAI gateway,
 * `/api/motology/*`). Field names mirror the wire format exactly.
 *
 * Every number here is produced by the AutomotiveAI engine. The frontend
 * renders these values; it never derives or computes prices from them.
 *
 * Numeric (and most scalar) fields inside the negotiation state are typed as
 * nullable on purpose: the engine may omit them, and the API client
 * normalises anything missing or malformed to `null` so the UI must handle
 * the gap explicitly instead of rendering `NaN` or `undefined`.
 */

// ── Vehicle ───────────────────────────────────────────────────────────────────
export interface Vehicle {
  stock_number: string
  vin: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  price: number | null
  mileage: number | null
  condition: string | null
  exterior_color: string | null
  image_url: string | null
}

export interface VehicleSearchParams {
  make?: string
  model?: string
  max_price?: number
  year_min?: number
  q?: string
}

// ── Pricing / negotiation state ───────────────────────────────────────────────
export interface PricingFrame {
  list_price: number | null
  market_price: number | null
  open_offer: number | null
  good_price: number | null
  walk_away: number | null
  /** Percentage points over market (e.g. 4.2 means 4.2% over market). */
  over_market_pct: number | null
  confidence_tier: number | null
  deal_state: string | null
}

export interface CurrentOffer {
  user_offer: number | null
  asking_price: number | null
  round: number | null
  /** Typically 'accept' | 'counter' | 'reject'; other values are passed through. */
  action: string | null
  counter_price: number | null
  deal_score: number | null
}

export interface ScenarioStat {
  key: string
  value: string
}

export interface ScenarioPrimaryAction {
  label: string
  action: string
  offer_amount?: number | null
}

export interface ScenarioSummary {
  scenario_id: string
  recommendation: string
  stats: ScenarioStat[]
  data_source: string | null
  confidence: string | number | null
  primary_action?: ScenarioPrimaryAction
}

export interface MotologyVehicleRef {
  stock_number: string | null
  year: number | null
  make: string | null
  model: string | null
}

/** Price plus real sales tax and government fees for the buyer's ZIP (TTL service). */
export interface OutTheDoor {
  zip_code: string
  /** Which price it is built on, e.g. 'the good price' or 'your last offer'. */
  basis: string | null
  price: number
  sales_tax: number
  fees_total: number
  out_the_door: number
  trade_in: number | null
  down_payment: number | null
  amount_financed: number | null
  months: number | null
  assumed_apr: number | null
  est_monthly_payment: number | null
}

export interface MotologyState {
  pricing_frame: PricingFrame | null
  current_offer: CurrentOffer | null
  deal_score: number | null
  last_scenario: ScenarioSummary | null
  vehicle: MotologyVehicleRef | null
  /** Absent from older gateways; null until the buyer asks for an out-the-door estimate. */
  out_the_door?: OutTheDoor | null
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatRequest {
  /** 1..2000 characters. */
  message: string
  conversation_id?: string
  zip_code?: string
  stock_number?: string
}

export interface ChatResponse {
  conversation_id: string
  reply: string
  turn_count: number
  handoff: boolean
  motology: MotologyState
  /**
   * Set once the conversation has been handed to the dealership: the id of the
   * contact request the buyer confirms on /confirm/<id> so a person can reach
   * them. Null before a handoff, or when contact requests are not configured.
   */
  contact_request_id: string | null
}

export type ConversationState = MotologyState & { conversation_id: string }

// ── Contact requests (agent-initiated dealer contact) ─────────────────────────
/**
 * An outside AI agent asked Motology to have the dealer contact its human.
 * Nothing reaches the dealer until the buyer opens the confirmation link,
 * enters their details and explicitly consents.
 */
export type ContactRequestStatus = 'pending' | 'confirmed' | 'expired'

export interface ContactRequestVehicle {
  stock_number: string | null
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  price: number | null
  image_url: string | null
}

export interface ContactRequest {
  id: string
  status: ContactRequestStatus
  /** Display name of the requesting agent; `null` when the request came from motology.ai itself. */
  agent_name: string | null
  vehicle: ContactRequestVehicle | null
  /** What the agent said the buyer wants. Untrusted text: render as plain text only. */
  buyer_note: string | null
  /** The exact disclosure to show next to the consent checkbox. */
  consent_text: string
  /** ISO-8601 timestamp. */
  expires_at: string
}

export interface ContactConfirmRequest {
  /** 1..100 characters. */
  first_name: string
  /** 1..100 characters. */
  last_name: string
  /** At most 32 characters. At least one of `phone` / `email` is required. */
  phone?: string
  /** At most 254 characters. */
  email?: string
  consent: true
  /** Preferred test drive: ISO-8601 with a UTC offset, within the next 60 days. */
  test_drive_at?: string
}

/**
 * What became of the buyer's preferred test drive. `booked`: on the rep's
 * calendar. `requested`: the dealership will confirm the time. `unavailable`:
 * the store is closed or the rep is booked then. `failed`: not booked; the
 * dealership will follow up.
 */
export interface TestDriveOutcome {
  status: 'booked' | 'requested' | 'unavailable' | 'failed'
  scheduled_at: string | null
}

export interface ContactConfirmResponse {
  status: 'confirmed'
  test_drive: TestDriveOutcome | null
}

// ── Envelopes ─────────────────────────────────────────────────────────────────
export interface DataEnvelope<T> {
  data: T
}

export interface ErrorBody {
  detail: string
}
