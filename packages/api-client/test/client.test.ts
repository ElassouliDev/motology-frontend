import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MotologyApiClient,
  MotologyApiError,
  MotologyConfigError,
  createMotologyClientFromEnv,
} from '../src/index'

const BASE_URL = 'http://gateway.test:8080'
const API_KEY = 'test-secret-key'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeClient(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new MotologyApiClient({ baseUrl: BASE_URL, apiKey: API_KEY, fetch: fetchImpl, timeoutMs })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1)
  if (!call) throw new Error('fetch was not called')
  return { url: String(call[0]), init: call[1] as RequestInit }
}

const chatBody = {
  conversation_id: 'conv_123',
  reply: 'Here is what I found.',
  turn_count: 1,
  handoff: false,
  motology: {
    pricing_frame: {
      list_price: 42000,
      market_price: 40500,
      open_offer: 38900,
      good_price: 39800,
      walk_away: 41000,
      over_market_pct: 3.7,
      confidence_tier: 2,
      deal_state: 'NEGOTIATE',
    },
    current_offer: null,
    deal_score: 71,
    last_scenario: {
      scenario_id: 'price_check',
      recommendation: 'Open at $38,900.',
      stats: [{ key: 'Market', value: '$40,500' }],
      data_source: 'live',
      confidence: 'high',
    },
    vehicle: { stock_number: 'A100', year: 2023, make: 'Toyota', model: 'RAV4' },
  },
}

afterEach(() => {
  vi.useRealTimers()
})

describe('MotologyApiClient request headers', () => {
  it('sends X-Motology-Key and X-Source on every request', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(chatBody))
    const client = makeClient(fetchMock)

    await client.chat({ message: 'hi', conversation_id: 'conv_123', stock_number: 'A100' })
    const { url, init } = lastCall(fetchMock)
    const headers = new Headers(init.headers)

    expect(url).toBe(`${BASE_URL}/api/motology/chat`)
    expect(init.method).toBe('POST')
    expect(headers.get('X-Motology-Key')).toBe(API_KEY)
    expect(headers.get('X-Source')).toBe('motology')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(JSON.parse(String(init.body))).toEqual({
      message: 'hi',
      conversation_id: 'conv_123',
      stock_number: 'A100',
    })
  })

  it('sends auth headers on GET requests and encodes query/path params', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
      .mockResolvedValueOnce(jsonResponse({ data: { stock_number: 'A/1' } }))
    const client = makeClient(fetchMock)

    await client.searchVehicles({ make: 'Land Rover', max_price: 50000, year_min: 2020 })
    let call = lastCall(fetchMock)
    expect(call.url).toBe(
      `${BASE_URL}/api/motology/vehicles?make=Land+Rover&max_price=50000&year_min=2020`,
    )
    expect(new Headers(call.init.headers).get('X-Motology-Key')).toBe(API_KEY)
    expect(new Headers(call.init.headers).get('X-Source')).toBe('motology')
    expect(call.init.body).toBeUndefined()

    await client.getVehicle('A/1')
    call = lastCall(fetchMock)
    expect(call.url).toBe(`${BASE_URL}/api/motology/vehicles/A%2F1`)
  })

  it('sends X-Motology-Client-Ip only when a client IP is provided', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(jsonResponse(chatBody)))
    const client = makeClient(fetchMock)

    await client.chat({ message: 'hi' }, { clientIp: '203.0.113.7' })
    expect(new Headers(lastCall(fetchMock).init.headers).get('X-Motology-Client-Ip')).toBe('203.0.113.7')

    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ data: [] })))
    await client.searchVehicles({}, { clientIp: '2001:db8::1' })
    expect(new Headers(lastCall(fetchMock).init.headers).get('X-Motology-Client-Ip')).toBe('2001:db8::1')

    await client.searchVehicles()
    expect(new Headers(lastCall(fetchMock).init.headers).has('X-Motology-Client-Ip')).toBe(false)
  })

  it('strips a trailing slash from the base URL', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }))
    const client = new MotologyApiClient({ baseUrl: `${BASE_URL}/`, apiKey: API_KEY, fetch: fetchMock })
    await client.searchVehicles()
    expect(lastCall(fetchMock).url).toBe(`${BASE_URL}/api/motology/vehicles`)
  })
})

describe('MotologyApiClient response handling', () => {
  it('returns a normalised chat response', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(chatBody)))
    const res = await client.chat({ message: 'hi' })
    expect(res.conversation_id).toBe('conv_123')
    expect(res.motology.pricing_frame?.market_price).toBe(40500)
    expect(res.motology.last_scenario?.stats).toEqual([{ key: 'Market', value: '$40,500' }])
  })

  it('passes through a well-formed contact request id and drops anything else', async () => {
    const id = 'AbCdEfGhIjKlMnOpQrStUv_-12'
    const ok = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...chatBody, contact_request_id: id })))
    expect((await ok.chat({ message: 'hi' })).contact_request_id).toBe(id)
    for (const bad of ['../etc/passwd', 'short', 42, null, undefined]) {
      const client = makeClient(
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ...chatBody, contact_request_id: bad })),
      )
      expect((await client.chat({ message: 'hi' })).contact_request_id).toBeNull()
    }
  })

  it('coerces missing or malformed numeric fields to null', async () => {
    const body = {
      conversation_id: 'c1',
      reply: 'ok',
      motology: {
        pricing_frame: { list_price: 'not-a-number', market_price: null },
        current_offer: { user_offer: 30000, round: Number.NaN },
        deal_score: 'n/a',
        last_scenario: { recommendation: 'x', stats: 'bogus' },
      },
    }
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(body)))
    const res = await client.chat({ message: 'hi' })
    expect(res.turn_count).toBe(0)
    expect(res.handoff).toBe(false)
    expect(res.motology.pricing_frame).toMatchObject({ list_price: null, market_price: null, walk_away: null })
    expect(res.motology.current_offer).toMatchObject({ user_offer: 30000, round: null, counter_price: null })
    expect(res.motology.deal_score).toBeNull()
    expect(res.motology.last_scenario?.stats).toEqual([])
    expect(res.motology.vehicle).toBeNull()
  })

  it('unwraps conversation and vehicle envelopes', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: { ...chatBody.motology, conversation_id: 'conv_123' } }))
      .mockResolvedValueOnce(jsonResponse({ data: [{ stock_number: 'A1', price: 1 }, { bogus: true }] }))
    const client = makeClient(fetchMock)

    const conv = await client.getConversation('conv_123')
    expect(conv.conversation_id).toBe('conv_123')
    expect(conv.deal_score).toBe(71)

    const vehicles = await client.searchVehicles({ q: 'suv' })
    expect(vehicles).toHaveLength(1)
    expect(vehicles[0]).toMatchObject({ stock_number: 'A1', price: 1, make: null })
  })

  it('rejects a 2xx response that is missing required identifiers', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ reply: 'x' })))
    await expect(client.chat({ message: 'hi' })).rejects.toMatchObject({
      name: 'MotologyApiError',
      code: 'invalid_response',
      status: 502,
    })
  })

  it('treats a list where every row is malformed as a broken response, not an empty lot', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ data: [{ bogus: true }, { also: 'bad' }] }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
    const client = makeClient(fetchMock)
    await expect(client.searchVehicles()).rejects.toMatchObject({ code: 'invalid_response', status: 502 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('dropped 2 of 2'))
    await expect(client.searchVehicles()).resolves.toEqual([])
    warn.mockRestore()
  })

  it('keeps a complete out-the-door estimate and drops a partial one', async () => {
    const otd = { zip_code: '94110', basis: 'the good price', price: 29794, sales_tax: 2159.66, fees_total: 412.5,
                  out_the_door: 32366.16, est_monthly_payment: 512 }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...chatBody, motology: { ...chatBody.motology, out_the_door: otd } }))
      .mockResolvedValueOnce(
        jsonResponse({ ...chatBody, motology: { ...chatBody.motology, out_the_door: { ...otd, sales_tax: null } } }),
      )
      .mockResolvedValueOnce(jsonResponse(chatBody))
    const client = makeClient(fetchMock)
    const full = await client.chat({ message: 'otd' })
    expect(full.motology.out_the_door).toMatchObject({ zip_code: '94110', out_the_door: 32366.16, amount_financed: null })
    expect((await client.chat({ message: 'otd' })).motology.out_the_door).toBeNull()
    expect((await client.chat({ message: 'otd' })).motology.out_the_door).toBeNull()
  })

  it('rejects a 2xx response with a non-JSON body', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>', { status: 200 })))
    await expect(client.searchVehicles()).rejects.toMatchObject({ code: 'invalid_response', status: 502 })
  })
})

describe('MotologyApiClient error mapping', () => {
  it.each([401, 404, 429, 502, 504])('maps HTTP %i to an http error carrying the status', async status => {
    const client = makeClient(
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ detail: `upstream ${status}` }, status)),
    )
    const err = await client.getVehicle('X').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MotologyApiError)
    expect(err).toMatchObject({ code: 'http', status, detail: `upstream ${status}` })
    // The error message itself never echoes upstream detail.
    expect((err as MotologyApiError).message).not.toContain('upstream')
  })

  it('handles a non-JSON error body', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('Bad Gateway', { status: 502 })))
    await expect(client.getVehicle('X')).rejects.toMatchObject({ code: 'http', status: 502, detail: undefined })
  })

  it('maps fetch failures to a network error', async () => {
    const client = makeClient(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed')))
    await expect(client.getVehicle('X')).rejects.toMatchObject({ code: 'network', status: 502 })
  })

  it('aborts and maps to a timeout error when the gateway is too slow', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    const client = makeClient(fetchMock, 1_000)
    const pending = client.chat({ message: 'hi' }).catch((e: unknown) => e)

    await vi.advanceTimersByTimeAsync(999)
    expect(lastCall(fetchMock).init.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    const err = await pending
    expect(err).toBeInstanceOf(MotologyApiError)
    expect(err).toMatchObject({ code: 'timeout', status: 504 })
    expect(lastCall(fetchMock).init.signal?.aborted).toBe(true)
  })

  it('defaults to a 30 second timeout', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const client = makeClient(fetchMock)
    const pending = client.getVehicle('X').catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(29_999)
    expect(lastCall(fetchMock).init.signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await expect(pending).resolves.toMatchObject({ code: 'timeout' })
  })

  it('distinguishes a caller abort from a timeout', async () => {
    const fetchMock = vi.fn<typeof fetch>((_input, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    })
    const controller = new AbortController()
    const pending = makeClient(fetchMock).getVehicle('X', { signal: controller.signal })
    controller.abort()
    await expect(pending).rejects.toMatchObject({ code: 'aborted' })
  })
})

describe('createMotologyClientFromEnv', () => {
  it('requires the gateway URL and API key', () => {
    expect(() => createMotologyClientFromEnv({ MOTOLOGY_API_KEY: 'k' })).toThrow(MotologyConfigError)
    expect(() => createMotologyClientFromEnv({ MOTOLOGY_GATEWAY_URL: BASE_URL })).toThrow(MotologyConfigError)
  })

  it('rejects an invalid URL without echoing the secret', () => {
    let error: unknown
    try {
      createMotologyClientFromEnv({ MOTOLOGY_GATEWAY_URL: 'not a url', MOTOLOGY_API_KEY: 'super-secret' })
    } catch (err) {
      error = err
    }
    expect(error).toBeInstanceOf(MotologyConfigError)
    expect(String(error)).not.toContain('super-secret')
  })

  it('builds a working client', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ data: [] }))
    const client = createMotologyClientFromEnv(
      { MOTOLOGY_GATEWAY_URL: BASE_URL, MOTOLOGY_API_KEY: API_KEY },
      { fetch: fetchMock },
    )
    await client.searchVehicles()
    expect(new Headers(lastCall(fetchMock).init.headers).get('X-Motology-Key')).toBe(API_KEY)
  })
})
