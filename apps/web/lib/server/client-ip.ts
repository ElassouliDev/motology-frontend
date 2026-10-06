import 'server-only'
import { isIP } from 'node:net'

/** Upper bound for a textual IPv6 address (incl. zone-free IPv4-mapped form). */
const MAX_IP_LENGTH = 45

interface HeaderReader {
  get(name: string): string | null
}

/**
 * The buyer's IP address for the gateway's per-buyer rate limiting.
 *
 * In production the edge (Caddy, docker-compose.production.yml) resolves the
 * visitor's address itself, trusting only Cloudflare's ranges and the load
 * balancer, then strips `CF-Connecting-IP` / `X-Real-IP` and sets
 * `X-Forwarded-For` to that single verified address. So the order below only
 * matters for deployments without that edge: `CF-Connecting-IP`, then the
 * first `X-Forwarded-For` entry, then `X-Real-IP`. Returns `undefined` unless
 * the value is a plain IPv4/IPv6 literal, so the header is omitted rather
 * than forwarding arbitrary input. The gateway only trusts this value after
 * the BFF's `X-Motology-Key` check.
 */
export function getClientIp(headers: HeaderReader): string | undefined {
  const cloudflare = headers.get('cf-connecting-ip')?.trim()
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const candidate = cloudflare || forwarded || headers.get('x-real-ip')?.trim()
  if (!candidate || candidate.length > MAX_IP_LENGTH) return undefined
  return isIP(candidate) !== 0 ? candidate : undefined
}
