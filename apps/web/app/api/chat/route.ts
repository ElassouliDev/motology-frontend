/**
 * BFF: buyer chat.
 *
 * The browser talks only to this handler; it forwards to the AutomotiveAI
 * gateway server-side (with the secret key) and keeps the gateway
 * conversation id in an httpOnly cookie.
 */
import { NextResponse, type NextRequest } from 'next/server'
import type { ChatResponse } from '@motology/types'
import { getClientIp } from '@/lib/server/client-ip'
import { toPublicError } from '@/lib/server/errors'
import { getMotologyClient } from '@/lib/server/motology'
import {
  CONVERSATION_COOKIE,
  conversationCookieOptions,
  isValidConversationId,
} from '@/lib/session'
import { parseChatInput } from '@/lib/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Generous upper bound for a 2000-character message plus metadata, in bytes. */
const MAX_BODY_BYTES = 16 * 1024

const NO_STORE = { 'Cache-Control': 'no-store' }

const RATE_LIMITED_MESSAGE = "You're sending messages too fast, try again in a minute."

function errorResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const parsed = parseChatInput(body)
  if (!parsed.ok) return errorResponse(400, parsed.error)
  const input = parsed.value

  const cookieValue = request.cookies.get(CONVERSATION_COOKIE)?.value
  const conversationId =
    !input.new_conversation && isValidConversationId(cookieValue) ? cookieValue : undefined

  const clientIp = getClientIp(request.headers)

  let result: ChatResponse
  try {
    result = await getMotologyClient().chat(
      {
        message: input.message,
        ...(conversationId ? { conversation_id: conversationId } : {}),
        ...(input.zip_code ? { zip_code: input.zip_code } : {}),
        ...(input.stock_number ? { stock_number: input.stock_number } : {}),
      },
      { signal: request.signal, ...(clientIp ? { clientIp } : {}) },
    )
  } catch (err) {
    const { status, message } = toPublicError(err, 'POST /api/chat')
    const response = errorResponse(status, status === 429 ? RATE_LIMITED_MESSAGE : message)
    // The gateway no longer knows this conversation: drop the stale cookie so
    // the next message starts a fresh one.
    if (status === 404 && conversationId) {
      response.cookies.set(CONVERSATION_COOKIE, '', conversationCookieOptions(0))
    }
    return response
  }

  const response = NextResponse.json(result, { headers: NO_STORE })
  if (isValidConversationId(result.conversation_id)) {
    response.cookies.set(CONVERSATION_COOKIE, result.conversation_id, conversationCookieOptions())
  } else {
    console.warn('[motology] POST /api/chat: gateway returned an unexpected conversation_id format')
  }
  return response
}

/** Forget the current conversation (the "New chat" button). */
export function DELETE(): NextResponse {
  const response = new NextResponse(null, { status: 204, headers: NO_STORE })
  response.cookies.set(CONVERSATION_COOKIE, '', conversationCookieOptions(0))
  return response
}
