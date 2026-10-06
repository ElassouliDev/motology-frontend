'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import type { TestDriveOutcome } from '@motology/types'
import {
  localTestDriveIso,
  MAX_EMAIL_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  parseContactConfirmInput,
  TEST_DRIVE_MAX_DAYS,
  type ContactField,
} from '@/lib/contact'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PRIVACY_URL } from '@/lib/site'
import { cn } from '@/lib/utils'

interface Props {
  requestId: string
  /** Disclosure from the gateway, shown verbatim next to the checkbox. */
  consentText: string
}

type FormState =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'error'; message: string; field?: ContactField }
  | { kind: 'done'; testDrive: TestDriveOutcome | null }

const FALLBACK_MESSAGES: Record<number, string> = {
  404: "We couldn't find this request. Ask your assistant to send you a new link.",
  409: 'This request has already been confirmed or has expired.',
  413: 'Your details are too long. Please shorten them and try again.',
  422: 'Some of your details were not accepted. Please check them and try again.',
  429: 'Too many attempts. Please wait a minute and try again.',
}
const GENERIC_ERROR = 'Something went wrong. Please try again.'

function errorMessage(status: number, body: unknown): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const { error } = body as { error: unknown }
    if (typeof error === 'string' && error) return error
  }
  return FALLBACK_MESSAGES[status] ?? GENERIC_ERROR
}

const CONTACT_FIELDS: readonly ContactField[] = ['first_name', 'last_name', 'phone', 'email', 'consent', 'test_drive_at']

function isContactField(value: unknown): value is ContactField {
  return CONTACT_FIELDS.some(f => f === value)
}

/** Bookable hours offered, store-local: 9 AM to 6 PM. The dealership's schedule has the final say. */
const TEST_DRIVE_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:00 ${hour < 12 ? 'AM' : 'PM'}`
}

function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatDriveTime(iso: string | null): string | null {
  if (!iso) return null
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return null
  return at.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function testDriveMessage(drive: TestDriveOutcome | null): string | null {
  if (!drive) return null
  const when = formatDriveTime(drive.scheduled_at)
  switch (drive.status) {
    case 'booked':
      return when ? `Your test drive is booked for ${when}.` : 'Your test drive is booked.'
    case 'requested':
      return when
        ? `We asked for a test drive on ${when}. The dealership will confirm the time with you.`
        : 'The dealership will confirm a test drive time with you.'
    case 'unavailable':
      return "That test drive time isn't available. The dealership will reach out to find another."
    default:
      return 'The dealership will reach out to set up your test drive.'
  }
}

const inputClass = 'input'

export function ConfirmContactForm({ requestId, consentText }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  // Never pre-ticked: the buyer must opt in themselves.
  const [consent, setConsent] = useState(false)
  const [wantsDrive, setWantsDrive] = useState(false)
  const [driveDate, setDriveDate] = useState('')
  const [driveHour, setDriveHour] = useState('10')
  const [state, setState] = useState<FormState>({ kind: 'idle' })
  const inFlight = useRef<AbortController | null>(null)
  const ids = useId()

  useEffect(() => () => inFlight.current?.abort(), [])

  // Tomorrow through the end of the window, in the buyer's own calendar.
  const [minDate, maxDate] = useMemo(() => {
    const now = new Date()
    const first = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + TEST_DRIVE_MAX_DAYS - 1)
    return [localDate(first), localDate(last)]
  }, [])

  const pending = state.kind === 'pending'
  const errorField = state.kind === 'error' ? state.field : undefined

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || !consent) return

    let testDriveAt: string | undefined
    if (wantsDrive) {
      testDriveAt = localTestDriveIso(driveDate, Number(driveHour)) ?? undefined
      if (!testDriveAt) {
        setState({ kind: 'error', message: 'Pick a day for your test drive.', field: 'test_drive_at' })
        return
      }
    }
    const parsed = parseContactConfirmInput({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      consent,
      test_drive_at: testDriveAt,
    })
    if (!parsed.ok) {
      setState({ kind: 'error', message: parsed.error, field: parsed.field })
      return
    }

    setState({ kind: 'pending' })
    const controller = new AbortController()
    inFlight.current = controller
    try {
      const res = await fetch(`/api/contact-requests/${encodeURIComponent(requestId)}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.value),
        signal: controller.signal,
      })
      const body: unknown = await res.json().catch(() => null)
      if (res.ok) {
        const drive =
          typeof body === 'object' && body !== null && 'test_drive' in body
            ? ((body as { test_drive: TestDriveOutcome | null }).test_drive ?? null)
            : null
        setState({ kind: 'done', testDrive: drive })
        return
      }
      const field =
        typeof body === 'object' && body !== null && 'field' in body && isContactField(body.field)
          ? body.field
          : undefined
      setState({ kind: 'error', message: errorMessage(res.status, body), field })
    } catch (err) {
      if (controller.signal.aborted) return
      console.error('[motology] confirm contact request failed', err instanceof Error ? err.name : typeof err)
      setState({ kind: 'error', message: GENERIC_ERROR })
    } finally {
      if (inFlight.current === controller) inFlight.current = null
    }
  }

  if (state.kind === 'done') {
    return (
      <div role="status" className="card animate-scale-in flex flex-col items-center px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok">
          <Icon name="check-circle" size={22} />
        </span>
        <p className="mt-4 text-xl font-semibold tracking-tight">You&apos;re all set</p>
        <p className="mt-1.5 max-w-sm text-muted">
          We&apos;ve sent your details to the dealership, and someone will reach out soon. You can close this page.
        </p>
        {testDriveMessage(state.testDrive) && (
          <p className="mt-4 flex max-w-sm items-start gap-2 rounded-xl bg-surface-2 px-4 py-3 text-left text-sm">
            <Icon name="calendar" size={16} className="mt-0.5 shrink-0 text-brand" />
            {testDriveMessage(state.testDrive)}
          </p>
        )}
      </div>
    )
  }

  const errorId = `${ids}-error`
  const describedBy = (field: ContactField) => (errorField === field ? errorId : undefined)

  return (
    <form onSubmit={onSubmit} noValidate className="card space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">How should they reach you?</h2>
        <p className="mt-0.5 text-sm text-muted">Enter a phone number, an email address, or both.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="field-label">
          First name
          <input
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={MAX_NAME_LENGTH}
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            aria-invalid={errorField === 'first_name' || undefined}
            aria-describedby={describedBy('first_name')}
            className={inputClass}
          />
        </label>
        <label className="field-label">
          Last name
          <input
            name="last_name"
            autoComplete="family-name"
            required
            maxLength={MAX_NAME_LENGTH}
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            aria-invalid={errorField === 'last_name' || undefined}
            aria-describedby={describedBy('last_name')}
            className={inputClass}
          />
        </label>
        <label className="field-label">
          Phone
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 234-5678"
            maxLength={MAX_PHONE_LENGTH}
            value={phone}
            onChange={e => setPhone(e.target.value)}
            aria-invalid={errorField === 'phone' || undefined}
            aria-describedby={describedBy('phone')}
            className={inputClass}
          />
        </label>
        <label className="field-label">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={MAX_EMAIL_LENGTH}
            value={email}
            onChange={e => setEmail(e.target.value)}
            aria-invalid={errorField === 'email' || undefined}
            aria-describedby={describedBy('email')}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset className="space-y-3">
        <legend className="sr-only">Test drive</legend>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={wantsDrive}
            onChange={e => setWantsDrive(e.target.checked)}
            className="h-[18px] w-[18px] shrink-0 cursor-pointer accent-[rgb(var(--brand))]"
          />
          I&apos;d like to book a test drive
        </label>
        {wantsDrive && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Day
              <input
                name="test_drive_date"
                type="date"
                min={minDate}
                max={maxDate}
                value={driveDate}
                onChange={e => setDriveDate(e.target.value)}
                aria-invalid={errorField === 'test_drive_at' || undefined}
                aria-describedby={describedBy('test_drive_at')}
                className={inputClass}
              />
            </label>
            <label className="field-label">
              Time
              <select
                name="test_drive_hour"
                value={driveHour}
                onChange={e => setDriveHour(e.target.value)}
                className={inputClass}
              >
                {TEST_DRIVE_HOURS.map(h => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[13px] text-muted sm:col-span-2">
              The dealership books it if the time is open, or confirms another time with you.
            </p>
          </div>
        )}
      </fieldset>

      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed text-ink transition-colors',
          consent ? 'border-brand/40 bg-brand-soft/60' : 'border-border bg-surface-2/60 hover:border-ink/20',
        )}
      >
        <input
          name="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          aria-invalid={errorField === 'consent' || undefined}
          aria-describedby={describedBy('consent')}
          className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[rgb(var(--brand))]"
        />
        <span className="whitespace-pre-wrap">{consentText}</span>
      </label>

      {state.kind === 'error' && (
        <div id={errorId} role="alert" className="flex items-start gap-2 rounded-xl border border-bad/25 bg-bad/10 p-3.5 text-sm text-bad">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={!consent || pending}
        className={buttonClass({ size: 'lg' }, 'w-full')}
      >
        {pending ? 'Sending…' : 'Have the dealership contact me'}
      </button>
      {PRIVACY_URL && (
        <p className="text-center text-xs text-muted">
          How we handle your details:{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline-offset-2 hover:underline">
            Privacy policy
          </a>
        </p>
      )}
    </form>
  )
}
