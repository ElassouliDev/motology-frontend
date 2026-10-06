/**
 * Input validation for the BFF route handlers and server pages.
 * Shared constants are also imported by client components (no server deps here).
 */
import type { VehicleSearchParams } from '@motology/types'

export const MAX_MESSAGE_LENGTH = 2000

const STOCK_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const ZIP_CODE_RE = /^\d{5}$/
const MAX_FILTER_TEXT_LENGTH = 60
const MIN_YEAR = 1900
const MAX_YEAR = 2100
const MAX_PRICE = 10_000_000

export function isValidStockNumber(value: unknown): value is string {
  return typeof value === 'string' && STOCK_NUMBER_RE.test(value)
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export interface ChatInput {
  message: string
  zip_code?: string
  stock_number?: string
  /** Ignore the session cookie and start a fresh gateway conversation. */
  new_conversation: boolean
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseChatInput(body: unknown): ValidationResult<ChatInput> {
  if (!isPlainObject(body)) return { ok: false, error: 'Request body must be a JSON object.' }

  const { message, zip_code, stock_number, new_conversation } = body

  if (typeof message !== 'string') return { ok: false, error: '"message" must be a string.' }
  const trimmed = message.trim()
  if (trimmed.length === 0) return { ok: false, error: '"message" must not be empty.' }
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `"message" must be at most ${MAX_MESSAGE_LENGTH} characters.` }
  }

  const value: ChatInput = { message: trimmed, new_conversation: false }

  if (zip_code !== undefined && zip_code !== null) {
    if (typeof zip_code !== 'string' || !ZIP_CODE_RE.test(zip_code)) {
      return { ok: false, error: '"zip_code" must be a 5-digit US ZIP code.' }
    }
    value.zip_code = zip_code
  }

  if (stock_number !== undefined && stock_number !== null) {
    if (!isValidStockNumber(stock_number)) {
      return { ok: false, error: '"stock_number" is invalid.' }
    }
    value.stock_number = stock_number
  }

  if (new_conversation !== undefined) {
    if (typeof new_conversation !== 'boolean') {
      return { ok: false, error: '"new_conversation" must be a boolean.' }
    }
    value.new_conversation = new_conversation
  }

  return { ok: true, value }
}

// ── Vehicle search ────────────────────────────────────────────────────────────

export type RawSearchParams = Record<string, string | string[] | undefined>

export interface SearchFormValues {
  q: string
  make: string
  model: string
  max_price: string
  year_min: string
}

function first(value: string | string[] | undefined): string {
  const v = Array.isArray(value) ? value[0] : value
  return (v ?? '').trim()
}

function text(value: string): string | undefined {
  if (!value) return undefined
  return value.slice(0, MAX_FILTER_TEXT_LENGTH)
}

function integerInRange(value: string, min: number, max: number): number | undefined {
  if (!/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined
}

/**
 * Turns untrusted query-string values into gateway search params. Invalid
 * numeric filters are dropped (and reported) rather than forwarded.
 */
export function parseSearchParams(raw: RawSearchParams): {
  params: VehicleSearchParams
  form: SearchFormValues
  hasFilters: boolean
  invalid: Array<keyof SearchFormValues>
} {
  const form: SearchFormValues = {
    q: first(raw.q),
    make: first(raw.make),
    model: first(raw.model),
    max_price: first(raw.max_price),
    year_min: first(raw.year_min),
  }
  const params: VehicleSearchParams = {}
  const invalid: Array<keyof SearchFormValues> = []

  const q = text(form.q)
  if (q) params.q = q
  const make = text(form.make)
  if (make) params.make = make
  const model = text(form.model)
  if (model) params.model = model

  if (form.max_price) {
    const n = integerInRange(form.max_price, 1, MAX_PRICE)
    if (n === undefined) invalid.push('max_price')
    else params.max_price = n
  }
  if (form.year_min) {
    const n = integerInRange(form.year_min, MIN_YEAR, MAX_YEAR)
    if (n === undefined) invalid.push('year_min')
    else params.year_min = n
  }

  return { params, form, hasFilters: Object.keys(params).length > 0, invalid }
}
