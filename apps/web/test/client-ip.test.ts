import { describe, expect, it } from 'vitest'
import { getClientIp } from '@/lib/server/client-ip'

function h(values: Record<string, string>): Headers {
  return new Headers(values)
}

describe('getClientIp', () => {
  it('uses the first, trimmed X-Forwarded-For entry', () => {
    expect(getClientIp(h({ 'x-forwarded-for': ' 203.0.113.7 , 10.0.0.1, 10.0.0.2' }))).toBe('203.0.113.7')
  })

  it('prefers CF-Connecting-IP, which the client cannot spoof behind Cloudflare', () => {
    expect(
      getClientIp(h({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '1.2.3.4, 203.0.113.9, 10.0.0.1' })),
    ).toBe('203.0.113.9')
  })

  it('omits an invalid CF-Connecting-IP rather than falling back to a spoofable header', () => {
    expect(getClientIp(h({ 'cf-connecting-ip': 'garbage', 'x-forwarded-for': '1.2.3.4' }))).toBeUndefined()
  })

  it('accepts IPv6 literals', () => {
    expect(getClientIp(h({ 'x-forwarded-for': '2001:db8::1, 10.0.0.1' }))).toBe('2001:db8::1')
  })

  it('prefers X-Forwarded-For over X-Real-IP', () => {
    expect(getClientIp(h({ 'x-forwarded-for': '198.51.100.1', 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.1')
  })

  it('falls back to X-Real-IP when X-Forwarded-For is absent or empty', () => {
    expect(getClientIp(h({ 'x-real-ip': ' 198.51.100.2 ' }))).toBe('198.51.100.2')
    expect(getClientIp(h({ 'x-forwarded-for': ' ', 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2')
  })

  it.each(['unknown', '203.0.113.7:443', '[2001:db8::1]', '999.1.1.1', 'evil\r\nX-Injected: 1', 'a'.repeat(100)])(
    'omits an invalid value %j',
    value => {
      expect(getClientIp(h({ 'x-forwarded-for': value.replace(/[\r\n]/g, '') }))).toBeUndefined()
    },
  )

  it('does not fall back when the first X-Forwarded-For entry is invalid', () => {
    expect(getClientIp(h({ 'x-forwarded-for': 'garbage', 'x-real-ip': '198.51.100.2' }))).toBeUndefined()
  })

  it('returns undefined when no header is present', () => {
    expect(getClientIp(h({}))).toBeUndefined()
  })
})
