/**
 * Main buyer chat interface.
 * All intelligence comes from the AutomotiveAI backend via the BFF (`/api/chat`).
 * This page owns the UX only: no pricing logic here.
 */
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { isMotologyApiError } from '@motology/api-client'
import type { MotologyState } from '@motology/types'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { gatewayRequestOptions, getMotologyClient } from '@/lib/server/motology'
import { CONVERSATION_COOKIE, isValidConversationId } from '@/lib/session'
import { isValidStockNumber, MAX_MESSAGE_LENGTH, type RawSearchParams } from '@/lib/validation'

export const metadata: Metadata = {
  title: 'Get your price',
}

interface Props {
  searchParams: Promise<RawSearchParams>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

type LoadedState = { state: MotologyState | null; failed: boolean }

/**
 * The returning buyer's deal so far. An unknown conversation (404) simply
 * starts fresh; any other failure is reported, because the session cookie
 * would otherwise keep appending to a deal the buyer cannot see.
 */
async function loadState(conversationId: string): Promise<LoadedState> {
  try {
    return { state: await getMotologyClient().getConversation(conversationId, await gatewayRequestOptions()), failed: false }
  } catch (err) {
    if (isMotologyApiError(err) && err.status === 404) return { state: null, failed: false }
    console.error('motology: could not load conversation state', isMotologyApiError(err) ? err.code : 'unexpected error')
    return { state: null, failed: true }
  }
}

export default async function ChatPage({ searchParams }: Props) {
  const raw = await searchParams
  const stockParam = firstParam(raw.stock)
  const stockNumber = isValidStockNumber(stockParam) ? stockParam : undefined
  const query = firstParam(raw.q)?.trim()
  const initialQuery = query && query.length <= MAX_MESSAGE_LENGTH ? query : undefined

  // A vehicle link or a new question starts a fresh conversation, so only
  // surface the existing one when the buyer is continuing a general chat.
  const cookieValue = (await cookies()).get(CONVERSATION_COOKIE)?.value
  const conversationId =
    !stockNumber && !initialQuery && isValidConversationId(cookieValue) ? cookieValue : undefined
  const loaded = conversationId ? await loadState(conversationId) : { state: null, failed: false }
  const initialState = loaded.state

  return (
    <ChatInterface
      key={`${stockNumber ?? 'general'}:${initialQuery ?? ''}:${loaded.failed ? 'load-failed' : 'loaded'}`}
      stockNumber={stockNumber}
      initialConversationId={initialState || loaded.failed ? conversationId : undefined}
      initialState={initialState}
      initialQuery={initialQuery}
      stateLoadFailed={loaded.failed}
    />
  )
}
