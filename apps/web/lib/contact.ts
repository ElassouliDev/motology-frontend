/**
 * Validation for the buyer contact-confirmation form.
 *
 * Shared by the BFF route (`POST /api/contact-requests/[id]/confirm`) and the
 * client form component, so it must not import anything server-only.
 */
import type { ContactConfirmRequest } from '@motology/types'

export const MAX_NAME_LENGTH = 100
export const MAX_EMAIL_LENGTH = 254
/** Gateway limit for `phone`. Normalised numbers (`+1XXXXXXXXXX`) are 12 characters. */
export const MAX_PHONE_LENGTH = 32

const CONTACT_REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/

export function isValidContactRequestId(value: unknown): value is string {
  return typeof value === 'string' && CONTACT_REQUEST_ID_RE.test(value)
}

/**
 * Common US formats: `5551234567`, `555-123-4567`, `555.123.4567`,
 * `(555) 123-4567`, `+1 555 123 4567`, `1-555-123-4567`.
 */
const US_PHONE_FORMAT_RE = /^(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}$/
/** NANP: area code and exchange both start with 2-9. */
const NANP_DIGITS_RE = /^[2-9]\d{2}[2-9]\d{6}$/

/** Returns the number in E.164 form (`+15551234567`), or `null` if it is not a valid US number. */
export function normalizeUsPhone(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length > MAX_PHONE_LENGTH || !US_PHONE_FORMAT_RE.test(trimmed)) return null
  let digits = trimmed.replace(/\D/g, '')
  if (digits.length === 11) digits = digits.slice(1)
  return NANP_DIGITS_RE.test(digits) ? `+1${digits}` : null
}

/** Deliberately simple: one `@`, no whitespace, a dot in the domain. The dealer verifies it. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/

export function isValidEmail(value: string): boolean {
  return value.length <= MAX_EMAIL_LENGTH && EMAIL_RE.test(value)
}

export type ContactField = 'first_name' | 'last_name' | 'phone' | 'email' | 'consent' | 'test_drive_at'

export type ContactValidationResult =
  | { ok: true; value: ContactConfirmRequest }
  | { ok: false; error: string; field?: ContactField }

// Control characters (incl. newlines) have no place in a name.
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/

function parseName(
  value: unknown,
  label: string,
  field: ContactField,
): { ok: true; value: string } | { ok: false; error: string; field: ContactField } {
  if (typeof value !== 'string') return { ok: false, error: `${label} is required.`, field }
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: `${label} is required.`, field }
  if (trimmed.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `${label} must be at most ${MAX_NAME_LENGTH} characters.`, field }
  }
  if (CONTROL_CHARS_RE.test(trimmed)) return { ok: false, error: `${label} contains invalid characters.`, field }
  return { ok: true, value: trimmed }
}

/** How far ahead a test drive may be asked for; matches the gateway and CRM. */
export const TEST_DRIVE_MAX_DAYS = 60
/** ISO-8601 with seconds and an explicit offset, e.g. `2026-09-12T10:00:00-05:00`. */
const OFFSET_ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

/**
 * A local date (`YYYY-MM-DD`) and hour as ISO-8601 with this browser's UTC
 * offset for that day, so the time means what the buyer picked.
 */
export function localTestDriveIso(date: string, hour: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m || !Number.isInteger(hour) || hour < 0 || hour > 23) return null
  const at = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hour, 0, 0)
  if (Number.isNaN(at.getTime()) || at.getDate() !== Number(m[3])) return null
  const offset = -at.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${m[1]}-${m[2]}-${m[3]}T${pad(hour)}:00:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** A test-drive time the gateway will accept: offset ISO, in the future, within the window. */
export function isValidTestDriveTime(value: string, now: Date = new Date()): boolean {
  if (!OFFSET_ISO_RE.test(value)) return false
  const at = Date.parse(value)
  return !Number.isNaN(at) && at > now.getTime() && at < now.getTime() + TEST_DRIVE_MAX_DAYS * 86_400_000
}

/** `undefined`, `null` and blank strings all mean "not provided". */
function optionalString(value: unknown): { ok: true; value: string | undefined } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: undefined }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim()
  return { ok: true, value: trimmed || undefined }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates and normalises a confirmation body. Unknown fields are dropped.
 * `consent` must be the boolean `true`; anything else (missing, `"true"`, `1`)
 * is rejected.
 */
export function parseContactConfirmInput(body: unknown): ContactValidationResult {
  if (!isPlainObject(body)) return { ok: false, error: 'Request body must be a JSON object.' }

  const first = parseName(body.first_name, 'First name', 'first_name')
  if (!first.ok) return first
  const last = parseName(body.last_name, 'Last name', 'last_name')
  if (!last.ok) return last

  const rawPhone = optionalString(body.phone)
  if (!rawPhone.ok) return { ok: false, error: 'Phone must be text.', field: 'phone' }
  const rawEmail = optionalString(body.email)
  if (!rawEmail.ok) return { ok: false, error: 'Email must be text.', field: 'email' }

  if (!rawPhone.value && !rawEmail.value) {
    return { ok: false, error: 'Enter a phone number or an email address.', field: 'phone' }
  }

  const value: ContactConfirmRequest = { first_name: first.value, last_name: last.value, consent: true }

  if (rawPhone.value) {
    const phone = normalizeUsPhone(rawPhone.value)
    if (!phone) return { ok: false, error: 'Enter a valid US phone number, e.g. (555) 234-5678.', field: 'phone' }
    value.phone = phone
  }
  if (rawEmail.value) {
    if (!isValidEmail(rawEmail.value)) {
      return { ok: false, error: 'Enter a valid email address.', field: 'email' }
    }
    value.email = rawEmail.value
  }

  const rawDrive = optionalString(body.test_drive_at)
  if (!rawDrive.ok) return { ok: false, error: 'Pick a test drive time.', field: 'test_drive_at' }
  if (rawDrive.value) {
    if (!isValidTestDriveTime(rawDrive.value)) {
      return {
        ok: false,
        error: `Pick a test drive time in the next ${TEST_DRIVE_MAX_DAYS} days.`,
        field: 'test_drive_at',
      }
    }
    value.test_drive_at = rawDrive.value
  }

  if (body.consent !== true) {
    return { ok: false, error: 'Please tick the box to agree to be contacted.', field: 'consent' }
  }

  return { ok: true, value }
}
