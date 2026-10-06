/**
 * Motology API client.
 *
 * Thin, typed wrapper around the AutomotiveAI gateway's `/api/motology/*`
 * endpoints. SERVER-SIDE ONLY: it authenticates with a secret API key, so it
 * must never be bundled into browser code. The Next.js app only uses it from
 * route handlers and server components.
 *
 * All pricing intelligence lives in the backend. This client never computes
 * numbers; it sends requests and returns normalised results.
 */
import type {
  ChatRequest,
  ChatResponse,
  ContactConfirmRequest,
  ContactConfirmResponse,
  ContactRequest,
  ConversationState,
  Vehicle,
  VehicleSearchParams,
} from '@motology/types'
import {
  InvalidResponseError,
  parseChatResponse,
  parseContactConfirmEnvelope,
  parseContactRequestEnvelope,
  parseConversationEnvelope,
  parseErrorDetail,
  parseVehicleEnvelope,
  parseVehicleListEnvelope,
} from './parse'

export { InvalidResponseError } from './parse'

export const DEFAULT_TIMEOUT_MS = 30_000
export const SOURCE_HEADER_VALUE = 'motology'

/**
 * - `http`: the gateway answered with a non-2xx status (see `status`).
 * - `timeout`: no answer within the configured timeout.
 * - `network`: the gateway could not be reached.
 * - `invalid_response`: the gateway answered 2xx with an unusable body.
 * - `aborted`: the caller cancelled the request.
 */
export type MotologyApiErrorCode = 'http' | 'timeout' | 'network' | 'invalid_response' | 'aborted'

export class MotologyApiError extends Error {
  readonly code: MotologyApiErrorCode
  /** Upstream HTTP status for `http` errors; a synthetic gateway status otherwise. */
  readonly status: number
  /** Upstream `detail` message. For server-side logging only, never forward it to buyers. */
  readonly detail: string | undefined

  constructor(
    code: MotologyApiErrorCode,
    status: number,
    message: string,
    options: { detail?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause })
    this.name = 'MotologyApiError'
    this.code = code
    this.status = status
    this.detail = options.detail
  }
}

export function isMotologyApiError(err: unknown): err is MotologyApiError {
  return err instanceof MotologyApiError
}

export interface MotologyApiClientOptions {
  /** Gateway origin, e.g. `http://gateway:8080`. */
  baseUrl: string
  /** Secret sent as `X-Motology-Key`. */
  apiKey: string
  timeoutMs?: number
  /** Injectable for tests. Defaults to the global `fetch`. */
  fetch?: typeof fetch
}

export const CLIENT_IP_HEADER = 'X-Motology-Client-Ip'
export const USER_AGENT_HEADER = 'X-Motology-User-Agent'

/** Control characters (C0 and DEL) become spaces, so a value is safe as a header. */
function stripControlChars(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.charCodeAt(0)
    out += code < 0x20 || code === 0x7f ? ' ' : ch
  }
  return out
}

export interface RequestOptions {
  signal?: AbortSignal
  /**
   * The buyer's IP address, forwarded as `X-Motology-Client-Ip` so the gateway
   * can rate-limit per buyer. The caller must pass a validated IP literal;
   * omit it when unknown.
   */
  clientIp?: string
  /**
   * The buyer's browser user agent, forwarded as `X-Motology-User-Agent` for
   * the consent audit trail. Trimmed and capped at 300 characters here.
   */
  userAgent?: string
}

type HttpMethod = 'GET' | 'POST'

export class MotologyApiClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(options: MotologyApiClientOptions) {
    if (!options.baseUrl) throw new Error('MotologyApiClient: baseUrl is required')
    if (!options.apiKey) throw new Error('MotologyApiClient: apiKey is required')
    // Validates the URL eagerly so misconfiguration fails at startup, not per request.
    const parsed = new URL(options.baseUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new TypeError('MotologyApiClient: baseUrl must be an http(s) URL')
    }
    parsed.search = ''
    parsed.hash = ''
    this.baseUrl = parsed.toString().replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis)
  }

  // ── Chat ────────────────────────────────────────────────────────────────────
  async chat(req: ChatRequest, opts: RequestOptions = {}): Promise<ChatResponse> {
    const body: ChatRequest = { message: req.message }
    if (req.conversation_id) body.conversation_id = req.conversation_id
    if (req.zip_code) body.zip_code = req.zip_code
    if (req.stock_number) body.stock_number = req.stock_number
    const json = await this.request('POST', '/api/motology/chat', { ...opts, body })
    return this.parse(json, parseChatResponse)
  }

  async getConversation(conversationId: string, opts: RequestOptions = {}): Promise<ConversationState> {
    const path = `/api/motology/conversations/${encodeURIComponent(conversationId)}`
    const json = await this.request('GET', path, opts)
    return this.parse(json, parseConversationEnvelope)
  }

  // ── Vehicles ────────────────────────────────────────────────────────────────
  async searchVehicles(params: VehicleSearchParams = {}, opts: RequestOptions = {}): Promise<Vehicle[]> {
    const query = new URLSearchParams()
    if (params.make) query.set('make', params.make)
    if (params.model) query.set('model', params.model)
    if (params.max_price !== undefined) query.set('max_price', String(params.max_price))
    if (params.year_min !== undefined) query.set('year_min', String(params.year_min))
    if (params.q) query.set('q', params.q)
    const qs = query.toString()
    const json = await this.request('GET', `/api/motology/vehicles${qs ? `?${qs}` : ''}`, opts)
    return this.parse(json, parseVehicleListEnvelope)
  }

  async getVehicle(stockNumber: string, opts: RequestOptions = {}): Promise<Vehicle> {
    const path = `/api/motology/vehicles/${encodeURIComponent(stockNumber)}`
    const json = await this.request('GET', path, opts)
    return this.parse(json, parseVehicleEnvelope)
  }

  // ── Contact requests ────────────────────────────────────────────────────────
  /** A dealer-contact request an outside agent created on the buyer's behalf. */
  async getContactRequest(id: string, opts: RequestOptions = {}): Promise<ContactRequest> {
    const path = `/api/motology/contact-requests/${encodeURIComponent(id)}`
    const json = await this.request('GET', path, opts)
    return this.parse(json, parseContactRequestEnvelope)
  }

  /** Confirms a contact request with the buyer's details and explicit consent. */
  async confirmContactRequest(
    id: string,
    req: ContactConfirmRequest,
    opts: RequestOptions = {},
  ): Promise<ContactConfirmResponse> {
    // Defence in depth for untyped callers: never send a confirmation without consent.
    if ((req.consent as unknown) !== true) {
      throw new TypeError('confirmContactRequest: consent must be true')
    }
    // Only contract fields are forwarded.
    const body: ContactConfirmRequest = {
      first_name: req.first_name,
      last_name: req.last_name,
      consent: true,
    }
    if (req.phone) body.phone = req.phone
    if (req.email) body.email = req.email
    if (req.test_drive_at) body.test_drive_at = req.test_drive_at
    const path = `/api/motology/contact-requests/${encodeURIComponent(id)}/confirm`
    const json = await this.request('POST', path, { ...opts, body })
    return this.parse(json, parseContactConfirmEnvelope)
  }

  // ── Internals ───────────────────────────────────────────────────────────────
  private parse<T>(json: unknown, parser: (body: unknown) => T): T {
    try {
      return parser(json)
    } catch (err) {
      if (err instanceof InvalidResponseError) {
        throw new MotologyApiError('invalid_response', 502, err.message, { cause: err })
      }
      throw err
    }
  }

  private async request(
    method: HttpMethod,
    path: string,
    init: RequestOptions & { body?: unknown },
  ): Promise<unknown> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.timeoutMs)

    const onCallerAbort = () => controller.abort()
    if (init.signal) {
      if (init.signal.aborted) controller.abort()
      else init.signal.addEventListener('abort', onCallerAbort, { once: true })
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Motology-Key': this.apiKey,
      'X-Source': SOURCE_HEADER_VALUE,
    }
    if (init.clientIp) headers[CLIENT_IP_HEADER] = init.clientIp
    const userAgent = init.userAgent ? stripControlChars(init.userAgent).trim().slice(0, 300) : undefined
    if (userAgent) headers[USER_AGENT_HEADER] = userAgent
    if (init.body !== undefined) headers['Content-Type'] = 'application/json'

    try {
      let res: Response
      try {
        res = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method,
          headers,
          body: init.body === undefined ? undefined : JSON.stringify(init.body),
          signal: controller.signal,
        })
      } catch (err) {
        throw this.transportError(err, timedOut)
      }

      let json: unknown
      try {
        const text = await res.text()
        json = text ? (JSON.parse(text) as unknown) : undefined
      } catch (err) {
        if (timedOut || controller.signal.aborted) throw this.transportError(err, timedOut)
        if (res.ok) {
          throw new MotologyApiError('invalid_response', 502, 'Gateway returned invalid JSON', {
            cause: err,
          })
        }
        json = undefined
      }

      if (!res.ok) {
        const detail = parseErrorDetail(json)
        throw new MotologyApiError('http', res.status, `Gateway responded with HTTP ${res.status}`, {
          detail,
        })
      }
      return json
    } finally {
      clearTimeout(timer)
      init.signal?.removeEventListener('abort', onCallerAbort)
    }
  }

  private transportError(err: unknown, timedOut: boolean): MotologyApiError {
    if (err instanceof MotologyApiError) return err
    if (timedOut) {
      return new MotologyApiError('timeout', 504, `Gateway did not respond within ${this.timeoutMs}ms`, {
        cause: err,
      })
    }
    if (err instanceof Error && err.name === 'AbortError') {
      return new MotologyApiError('aborted', 499, 'Request was aborted', { cause: err })
    }
    return new MotologyApiError('network', 502, 'Gateway is unreachable', { cause: err })
  }
}

/** Reads `MOTOLOGY_GATEWAY_URL` and `MOTOLOGY_API_KEY`; compatible with `process.env`. */
export type MotologyEnv = Readonly<Record<string, string | undefined>>

export class MotologyConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MotologyConfigError'
  }
}

/**
 * Builds a client from `MOTOLOGY_GATEWAY_URL` / `MOTOLOGY_API_KEY`.
 * Throws `MotologyConfigError` (without echoing secret values) when unset or invalid.
 */
export function createMotologyClientFromEnv(
  env: MotologyEnv = process.env,
  overrides: Pick<MotologyApiClientOptions, 'fetch' | 'timeoutMs'> = {},
): MotologyApiClient {
  const baseUrl = env.MOTOLOGY_GATEWAY_URL?.trim()
  const apiKey = env.MOTOLOGY_API_KEY?.trim()
  if (!baseUrl) throw new MotologyConfigError('MOTOLOGY_GATEWAY_URL is not set')
  if (!apiKey) throw new MotologyConfigError('MOTOLOGY_API_KEY is not set')
  try {
    return new MotologyApiClient({ baseUrl, apiKey, ...overrides })
  } catch (err) {
    throw new MotologyConfigError(
      `MOTOLOGY_GATEWAY_URL is not a valid URL${err instanceof Error ? ` (${err.name})` : ''}`,
    )
  }
}
