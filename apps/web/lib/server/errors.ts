import 'server-only'
import { MotologyConfigError, isMotologyApiError } from '@motology/api-client'

export interface PublicError {
  status: number
  message: string
}

const UNAVAILABLE = 'Motology is temporarily unavailable. Please try again shortly.'

function messageForUpstreamStatus(status: number): string {
  if (status === 404) return 'We could not find what you were looking for.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status === 504) return 'Motology took too long to respond. Please try again.'
  if (status >= 500) return UNAVAILABLE
  return 'The request could not be processed.'
}

/**
 * Maps any error thrown while talking to the gateway to a status + message
 * that are safe to show a buyer. Upstream `detail`, stack traces and
 * configuration values are logged server-side only, never returned.
 *
 * Upstream status codes are passed through, except 401/403: those mean the
 * BFF's own API key was rejected (a server misconfiguration, not something the
 * buyer can fix), so they surface as 502.
 */
export function toPublicError(err: unknown, context: string): PublicError {
  if (isMotologyApiError(err)) {
    if (err.code === 'http') {
      const authFailure = err.status === 401 || err.status === 403
      const level = authFailure || err.status >= 500 ? 'error' : 'warn'
      console[level](`[motology] ${context}: gateway HTTP ${err.status}`, err.detail ?? '')
      const status = authFailure ? 502 : err.status
      return { status, message: authFailure ? UNAVAILABLE : messageForUpstreamStatus(status) }
    }
    console.error(`[motology] ${context}: ${err.code} (${err.message})`)
    switch (err.code) {
      case 'timeout':
        return { status: 504, message: messageForUpstreamStatus(504) }
      case 'aborted':
        return { status: 499, message: 'Request was cancelled.' }
      case 'network':
      case 'invalid_response':
        return { status: 502, message: UNAVAILABLE }
    }
  }
  if (err instanceof MotologyConfigError) {
    console.error(`[motology] ${context}: configuration error: ${err.message}`)
    return { status: 503, message: UNAVAILABLE }
  }
  console.error(`[motology] ${context}: unexpected error`, err instanceof Error ? err.name : typeof err)
  return { status: 500, message: 'Something went wrong. Please try again.' }
}
