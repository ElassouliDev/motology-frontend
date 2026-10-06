import 'server-only'
import { headers } from 'next/headers'
import {
  createMotologyClientFromEnv,
  type MotologyApiClient,
  type RequestOptions,
} from '@motology/api-client'
import { getClientIp } from './client-ip'

let client: MotologyApiClient | undefined

/**
 * Lazily-built gateway client. Created on first use (not at import time) so
 * `next build` does not need gateway credentials.
 */
export function getMotologyClient(): MotologyApiClient {
  client ??= createMotologyClientFromEnv(process.env)
  return client
}

/**
 * Per-request gateway options for server components (buyer IP for the
 * gateway's rate limiting). Route handlers derive these from their own
 * `request.headers` instead.
 */
export async function gatewayRequestOptions(): Promise<RequestOptions> {
  const clientIp = getClientIp(await headers())
  return clientIp ? { clientIp } : {}
}
