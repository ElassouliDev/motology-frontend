/**
 * Display formatting only. Values come from the AutomotiveAI engine and are
 * rendered as-is: nothing here derives new numbers from them.
 */

export const EMPTY = '—'

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 })

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function formatCurrency(value: number | null | undefined): string {
  return isFiniteNumber(value) ? usd.format(value) : EMPTY
}

export function formatInteger(value: number | null | undefined): string {
  return isFiniteNumber(value) ? integer.format(value) : EMPTY
}

export function formatMileage(value: number | null | undefined): string {
  return isFiniteNumber(value) ? `${integer.format(value)} mi` : EMPTY
}

/** `value` is already in percentage points (4.2 → "4.2%"). */
export function formatPercentPoints(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return EMPTY
  return `${value > 0 ? '+' : ''}${decimal.format(value)}%`
}

export function hasValue(value: number | null | undefined): value is number {
  return isFiniteNumber(value)
}

export function humanize(value: string | null | undefined): string {
  if (!value) return EMPTY
  const spaced = value.replace(/[_-]+/g, ' ').trim().toLowerCase()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : EMPTY
}

/** A stat label for display: raw keys (`market_value`) are humanised, written labels kept as is. */
export function statLabel(key: string): string {
  return /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(key) ? humanize(key) : key
}

export function vehicleTitle(v: {
  year: number | null
  make: string | null
  model: string | null
}): string {
  const parts = [isFiniteNumber(v.year) ? String(v.year) : null, v.make, v.model].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  )
  return parts.length > 0 ? parts.join(' ') : 'Vehicle'
}

/** Only https image URLs: plain http would be mixed content on an https page. */
export function safeImageUrl(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/** Unsigned percentage, for phrases like "4.2% above". `value` is in percentage points. */
export function formatPercentMagnitude(value: number | null | undefined): string {
  return isFiniteNumber(value) ? `${decimal.format(Math.abs(value))}%` : EMPTY
}
