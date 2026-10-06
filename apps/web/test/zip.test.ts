import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadZip, saveZip, zipFromCookieString } from '@/lib/zip'

function fakeBrowser(protocol = 'https:') {
  const jar = new Map<string, string>()
  const writes: string[] = []
  const document = {
    get cookie() {
      return [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
    },
    set cookie(value: string) {
      writes.push(value)
      const [pair = '', ...attrs] = value.split('; ')
      const [name = '', val = ''] = pair.split('=')
      if (attrs.includes('Max-Age=0')) jar.delete(name)
      else jar.set(name, val)
    },
  }
  vi.stubGlobal('document', document)
  vi.stubGlobal('window', { location: { protocol } })
  return { jar, writes }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ZIP cookie', () => {
  it('reads only a valid five-digit ZIP from the cookie string', () => {
    expect(zipFromCookieString('a=1; motology_zip=94110; b=2')).toBe('94110')
    expect(zipFromCookieString('motology_zip=9411')).toBeNull()
    expect(zipFromCookieString('motology_zip=94110x')).toBeNull()
    expect(zipFromCookieString('other_zip=94110')).toBeNull()
    expect(zipFromCookieString('')).toBeNull()
  })

  it('saves to a first-party cookie and clears it', () => {
    const { jar, writes } = fakeBrowser()
    saveZip('10001')
    expect(loadZip()).toBe('10001')
    expect(writes[0]).toMatch(/^motology_zip=10001; Path=\/; Max-Age=\d+; SameSite=Lax; Secure$/)
    saveZip(null)
    expect(jar.has('motology_zip')).toBe(false)
    expect(loadZip()).toBeNull()
  })

  it('never writes an invalid ZIP and skips Secure on plain http', () => {
    const { writes } = fakeBrowser('http:')
    saveZip('12')
    expect(writes[0]).toContain('Max-Age=0')
    saveZip('94110')
    expect(writes[1]).not.toContain('Secure')
  })

  it('reads nothing when cookies are unavailable', () => {
    vi.stubGlobal('document', undefined)
    expect(loadZip()).toBeNull()
  })
})
