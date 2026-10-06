import { describe, expect, it } from 'vitest'
import {
  isValidContactRequestId,
  isValidEmail,
  isValidTestDriveTime,
  localTestDriveIso,
  normalizeUsPhone,
  parseContactConfirmInput,
} from '@/lib/contact'

describe('isValidContactRequestId', () => {
  it.each(['abcdefghijklmnop', 'cr_ABC-123_xyz-789', 'a'.repeat(64)])('accepts %j', id => {
    expect(isValidContactRequestId(id)).toBe(true)
  })

  it.each(['abcdefghijklmno', 'a'.repeat(65), 'abcdefghijklmnop/', 'abcdefghijklmnop.', '', 42, null])(
    'rejects %j',
    id => {
      expect(isValidContactRequestId(id)).toBe(false)
    },
  )
})

describe('normalizeUsPhone', () => {
  it.each([
    '5552345678',
    '555-234-5678',
    '555.234.5678',
    '555 234 5678',
    '(555) 234-5678',
    '(555)234-5678',
    '+1 555 234 5678',
    '+1 (555) 234-5678',
    '1-555-234-5678',
    '15552345678',
    '+15552345678',
    '  555-234-5678  ',
  ])('accepts %j', input => {
    expect(normalizeUsPhone(input)).toBe('+15552345678')
  })

  it.each([
    '12345',
    '555-234-567',
    '555-234-56789',
    '055-234-5678', // area code cannot start with 0/1
    '555-034-5678', // exchange cannot start with 0/1
    '+44 20 7946 0958',
    '2-555-234-5678',
    '555-234-5678 ext 9',
    'call me',
    '555--234-5678',
  ])('rejects %j', input => {
    expect(normalizeUsPhone(input)).toBeNull()
  })
})

describe('isValidEmail', () => {
  it.each(['ada@example.com', 'a.b+c@sub.example.co.uk'])('accepts %j', email => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each(['ada', 'ada@example', 'ada@@example.com', 'a da@example.com', `${'a'.repeat(250)}@x.co`])(
    'rejects %j',
    email => {
      expect(isValidEmail(email)).toBe(false)
    },
  )
})

describe('parseContactConfirmInput', () => {
  it('requires a phone or an email', () => {
    expect(parseContactConfirmInput({ first_name: 'A', last_name: 'B', consent: true })).toMatchObject({
      ok: false,
      field: 'phone',
    })
  })

  it('rejects names containing control characters', () => {
    expect(
      parseContactConfirmInput({ first_name: 'A\nB', last_name: 'B', phone: '5552345678', consent: true }),
    ).toMatchObject({ ok: false, field: 'first_name' })
  })

  it('rejects non-string phone / email', () => {
    expect(
      parseContactConfirmInput({ first_name: 'A', last_name: 'B', phone: 5552345678, consent: true }),
    ).toMatchObject({ ok: false, field: 'phone' })
  })

  it('only accepts the boolean true as consent', () => {
    const base = { first_name: 'A', last_name: 'B', phone: '5552345678' }
    for (const consent of [undefined, false, 'true', 1, 'yes', {}]) {
      expect(parseContactConfirmInput({ ...base, consent })).toMatchObject({ ok: false, field: 'consent' })
    }
    expect(parseContactConfirmInput({ ...base, consent: true })).toEqual({
      ok: true,
      value: { first_name: 'A', last_name: 'B', phone: '+15552345678', consent: true },
    })
  })
})

describe('test drive time', () => {
  const NOW = new Date('2026-09-10T20:00:00Z')

  it('builds an ISO time with the browser offset for the picked day and hour', () => {
    const iso = localTestDriveIso('2026-09-12', 10)
    expect(iso).toMatch(/^2026-09-12T10:00:00[+-]\d{2}:\d{2}$/)
    expect(new Date(iso!).getHours()).toBe(10)
    expect(localTestDriveIso('2026-02-30', 10)).toBeNull()
    expect(localTestDriveIso('tomorrow', 10)).toBeNull()
    expect(localTestDriveIso('2026-09-12', 24)).toBeNull()
  })

  it('accepts only an offset time in the future and within the window', () => {
    expect(isValidTestDriveTime('2026-09-12T10:00:00-05:00', NOW)).toBe(true)
    expect(isValidTestDriveTime('2026-09-12T10:00:00', NOW)).toBe(false) // no offset
    expect(isValidTestDriveTime('2026-09-09T10:00:00-05:00', NOW)).toBe(false) // past
    expect(isValidTestDriveTime('2026-12-12T10:00:00-06:00', NOW)).toBe(false) // beyond 60 days
  })

  it('is optional, and a bad one names its field', () => {
    const base = { first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', consent: true }
    expect(parseContactConfirmInput(base)).toMatchObject({ ok: true, value: { email: 'ada@example.com' } })
    const bad = parseContactConfirmInput({ ...base, test_drive_at: 'next saturday' })
    expect(bad).toMatchObject({ ok: false, field: 'test_drive_at' })
  })
})
