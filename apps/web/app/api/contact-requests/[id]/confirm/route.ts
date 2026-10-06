/**
 * BFF: buyer confirms an agent-initiated dealer contact request.
 *
 * The confirmation page posts here; this handler validates the buyer's
 * details and explicit consent, then forwards to the AutomotiveAI gateway
 * server-side (with the secret key and the buyer's IP). Only after the
 * gateway accepts is a lead created at the dealer.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { getClientIp } from '@/lib/server/client-ip'
import { toPublicError } from '@/lib/server/errors'
import { getMotologyClient } from '@/lib/server/motology'
import { isValidContactRequestId, parseContactConfirmInput } from '@/lib/contact'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Two names, a phone, an email and a flag fit comfortably in 4 KiB. */
const MAX_BODY_BYTES = 4 * 1024

const NO_STORE = { 'Cache-Control': 'no-store' }

const NOT_FOUND_MESSAGE = "We couldn't find this request. Ask your assistant to send you a new link."

/** Buyer-facing messages for statuses where the generic mapping is too vague. */
const CONFIRM_MESSAGES: Partial<Record<number, string>> = {
  404: NOT_FOUND_MESSAGE,
  409: 'This request has already been confirmed or has expired.',
  422: 'Some of your details were not accepted. Please check them and try again.',
  429: 'Too many attempts. Please wait a minute and try again.',
}

interface Context {
  params: Promise<{ id: string }>
}

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

export async function POST(request: NextRequest, { params }: Context): Promise<NextResponse> {
  const { id } = await params
  if (!isValidContactRequestId(id)) return errorResponse(404, NOT_FOUND_MESSAGE)

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return errorResponse(415, 'Content-Type must be application/json.')
  }

  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'Request body is too large.')
  }

  let raw: string
  try {
    raw = await request.text()
  } catch {
    return errorResponse(400, 'Could not read the request body.')
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'Request body is too large.')
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return errorResponse(400, 'Request body must be valid JSON.')
  }

  const parsed = parseContactConfirmInput(body)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error, ...(parsed.field ? { field: parsed.field } : {}) },
      { status: 400, headers: NO_STORE },
    )
  }

  const clientIp = getClientIp(request.headers)
  // Recorded with the consent (the gateway passes it to the CRM's audit trail).
  const userAgent = request.headers.get('user-agent') ?? undefined

  try {
    const result = await getMotologyClient().confirmContactRequest(id, parsed.value, {
      signal: request.signal,
      ...(clientIp ? { clientIp } : {}),
      ...(userAgent ? { userAgent } : {}),
    })
    return NextResponse.json(result, { headers: NO_STORE })
  } catch (err) {
    const { status, message } = toPublicError(err, 'POST /api/contact-requests/[id]/confirm')
    return errorResponse(status, CONFIRM_MESSAGES[status] ?? message)
  }
}
