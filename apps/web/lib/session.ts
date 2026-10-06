/**
 * Anonymous buyer sessions.
 *
 * There are no buyer accounts yet. The BFF keeps the current gateway
 * `conversation_id` in an httpOnly cookie so the browser never has to manage
 * it, and so server components (e.g. the offer page) can tell whether the
 * viewer owns a conversation.
 */
export const CONVERSATION_COOKIE = 'motology_cid'

/** 30 days. */
export const CONVERSATION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const CONVERSATION_ID_RE = /^[A-Za-z0-9_-]{1,128}$/

export function isValidConversationId(value: unknown): value is string {
  return typeof value === 'string' && CONVERSATION_ID_RE.test(value)
}

export interface ConversationCookieOptions {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
}

export function conversationCookieOptions(
  maxAge: number = CONVERSATION_COOKIE_MAX_AGE_SECONDS,
): ConversationCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  }
}
