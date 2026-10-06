import path from 'node:path'
import type { NextConfig } from 'next'

// Next's hydration bootstrap is inline, so scripts need 'unsafe-inline' (a
// nonce would force every page dynamic). Everything else is locked to this
// origin; inventory photos may come from any https host.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Browsers ignore this over plain http, so local development is unaffected.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // Dev needs eval for fast refresh, so the policy applies to production builds.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }]
    : []),
]

const config: NextConfig = {
  output: 'standalone',
  // Trace files from the monorepo root so workspace packages land in the
  // standalone bundle.
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@motology/api-client', '@motology/types'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default config
