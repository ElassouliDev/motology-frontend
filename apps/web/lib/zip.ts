/**
 * The buyer's ZIP code, kept in a first-party cookie in this browser. Market
 * pricing is local: without a ZIP the engine cannot price against nearby
 * comparables. A cookie (not localStorage) so every tab reads the same value
 * and the server can see it too.
 */
export const ZIP_COOKIE = 'motology_zip'
const ZIP_RE = /^\d{5}$/
const ONE_YEAR_S = 60 * 60 * 24 * 365

export function isValidZip(value: unknown): value is string {
  return typeof value === 'string' && ZIP_RE.test(value)
}

/** The ZIP in a `document.cookie` string, if it holds a valid one. */
export function zipFromCookieString(cookie: string): string | null {
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === ZIP_COOKIE) {
      const value = rest.join('=')
      return isValidZip(value) ? value : null
    }
  }
  return null
}

export function loadZip(): string | null {
  try {
    return zipFromCookieString(document.cookie)
  } catch {
    return null
  }
}

export function saveZip(zip: string | null): void {
  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = isValidZip(zip)
      ? `${ZIP_COOKIE}=${zip}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax${secure}`
      : `${ZIP_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
  } catch {
    // Cookies blocked: the ZIP still applies for this page.
  }
}
