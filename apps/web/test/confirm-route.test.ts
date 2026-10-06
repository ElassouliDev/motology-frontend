import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MotologyApiError, MotologyConfigError } from '@motology/api-client'
import type { ContactConfirmResponse } from '@motology/types'

const confirmMock = vi.fn<(...args: unknown[]) => Promise<ContactConfirmResponse>>()
const getClientMock = vi.fn(() => ({ confirmContactRequest: confirmMock }))

vi.mock('@/lib/server/motology', () => ({
  getMotologyClient: () => getClientMock(),
}))

// Imported after the mock is registered.
const { POST } = await import('@/app/api/contact-requests/[id]/confirm/route')

const ID = 'cr_ABCDEFGHijklmnop'

const validBody = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone: '(555) 234-5678',
  consent: true,
}

function confirmRequest(
  body: unknown,
  {
    id = ID,
    contentType = 'application/json',
    extraHeaders = {},
  }: { id?: string; contentType?: string; extraHeaders?: Record<string, string> } = {},
): [NextRequest, { params: Promise<{ id: string }> }] {
  const headers = new Headers({ ...extraHeaders, 'content-type': contentType })
  const request = new NextRequest(
    `http://localhost:3000/api/contact-requests/${encodeURIComponent(id)}/confirm`,
    { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) },
  )
  return [request, { params: Promise.resolve({ id }) }]
}

function forwarded(): { id: unknown; body: Record<string, unknown>; opts: Record<string, unknown> } {
  const call = confirmMock.mock.calls.at(-1)
  if (!call) throw new Error('gateway client was not called')
  return {
    id: call[0],
    body: call[1] as Record<string, unknown>,
    opts: call[2] as Record<string, unknown>,
  }
}

beforeEach(() => {
  confirmMock.mockReset()
  confirmMock.mockResolvedValue({ status: 'confirmed', test_drive: null })
  getClientMock.mockClear()
  getClientMock.mockImplementation(() => ({ confirmContactRequest: confirmMock }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('POST /api/contact-requests/[id]/confirm success', () => {
  it('forwards normalised details and returns confirmed with no-store', async () => {
    const res = await POST(...confirmRequest({ ...validBody, first_name: '  Ada ', extra: 'dropped' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'confirmed', test_drive: null })
    expect(res.headers.get('cache-control')).toBe('no-store')

    const call = forwarded()
    expect(call.id).toBe(ID)
    expect(call.body).toEqual({ first_name: 'Ada', last_name: 'Lovelace', phone: '+15552345678', consent: true })
  })

  it('accepts email only', async () => {
    const res = await POST(
      ...confirmRequest({ first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', phone: '', consent: true }),
    )
    expect(res.status).toBe(200)
    expect(forwarded().body).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      consent: true,
    })
  })
})

describe('POST /api/contact-requests/[id]/confirm validation', () => {
  it.each([
    ['a non-object body', [1, 2]],
    ['a missing first name', { ...validBody, first_name: undefined }],
    ['a blank last name', { ...validBody, last_name: '   ' }],
    ['a name over 100 characters', { ...validBody, first_name: 'a'.repeat(101) }],
    ['no phone and no email', { first_name: 'Ada', last_name: 'Lovelace', consent: true }],
    ['blank phone and email', { ...validBody, phone: ' ', email: '' }],
    ['an invalid phone', { ...validBody, phone: '12345' }],
    ['an invalid email', { first_name: 'Ada', last_name: 'L', email: 'not-an-email', consent: true }],
    ['consent false', { ...validBody, consent: false }],
    ['consent missing', { first_name: 'Ada', last_name: 'Lovelace', phone: '5552345678' }],
    ['consent as a string', { ...validBody, consent: 'true' }],
    ['consent as a number', { ...validBody, consent: 1 }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await POST(...confirmRequest(body))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(json.error.length).toBeGreaterThan(0)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('reports which field failed', async () => {
    const res = await POST(...confirmRequest({ ...validBody, consent: false }))
    expect(await res.json()).toMatchObject({ field: 'consent' })
  })

  it.each(['short', 'has spaces in it ok?', '../../../../etc/passwd', 'a'.repeat(65)])(
    'rejects the malformed id %j with 404',
    async id => {
      const res = await POST(...confirmRequest(validBody, { id }))
      expect(res.status).toBe(404)
      expect(confirmMock).not.toHaveBeenCalled()
    },
  )

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(...confirmRequest('{"first_name":'))
    expect(res.status).toBe(400)
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it.each(['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data'])(
    'rejects content type %s with 415',
    async contentType => {
      const res = await POST(...confirmRequest(validBody, { contentType }))
      expect(res.status).toBe(415)
      expect(confirmMock).not.toHaveBeenCalled()
    },
  )

  it('rejects an oversized body with 413', async () => {
    const res = await POST(...confirmRequest({ ...validBody, padding: 'x'.repeat(5_000) }))
    expect(res.status).toBe(413)
    expect(confirmMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized declared content-length with 413', async () => {
    const res = await POST(...confirmRequest(validBody, { extraHeaders: { 'content-length': '999999' } }))
    expect(res.status).toBe(413)
    expect(confirmMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/contact-requests/[id]/confirm buyer IP forwarding', () => {
  it('passes the first X-Forwarded-For entry as clientIp', async () => {
    await POST(...confirmRequest(validBody, { extraHeaders: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }))
    expect(forwarded().opts.clientIp).toBe('203.0.113.7')
  })

  it('falls back to X-Real-IP', async () => {
    await POST(...confirmRequest(validBody, { extraHeaders: { 'x-real-ip': '2001:db8::5' } }))
    expect(forwarded().opts.clientIp).toBe('2001:db8::5')
  })

  it("passes the buyer's user agent for the consent audit trail", async () => {
    await POST(...confirmRequest(validBody, { extraHeaders: { 'user-agent': 'Mozilla/5.0 (Buyer)' } }))
    expect(forwarded().opts.userAgent).toBe('Mozilla/5.0 (Buyer)')
  })

  it('omits clientIp when the value is not an IP literal', async () => {
    await POST(...confirmRequest(validBody, { extraHeaders: { 'x-forwarded-for': 'evil.example.com' } }))
    expect(forwarded().opts).not.toHaveProperty('clientIp')
  })
})

describe('POST /api/contact-requests/[id]/confirm upstream errors', () => {
  it.each([
    [404, 404, /couldn't find this request/i],
    [409, 409, /already been confirmed or has expired/i],
    [422, 422, /check them and try again/i],
    [429, 429, /too many attempts/i],
    [502, 502, /temporarily unavailable/i],
    [504, 504, /too long/i],
    [401, 502, /temporarily unavailable/i],
    [403, 502, /temporarily unavailable/i],
  ])('maps gateway HTTP %i to %i with a safe message', async (upstream, expected, message) => {
    confirmMock.mockRejectedValueOnce(
      new MotologyApiError('http', upstream, `HTTP ${upstream}`, { detail: 'secret internal detail' }),
    )
    const res = await POST(...confirmRequest(validBody))
    expect(res.status).toBe(expected)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const text = await res.text()
    expect(text).not.toContain('secret internal detail')
    expect((JSON.parse(text) as { error: string }).error).toMatch(message)
  })

  it('maps a timeout to 504', async () => {
    confirmMock.mockRejectedValueOnce(new MotologyApiError('timeout', 504, 'timed out'))
    const res = await POST(...confirmRequest(validBody))
    expect(res.status).toBe(504)
  })

  it('maps missing configuration to 503 without leaking it', async () => {
    getClientMock.mockImplementationOnce(() => {
      throw new MotologyConfigError('MOTOLOGY_API_KEY is not set')
    })
    const res = await POST(...confirmRequest(validBody))
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('MOTOLOGY_API_KEY')
  })

  it('maps unexpected errors to 500 without a stack trace', async () => {
    confirmMock.mockRejectedValueOnce(new Error('boom at /srv/app/secret.ts:12'))
    const res = await POST(...confirmRequest(validBody))
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toContain('boom')
    expect(text).not.toContain('secret.ts')
  })
})
