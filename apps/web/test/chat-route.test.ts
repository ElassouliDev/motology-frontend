import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MotologyApiError, MotologyConfigError } from '@motology/api-client'
import type { ChatResponse } from '@motology/types'

const chatMock = vi.fn<(...args: unknown[]) => Promise<ChatResponse>>()
const getClientMock = vi.fn(() => ({ chat: chatMock }))

vi.mock('@/lib/server/motology', () => ({
  getMotologyClient: () => getClientMock(),
}))

// Imported after the mock is registered.
const { POST, DELETE } = await import('@/app/api/chat/route')
const { CONVERSATION_COOKIE } = await import('@/lib/session')

const okResponse: ChatResponse = {
  conversation_id: 'conv_abc123',
  reply: 'Happy to help.',
  turn_count: 1,
  handoff: false,
  motology: {
    pricing_frame: null,
    current_offer: null,
    deal_score: null,
    last_scenario: null,
    vehicle: null,
  },
  contact_request_id: null,
}

function chatRequest(
  body: unknown,
  {
    cookie,
    contentType = 'application/json',
    extraHeaders = {},
  }: { cookie?: string; contentType?: string; extraHeaders?: Record<string, string> } = {},
): NextRequest {
  const headers = new Headers({ ...extraHeaders, 'content-type': contentType })
  if (cookie !== undefined) headers.set('cookie', `${CONVERSATION_COOKIE}=${cookie}`)
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function setCookieHeader(res: Response): string {
  return res.headers.get('set-cookie') ?? ''
}

function forwardedOptions(): Record<string, unknown> {
  const call = chatMock.mock.calls.at(-1)
  if (!call) throw new Error('gateway client was not called')
  return call[1] as Record<string, unknown>
}

function forwardedRequest(): Record<string, unknown> {
  const call = chatMock.mock.calls.at(-1)
  if (!call) throw new Error('gateway client was not called')
  return call[0] as Record<string, unknown>
}

beforeEach(() => {
  chatMock.mockReset()
  chatMock.mockResolvedValue(okResponse)
  getClientMock.mockClear()
  getClientMock.mockImplementation(() => ({ chat: chatMock }))
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

describe('POST /api/chat input validation', () => {
  it.each([
    ['a non-object body', [1, 2, 3]],
    ['a missing message', {}],
    ['a non-string message', { message: 42 }],
    ['an empty message', { message: '' }],
    ['a whitespace-only message', { message: '   \n\t ' }],
    ['a message over 2000 characters', { message: 'a'.repeat(2001) }],
    ['an invalid zip code', { message: 'hi', zip_code: '1234' }],
    ['a non-string zip code', { message: 'hi', zip_code: 12345 }],
    ['an invalid stock number', { message: 'hi', stock_number: '../../admin' }],
    ['a non-boolean new_conversation', { message: 'hi', new_conversation: 'yes' }],
  ])('rejects %s with 400', async (_label, body) => {
    const res = await POST(chatRequest(body))
    expect(res.status).toBe(400)
    const json = (await res.json()) as { error: string }
    expect(typeof json.error).toBe('string')
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await POST(chatRequest('{"message":'))
    expect(res.status).toBe(400)
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('rejects a non-JSON content type with 415', async () => {
    const res = await POST(chatRequest({ message: 'hi' }, { contentType: 'text/plain' }))
    expect(res.status).toBe(415)
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('rejects an oversized body with 413', async () => {
    const res = await POST(chatRequest({ message: 'hi', padding: 'x'.repeat(20_000) }))
    expect(res.status).toBe(413)
    expect(chatMock).not.toHaveBeenCalled()
  })

  it('accepts a message of exactly 2000 characters and trims it', async () => {
    const message = 'a'.repeat(2000)
    const res = await POST(chatRequest({ message: `  ${message}  ` }))
    expect(res.status).toBe(200)
    expect(forwardedRequest().message).toBe(message)
  })

  it('forwards zip_code and stock_number but never a client-supplied conversation_id', async () => {
    const res = await POST(
      chatRequest({ message: 'hi', zip_code: '90210', stock_number: 'A100', conversation_id: 'attacker' }),
    )
    expect(res.status).toBe(200)
    expect(forwardedRequest()).toEqual({ message: 'hi', zip_code: '90210', stock_number: 'A100' })
  })
})

describe('POST /api/chat session cookie', () => {
  it('sets an httpOnly, SameSite=Lax conversation cookie on success', async () => {
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(okResponse)

    const cookie = setCookieHeader(res)
    expect(cookie).toContain(`${CONVERSATION_COOKIE}=conv_abc123`)
    expect(cookie).toMatch(/HttpOnly/i)
    expect(cookie).toMatch(/SameSite=lax/i)
    expect(cookie).toMatch(/Path=\//)
    expect(cookie).toMatch(/Max-Age=\d+/)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('marks the cookie Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const res = await POST(chatRequest({ message: 'hi' }))
      expect(setCookieHeader(res)).toMatch(/Secure/i)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('does not mark the cookie Secure outside production', async () => {
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(setCookieHeader(res)).not.toMatch(/Secure/i)
  })

  it('continues the conversation stored in the cookie', async () => {
    await POST(chatRequest({ message: 'hi' }, { cookie: 'conv_existing' }))
    expect(forwardedRequest().conversation_id).toBe('conv_existing')
  })

  it('ignores the cookie when new_conversation is true', async () => {
    await POST(chatRequest({ message: 'hi', new_conversation: true }, { cookie: 'conv_existing' }))
    expect(forwardedRequest()).not.toHaveProperty('conversation_id')
  })

  it('ignores a malformed cookie value', async () => {
    await POST(chatRequest({ message: 'hi' }, { cookie: 'bad%20value%2F..' }))
    expect(forwardedRequest()).not.toHaveProperty('conversation_id')
  })

  it('does not set a cookie when the gateway returns an unexpected id format', async () => {
    chatMock.mockResolvedValueOnce({ ...okResponse, conversation_id: 'has spaces/and slashes' })
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(200)
    expect(setCookieHeader(res)).toBe('')
  })

  it('clears a stale cookie when the gateway no longer knows the conversation', async () => {
    chatMock.mockRejectedValueOnce(new MotologyApiError('http', 404, 'HTTP 404', { detail: 'unknown' }))
    const res = await POST(chatRequest({ message: 'hi' }, { cookie: 'conv_gone' }))
    expect(res.status).toBe(404)
    expect(setCookieHeader(res)).toMatch(new RegExp(`${CONVERSATION_COOKIE}=;.*Max-Age=0`, 'i'))
  })

  it('DELETE clears the cookie', () => {
    const res = DELETE()
    expect(res.status).toBe(204)
    expect(setCookieHeader(res)).toMatch(new RegExp(`${CONVERSATION_COOKIE}=;.*Max-Age=0`, 'i'))
  })
})

describe('POST /api/chat buyer IP forwarding', () => {
  it('passes the first X-Forwarded-For entry as clientIp', async () => {
    await POST(chatRequest({ message: 'hi' }, { extraHeaders: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' } }))
    expect(forwardedOptions().clientIp).toBe('203.0.113.7')
  })

  it('falls back to X-Real-IP', async () => {
    await POST(chatRequest({ message: 'hi' }, { extraHeaders: { 'x-real-ip': '2001:db8::5' } }))
    expect(forwardedOptions().clientIp).toBe('2001:db8::5')
  })

  it('omits clientIp when the forwarded value is not an IP literal', async () => {
    await POST(chatRequest({ message: 'hi' }, { extraHeaders: { 'x-forwarded-for': 'not-an-ip' } }))
    expect(forwardedOptions()).not.toHaveProperty('clientIp')
  })

  it('omits clientIp when no forwarding headers are present', async () => {
    await POST(chatRequest({ message: 'hi' }))
    expect(forwardedOptions()).not.toHaveProperty('clientIp')
  })
})

describe('POST /api/chat upstream errors', () => {
  it('shows a rate-limit message when the gateway returns 429', async () => {
    chatMock.mockRejectedValueOnce(new MotologyApiError('http', 429, 'HTTP 429', { detail: 'buyer rate limited' }))
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: "You're sending messages too fast, try again in a minute." })
  })

  it.each([
    [429, 429],
    [502, 502],
    [504, 504],
    [404, 404],
    [401, 502],
    [403, 502],
  ])('maps gateway HTTP %i to %i with a safe message', async (upstream, expected) => {
    chatMock.mockRejectedValueOnce(
      new MotologyApiError('http', upstream, `HTTP ${upstream}`, { detail: 'secret internal detail' }),
    )
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(expected)
    const text = await res.text()
    expect(text).not.toContain('secret internal detail')
    expect((JSON.parse(text) as { error: string }).error.length).toBeGreaterThan(0)
  })

  it('maps a timeout to 504', async () => {
    chatMock.mockRejectedValueOnce(new MotologyApiError('timeout', 504, 'timed out'))
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(504)
  })

  it('maps missing configuration to 503 without leaking it', async () => {
    getClientMock.mockImplementationOnce(() => {
      throw new MotologyConfigError('MOTOLOGY_API_KEY is not set')
    })
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(503)
    expect(await res.text()).not.toContain('MOTOLOGY_API_KEY')
  })

  it('maps unexpected errors to 500 without a stack trace', async () => {
    chatMock.mockRejectedValueOnce(new Error('boom at /srv/app/secret.ts:12'))
    const res = await POST(chatRequest({ message: 'hi' }))
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(text).not.toContain('boom')
    expect(text).not.toContain('secret.ts')
    expect(setCookieHeader(res)).toBe('')
  })
})
