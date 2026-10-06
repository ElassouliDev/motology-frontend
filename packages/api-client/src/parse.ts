/**
 * Runtime normalisation of gateway responses.
 *
 * The gateway is a separate service, so its payloads are treated as untrusted
 * input: required identifiers are validated (a failure becomes an
 * `invalid_response` error) and every optional scalar is coerced to the
 * expected type or `null`. No values are derived or computed here.
 */
import type {
  ChatResponse,
  ContactConfirmResponse,
  ContactRequest,
  ContactRequestStatus,
  ContactRequestVehicle,
  ConversationState,
  CurrentOffer,
  MotologyState,
  MotologyVehicleRef,
  OutTheDoor,
  PricingFrame,
  ScenarioPrimaryAction,
  ScenarioStat,
  ScenarioSummary,
  TestDriveOutcome,
  Vehicle,
} from '@motology/types'

export class InvalidResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidResponseError'
  }
}

type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Finite number, or a numeric string the engine serialised as text; otherwise null. */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InvalidResponseError(`Gateway response is missing "${field}"`)
  }
  return value
}

function requireRecord(value: unknown, what: string): UnknownRecord {
  if (!isRecord(value)) throw new InvalidResponseError(`Gateway returned a malformed ${what}`)
  return value
}

function unwrapData(body: unknown, what: string): unknown {
  return requireRecord(body, what).data
}

export function parseVehicle(value: unknown): Vehicle {
  const v = requireRecord(value, 'vehicle')
  return {
    stock_number: requireString(v.stock_number, 'stock_number'),
    vin: toStringOrNull(v.vin),
    year: toNumber(v.year),
    make: toStringOrNull(v.make),
    model: toStringOrNull(v.model),
    trim: toStringOrNull(v.trim),
    price: toNumber(v.price),
    mileage: toNumber(v.mileage),
    condition: toStringOrNull(v.condition),
    exterior_color: toStringOrNull(v.exterior_color),
    image_url: toStringOrNull(v.image_url),
  }
}

export function parsePricingFrame(value: unknown): PricingFrame | null {
  if (!isRecord(value)) return null
  return {
    list_price: toNumber(value.list_price),
    market_price: toNumber(value.market_price),
    open_offer: toNumber(value.open_offer),
    good_price: toNumber(value.good_price),
    walk_away: toNumber(value.walk_away),
    over_market_pct: toNumber(value.over_market_pct),
    confidence_tier: toNumber(value.confidence_tier),
    deal_state: toStringOrNull(value.deal_state),
  }
}

export function parseCurrentOffer(value: unknown): CurrentOffer | null {
  if (!isRecord(value)) return null
  return {
    user_offer: toNumber(value.user_offer),
    asking_price: toNumber(value.asking_price),
    round: toNumber(value.round),
    action: toStringOrNull(value.action),
    counter_price: toNumber(value.counter_price),
    deal_score: toNumber(value.deal_score),
  }
}

function parseStats(value: unknown): ScenarioStat[] {
  if (!Array.isArray(value)) return []
  const stats: ScenarioStat[] = []
  for (const item of value) {
    if (!isRecord(item) || typeof item.key !== 'string') continue
    const raw = item.value
    if (typeof raw === 'string') stats.push({ key: item.key, value: raw })
    else if (typeof raw === 'number' && Number.isFinite(raw)) stats.push({ key: item.key, value: String(raw) })
  }
  return stats
}

function parsePrimaryAction(value: unknown): ScenarioPrimaryAction | undefined {
  if (!isRecord(value) || typeof value.label !== 'string' || typeof value.action !== 'string') {
    return undefined
  }
  return { label: value.label, action: value.action, offer_amount: toNumber(value.offer_amount) }
}

export function parseScenario(value: unknown): ScenarioSummary | null {
  if (!isRecord(value) || typeof value.recommendation !== 'string') return null
  const confidence =
    typeof value.confidence === 'string' ? value.confidence : toNumber(value.confidence)
  const primaryAction = parsePrimaryAction(value.primary_action)
  return {
    scenario_id: typeof value.scenario_id === 'string' ? value.scenario_id : '',
    recommendation: value.recommendation,
    stats: parseStats(value.stats),
    data_source: toStringOrNull(value.data_source),
    confidence,
    ...(primaryAction ? { primary_action: primaryAction } : {}),
  }
}

function parseVehicleRef(value: unknown): MotologyVehicleRef | null {
  if (!isRecord(value)) return null
  return {
    stock_number: toStringOrNull(value.stock_number),
    year: toNumber(value.year),
    make: toStringOrNull(value.make),
    model: toStringOrNull(value.model),
  }
}

const ZIP5_RE = /^\d{5}$/

/** An estimate with all four money figures, or null: never a partial total. */
export function parseOutTheDoor(value: unknown): OutTheDoor | null {
  if (!isRecord(value)) return null
  const zip = typeof value.zip_code === 'string' && ZIP5_RE.test(value.zip_code) ? value.zip_code : null
  const price = toNumber(value.price)
  const tax = toNumber(value.sales_tax)
  const fees = toNumber(value.fees_total)
  const total = toNumber(value.out_the_door)
  if (zip === null || price === null || tax === null || fees === null || total === null) return null
  return {
    zip_code: zip,
    basis: toStringOrNull(value.basis),
    price,
    sales_tax: tax,
    fees_total: fees,
    out_the_door: total,
    trade_in: toNumber(value.trade_in),
    down_payment: toNumber(value.down_payment),
    amount_financed: toNumber(value.amount_financed),
    months: toNumber(value.months),
    assumed_apr: toNumber(value.assumed_apr),
    est_monthly_payment: toNumber(value.est_monthly_payment),
  }
}

export function parseMotologyState(value: unknown): MotologyState {
  const s = isRecord(value) ? value : {}
  return {
    pricing_frame: parsePricingFrame(s.pricing_frame),
    current_offer: parseCurrentOffer(s.current_offer),
    deal_score: toNumber(s.deal_score),
    last_scenario: parseScenario(s.last_scenario),
    vehicle: parseVehicleRef(s.vehicle),
    out_the_door: parseOutTheDoor(s.out_the_door),
  }
}

/** Contact-request ids are gateway-minted capabilities: 16-64 URL-safe characters. */
const CONTACT_REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/

export function parseChatResponse(body: unknown): ChatResponse {
  const r = requireRecord(body, 'chat response')
  return {
    conversation_id: requireString(r.conversation_id, 'conversation_id'),
    reply: typeof r.reply === 'string' ? r.reply : '',
    turn_count: toNumber(r.turn_count) ?? 0,
    handoff: r.handoff === true,
    motology: parseMotologyState(r.motology),
    contact_request_id:
      typeof r.contact_request_id === 'string' && CONTACT_REQUEST_ID_RE.test(r.contact_request_id)
        ? r.contact_request_id
        : null,
  }
}

export function parseConversationEnvelope(body: unknown): ConversationState {
  const data = requireRecord(unwrapData(body, 'conversation response'), 'conversation')
  return {
    ...parseMotologyState(data),
    conversation_id: requireString(data.conversation_id, 'conversation_id'),
  }
}

export function parseVehicleListEnvelope(body: unknown): Vehicle[] {
  const data = unwrapData(body, 'vehicle list response')
  if (!Array.isArray(data)) throw new InvalidResponseError('Gateway returned a malformed vehicle list')
  const vehicles: Vehicle[] = []
  let dropped = 0
  for (const item of data) {
    // Skip individual malformed rows rather than failing the whole search.
    try {
      vehicles.push(parseVehicle(item))
    } catch (err) {
      if (!(err instanceof InvalidResponseError)) throw err
      dropped += 1
    }
  }
  if (dropped > 0) {
    console.warn(`motology: dropped ${dropped} of ${data.length} malformed vehicle rows`)
  }
  // Every row bad is a broken response, not an empty lot: never tell the buyer
  // "no cars listed" when the cars are there but unreadable.
  if (data.length > 0 && vehicles.length === 0) {
    throw new InvalidResponseError('Gateway returned no readable vehicles')
  }
  return vehicles
}

export function parseVehicleEnvelope(body: unknown): Vehicle {
  return parseVehicle(unwrapData(body, 'vehicle response'))
}

const CONTACT_REQUEST_STATUSES: readonly ContactRequestStatus[] = ['pending', 'confirmed', 'expired']

function parseContactRequestStatus(value: unknown): ContactRequestStatus {
  const status = CONTACT_REQUEST_STATUSES.find(s => s === value)
  if (!status) throw new InvalidResponseError('Gateway returned an unknown contact request status')
  return status
}

function parseContactRequestVehicle(value: unknown): ContactRequestVehicle | null {
  if (!isRecord(value)) return null
  return {
    stock_number: toStringOrNull(value.stock_number),
    year: toNumber(value.year),
    make: toStringOrNull(value.make),
    model: toStringOrNull(value.model),
    trim: toStringOrNull(value.trim),
    price: toNumber(value.price),
    image_url: toStringOrNull(value.image_url),
  }
}

/**
 * `consent_text` is required: without the exact disclosure the buyer cannot
 * give informed consent, so a response missing it is unusable.
 */
export function parseContactRequestEnvelope(body: unknown): ContactRequest {
  const data = requireRecord(unwrapData(body, 'contact request response'), 'contact request')
  return {
    id: requireString(data.id, 'id'),
    status: parseContactRequestStatus(data.status),
    agent_name: toStringOrNull(data.agent_name),
    vehicle: parseContactRequestVehicle(data.vehicle),
    buyer_note: toStringOrNull(data.buyer_note),
    consent_text: requireString(data.consent_text, 'consent_text'),
    expires_at: requireString(data.expires_at, 'expires_at'),
  }
}

const TEST_DRIVE_STATUSES: readonly TestDriveOutcome['status'][] = ['booked', 'requested', 'unavailable', 'failed']

function parseTestDrive(value: unknown): TestDriveOutcome | null {
  if (!isRecord(value)) return null
  const status = TEST_DRIVE_STATUSES.find(s => s === value.status)
  if (!status) return null
  const at = typeof value.scheduled_at === 'string' && !Number.isNaN(Date.parse(value.scheduled_at))
    ? value.scheduled_at
    : null
  return { status, scheduled_at: at }
}

export function parseContactConfirmEnvelope(body: unknown): ContactConfirmResponse {
  const data = requireRecord(unwrapData(body, 'contact confirmation response'), 'contact confirmation')
  if (data.status !== 'confirmed') {
    throw new InvalidResponseError('Gateway did not confirm the contact request')
  }
  return { status: 'confirmed', test_drive: parseTestDrive(data.test_drive) }
}

export function parseErrorDetail(body: unknown): string | undefined {
  return isRecord(body) && typeof body.detail === 'string' ? body.detail : undefined
}
