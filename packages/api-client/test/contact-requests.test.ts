import { describe, expect, it, vi } from 'vitest'
import type { ContactConfirmRequest } from '@motology/types'
import { MotologyApiClient, MotologyApiError } from '../src/index'

const BASE_URL = 'http://gateway.test:8080'
const API_KEY = 'test-secret-key'
const ID = 'cr_ABCDEFGHijklmnop'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeClient(fetchImpl: typeof fetch) {
  return new MotologyApiClient({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: fetchImpl })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch was not called')
  return { url: String(call[0]), init: call[1] as RequestInit }
}

const contactRequest = {
  id: ID,
  status: 'pending',
  agent_name: 'Muse',
  vehicle: {
    stock_number: 'A100',
    year: 2023,
    make: 'Toyota',
    model: 'RAV4',
    trim: 'XLE',
    price: 32500,
    image_url: 'https://cdn.example.com/a100.jpg',
  },
  buyer_note: 'Wants a test drive on Saturday.',
  consent_text: 'By checking this box you agree that the dealership may contact you.',
  expires_at: '2026-10-06T12:00:00Z',
}

const confirmBody: ContactConfirmRequest = {
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone: '+15555550123',
  consent: true,
}

describe('getContactRequest', () => {
  it('sends the gateway headers and encodes the id', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: contactRequest }))
    await makeClient(fetchMock).getContactRequest('a/b c', { clientIp: '203.0.113.7' })
    const { url, init } = lastCall(fetchMock)
    const headers = new Headers(init.headers)
    expect(url).toBe(`${BASE_URL}/api/motology/contact-requests/a%2Fb%20c`)
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(headers.get('X-Motology-Key')).toBe(API_KEY)
    expect(headers.get('X-Source')).toBe('motology')
    expect(headers.get('X-Motology-Client-Ip')).toBe('203.0.113.7')
  })

  it('returns the parsed contact request', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: contactRequest })))
    await expect(client.getContactRequest(ID)).resolves.toEqual(contactRequest)
  })

  it('normalises optional fields to null', async () => {
    const body = {
      data: {
        id: ID,
        status: 'expired',
        agent_name: 42,
        vehicle: { year: '2021', price: 'n/a', make: 'Honda' },
        consent_text: 'Consent.',
        expires_at: '2026-10-06T12:00:00Z',
      },
    }
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body)))
    const res = await client.getContactRequest(ID)
    expect(res.agent_name).toBeNull()
    expect(res.buyer_note).toBeNull()
    expect(res.vehicle).toEqual({
      stock_number: null,
      year: 2021,
      make: 'Honda',
      model: null,
      trim: null,
      price: null,
      image_url: null,
    })
  })

  it.each([
    ['an unknown status', { ...contactRequest, status: 'approved' }],
    ['a missing id', { ...contactRequest, id: undefined }],
    ['missing consent text', { ...contactRequest, consent_text: '' }],
    ['a missing expiry', { ...contactRequest, expires_at: null }],
  ])('rejects %s as an invalid response', async (_label, data) => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data })))
    await expect(client.getContactRequest(ID)).rejects.toMatchObject({ code: 'invalid_response', status: 502 })
  })

  it.each([404, 429, 502])('maps HTTP %i to an http error', async status => {
    const client = makeClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ detail: 'upstream says no' }, status)),
    )
    const err = await client.getContactRequest(ID).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MotologyApiError)
    expect(err).toMatchObject({ code: 'http', status, detail: 'upstream says no' })
    expect((err as MotologyApiError).message).not.toContain('upstream says no')
  })
})

describe('confirmContactRequest', () => {
  it('POSTs only the contract fields with the gateway headers', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { status: 'confirmed' } }))
    const res = await makeClient(fetchMock).confirmContactRequest(
      ID,
      { ...confirmBody, extra: 'dropped' } as ContactConfirmRequest,
      { clientIp: '2001:db8::1', userAgent: 'Mozilla/5.0\n(test)' },
    )
    expect(res).toEqual({ status: 'confirmed', test_drive: null })

    const { url, init } = lastCall(fetchMock)
    const headers = new Headers(init.headers)
    expect(url).toBe(`${BASE_URL}/api/motology/contact-requests/${ID}/confirm`)
    expect(init.method).toBe('POST')
    expect(headers.get('X-Motology-Key')).toBe(API_KEY)
    expect(headers.get('X-Source')).toBe('motology')
    expect(headers.get('X-Motology-Client-Ip')).toBe('2001:db8::1')
    expect(headers.get('X-Motology-User-Agent')).toBe('Mozilla/5.0 (test)')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '+15555550123',
      consent: true,
    })
  })

  it('forwards a test drive time and parses its outcome', async () => {
    const at = '2026-09-12T10:00:00-05:00'
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: { status: 'confirmed', test_drive: { status: 'requested', scheduled_at: at, appointment_id: 9 } } }),
    )
    const res = await makeClient(fetchMock).confirmContactRequest(ID, { ...confirmBody, test_drive_at: at })
    expect(JSON.parse(String(lastCall(fetchMock).init.body)).test_drive_at).toBe(at)
    expect(res.test_drive).toEqual({ status: 'requested', scheduled_at: at })
  })

  it('drops an unknown test drive outcome', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({ data: { status: 'confirmed', test_drive: { status: 'teleported', scheduled_at: 'soon' } } }),
    )
    expect((await makeClient(fetchMock).confirmContactRequest(ID, confirmBody)).test_drive).toBeNull()
  })

  it('omits empty phone / email', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { status: 'confirmed' } }))
    await makeClient(fetchMock).confirmContactRequest(ID, {
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '',
      email: 'ada@example.com',
      consent: true,
    })
    expect(JSON.parse(String(lastCall(fetchMock).init.body))).toEqual({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      consent: true,
    })
  })

  it('refuses to send without consent', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    const body = { ...confirmBody, consent: false } as unknown as ContactConfirmRequest
    await expect(makeClient(fetchMock).confirmContactRequest(ID, body)).rejects.toThrow(TypeError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a 200 that does not report the request as confirmed', async () => {
    const client = makeClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: { status: 'pending' } })),
    )
    await expect(client.confirmContactRequest(ID, confirmBody)).rejects.toMatchObject({
      code: 'invalid_response',
      status: 502,
    })
  })

  it.each([404, 409, 422, 429, 502, 504])('maps HTTP %i to an http error', async status => {
    const client = makeClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ detail: `upstream ${status}` }, status)),
    )
    await expect(client.confirmContactRequest(ID, confirmBody)).rejects.toMatchObject({
      code: 'http',
      status,
      detail: `upstream ${status}`,
    })
  })

  it('maps a network failure to 502', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')))
    await expect(client.confirmContactRequest(ID, confirmBody)).rejects.toMatchObject({
      code: 'network',
      status: 502,
    })
  })
})
