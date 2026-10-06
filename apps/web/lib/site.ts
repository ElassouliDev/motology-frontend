/**
 * Public site settings baked in at build time (NEXT_PUBLIC_*). The legal
 * links are optional: an unset URL hides the link instead of pointing nowhere.
 */
const DEFAULT_APP_URL = 'https://motology.ai'

function httpUrl(value: string | undefined): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

export const APP_URL = new URL(httpUrl(process.env.NEXT_PUBLIC_APP_URL) ?? DEFAULT_APP_URL)
export const PRIVACY_URL = httpUrl(process.env.NEXT_PUBLIC_PRIVACY_URL)
export const TERMS_URL = httpUrl(process.env.NEXT_PUBLIC_TERMS_URL)
