'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ChatResponse, MotologyState } from '@motology/types'
import { buttonClass } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { LogoMark } from '@/components/ui/Logo'
import { Markdown } from '@/lib/markdown'
import { MAX_MESSAGE_LENGTH } from '@/lib/validation'
import { loadZip, saveZip } from '@/lib/zip'
import { cn } from '@/lib/utils'
import { DealPanel } from './DealPanel'
import { DecisionCard } from './DecisionCard'
import { ZipControl } from './ZipControl'

interface UiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  /** Vehicle the buyer came from (`/chat?stock=…`); sent with the first message. */
  stockNumber?: string
  /** Conversation already held in the session cookie, if any. */
  initialConversationId?: string
  /** Deal state of that conversation, so a returning buyer sees where they left off. */
  initialState?: MotologyState | null
  /** First message to send on arrival (`/chat?q=…`). */
  initialQuery?: string
  /** The saved conversation exists but its deal could not be loaded (gateway error). */
  stateLoadFailed?: boolean
}

const GENERAL_SUGGESTIONS: { icon: IconName; label: string }[] = [
  { icon: 'user', label: 'Best family SUV under $65K' },
  { icon: 'leaf', label: 'Most fuel efficient option' },
  { icon: 'mountain', label: 'Best car for off-roading' },
  { icon: 'wallet', label: 'I want to sell my car' },
]

const VEHICLE_SUGGESTIONS: { icon: IconName; label: string }[] = [
  { icon: 'chart', label: 'Is this a fair price?' },
  { icon: 'tag', label: 'What should I offer?' },
  { icon: 'wrench', label: 'Any recalls or history issues?' },
  { icon: 'clock', label: 'Should I buy now or wait?' },
]

const GENERIC_ERROR = 'Something went wrong. Please try again.'
const COUNTER_THRESHOLD = MAX_MESSAGE_LENGTH - 200
/** How close to the bottom (px) still counts as "following" the conversation. */
const STICKY_THRESHOLD = 120

function isChatResponse(value: unknown): value is ChatResponse {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ChatResponse>
  return typeof v.conversation_id === 'string' && typeof v.reply === 'string' && typeof v.motology === 'object'
}

function errorMessageFrom(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'error' in value) {
    const { error } = value as { error: unknown }
    if (typeof error === 'string' && error) return error
  }
  return GENERIC_ERROR
}

function hasDeal(state: MotologyState | null): boolean {
  return Boolean(state && (state.pricing_frame || state.current_offer || state.vehicle))
}

export function ChatInterface({
  stockNumber,
  initialConversationId,
  initialState = null,
  initialQuery,
  stateLoadFailed = false,
}: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<MotologyState | null>(initialState)
  const [handoff, setHandoff] = useState(false)
  const [contactRequestId, setContactRequestId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId ?? null)
  const [zip, setZip] = useState<string | null>(null)
  /** The ZIP the current prices were quoted for; `undefined` until known. */
  const [quotedZip, setQuotedZip] = useState<string | null | undefined>(undefined)
  /** The text of the message that failed, so Retry resends it and not the composer. */
  const [failedText, setFailedText] = useState<string | null>(null)
  /** A saved deal that failed to load blocks sending, so nothing appends to a hidden deal. */
  const [loadFailed, setLoadFailed] = useState(stateLoadFailed)
  const [dealOpen, setDealOpen] = useState(false)

  const idCounter = useRef(0)
  /** Whether this page instance has already sent its first message. */
  const sentFirst = useRef(false)
  const inFlight = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const autoSent = useRef(false)
  /** The ZIP is read in an effect; the auto-sent first message waits for it. */
  const [zipLoaded, setZipLoaded] = useState(false)
  /** True until a `?q=` question has been sent, so the empty state does not flash first. */
  const [booting, setBooting] = useState(Boolean(initialQuery))

  const nextId = useCallback((prefix: string) => `${prefix}_${++idCounter.current}`, [])

  useEffect(() => {
    const saved = loadZip()
    setZip(saved)
    // A returning buyer's prices were quoted with the ZIP saved at the time.
    if (initialState?.pricing_frame) setQuotedZip(saved)
    setZipLoaded(true)
    // Another tab may change the ZIP; pick it up when this one is shown again.
    const onVisible = () => {
      if (document.visibilityState === 'visible') setZip(loadZip())
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read once on mount
  }, [])

  const updateZip = useCallback((value: string | null) => {
    setZip(value)
    saveZip(value)
  }, [])

  // Follow new content only while the buyer is already at the bottom.
  useEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, pending, state, error])

  useEffect(() => () => inFlight.current?.abort(), [])

  // Grow the composer with its content, up to a cap.
  useLayoutEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [input])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (dealOpen && !dialog.open) dialog.showModal()
    if (!dealOpen && dialog.open) dialog.close()
  }, [dealOpen])

  const send = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()
      if (!text || text.length > MAX_MESSAGE_LENGTH || inFlight.current || loadFailed) return

      const userMessage: UiMessage = { id: nextId('user'), role: 'user', content: text }
      stickToBottom.current = true
      setMessages(prev => [...prev, userMessage])
      setInput(current => (current.trim() === text ? '' : current))
      setError(null)
      setFailedText(null)
      setPending(true)

      const isFirst = !sentFirst.current
      const payload: Record<string, unknown> = { message: text }
      if (zip) payload.zip_code = zip
      if (isFirst && (stockNumber || initialQuery)) {
        // Arriving from a vehicle page or the home page starts a fresh conversation.
        if (stockNumber) payload.stock_number = stockNumber
        payload.new_conversation = true
      }

      const controller = new AbortController()
      inFlight.current = controller
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        })
        const data: unknown = await res.json().catch(() => null)
        if (!res.ok || !isChatResponse(data)) {
          throw new Error(res.ok ? GENERIC_ERROR : errorMessageFrom(data))
        }

        sentFirst.current = true
        setMessages(prev => [...prev, { id: nextId('assistant'), role: 'assistant', content: data.reply }])
        setState(data.motology)
        if (data.motology.pricing_frame) setQuotedZip(zip)
        setConversationId(data.conversation_id)
        if (data.handoff) setHandoff(true)
        if (typeof data.contact_request_id === 'string') setContactRequestId(data.contact_request_id)
      } catch (err) {
        if (controller.signal.aborted) return
        // Roll back the optimistic message and give the text back so nothing is lost.
        setMessages(prev => prev.filter(m => m.id !== userMessage.id))
        setInput(current => (current ? current : text))
        setFailedText(text)
        setError(err instanceof Error && err.message ? err.message : GENERIC_ERROR)
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null
          setPending(false)
        }
      }
    },
    [nextId, stockNumber, initialQuery, zip, loadFailed],
  )

  // `/chat?q=…`: send the question once, then drop it from the address bar so a
  // reload does not ask it again.
  useEffect(() => {
    if (!initialQuery || autoSent.current || !zipLoaded) return
    autoSent.current = true
    setBooting(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('q')
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    void send(initialQuery)
  }, [initialQuery, send, zipLoaded])

  const startOver = useCallback(async () => {
    inFlight.current?.abort()
    inFlight.current = null
    setPending(false)
    try {
      await fetch('/api/chat', { method: 'DELETE' })
    } catch {
      // Best effort: the next message falls back to a new conversation anyway
      // if the cookie could not be cleared.
    }
    sentFirst.current = false
    setMessages([])
    setInput('')
    setError(null)
    setFailedText(null)
    setLoadFailed(false)
    setQuotedZip(undefined)
    setState(null)
    setHandoff(false)
    setContactRequestId(null)
    setConversationId(null)
    inputRef.current?.focus()
  }, [])

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    void send(input)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void send(input)
    }
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD
  }

  const empty = messages.length === 0 && !pending && !booting
  const resumed = empty && Boolean(conversationId) && !stockNumber
  const tooLong = input.trim().length > MAX_MESSAGE_LENGTH
  const suggestions = stockNumber ? VEHICLE_SUGGESTIONS : GENERAL_SUGGESTIONS
  const dealReady = hasDeal(state)
  const scenario = state?.last_scenario ?? null
  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id
  const pricesStale = Boolean(state?.pricing_frame) && quotedZip !== undefined && quotedZip !== zip
  const stale = pricesStale
    ? {
        quotedZip: quotedZip ?? null,
        zip,
        disabled: pending || loadFailed,
        onRequote: () => {
          setDealOpen(false)
          void send(zip ? `Re-check the price near ZIP ${zip}.` : 'Re-check the price.')
        },
      }
    : null

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] w-full max-w-6xl">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:px-5">
          <p className="min-w-0 truncate text-sm text-muted">
            {stockNumber ? (
              <>
                <span className="hidden sm:inline">Asking about </span>
                <span className="font-medium text-ink">Stock #{stockNumber}</span>
              </>
            ) : (
              'Your car-buying advisor'
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <ZipControl zip={zip} onChange={updateZip} />
            <button
              type="button"
              onClick={() => setDealOpen(true)}
              className={cn(
                'relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink lg:hidden',
              )}
            >
              <Icon name="tag" size={15} />
              Deal
              {dealReady && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-brand" />}
            </button>
            <button
              type="button"
              onClick={() => void startOver()}
              disabled={empty && !conversationId && !loadFailed}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
            >
              <Icon name="edit" size={15} />
              <span className="hidden sm:inline">New chat</span>
              <span className="sr-only sm:hidden">New chat</span>
            </button>
          </div>
        </div>

        {/* Thread */}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex-1 overflow-y-auto overscroll-contain"
          aria-live="polite"
          aria-busy={pending}
        >
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {loadFailed && (
              <div role="alert" className="card mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-bad/10 text-bad">
                  <Icon name="alert" />
                </span>
                <div className="flex-1 text-sm">
                  <p className="font-semibold">We couldn&apos;t load your saved deal.</p>
                  <p className="mt-0.5 text-muted">Try again in a moment, or start a new chat.</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => router.refresh()} className={buttonClass({ size: 'sm' })}>
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => void startOver()}
                    className={buttonClass({ size: 'sm', variant: 'secondary' })}
                  >
                    New chat
                  </button>
                </div>
              </div>
            )}

            {empty && !loadFailed && (
              <div className="animate-fade-in pt-6 sm:pt-12">
                <LogoMark className="h-10 w-10 rounded-xl" />
                <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                  {stockNumber
                    ? 'What do you want to know about this car?'
                    : resumed
                      ? 'Welcome back.'
                      : 'What are you shopping for?'}
                </h1>
                <p className="mt-2 max-w-lg text-muted">
                  {resumed
                    ? 'Your deal so far is saved. Pick up where you left off, or start a new chat.'
                    : 'Ask about any car on the lot. You get its market value, what to offer and when to walk away.'}
                </p>
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {suggestions.map(s => (
                    <li key={s.label}>
                      <button
                        type="button"
                        onClick={() => void send(s.label)}
                        className="card flex w-full items-center gap-3 p-3.5 text-left text-sm font-medium transition hover:-translate-y-px hover:border-ink/20 hover:shadow-lift"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                          <Icon name={s.icon} size={16} />
                        </span>
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
                {zipLoaded && !zip && (
                  <div className="mt-4">
                    <ZipControl
                      zip={zip}
                      onChange={updateZip}
                      variant="inline"
                      onDone={() => inputRef.current?.focus()}
                    />
                  </div>
                )}
              </div>
            )}

            {messages.map(msg =>
              msg.role === 'user' ? (
                <div key={msg.id} className="flex animate-msg-in justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-[15px] leading-relaxed text-brand-fg">
                    <span className="sr-only">You: </span>
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex animate-msg-in gap-3">
                  <LogoMark className="mt-0.5 h-7 w-7 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="break-words text-[15px] leading-relaxed text-ink">
                      <span className="sr-only">Motology: </span>
                      <Markdown text={msg.content} />
                    </div>
                    {msg.id === lastAssistantId && scenario && (
                      <DecisionCard
                        scenario={scenario}
                        pricingFrame={null}
                        dealScore={state?.deal_score ?? null}
                        onAction={label => void send(label)}
                        disabled={pending}
                      />
                    )}
                  </div>
                </div>
              ),
            )}

            {pending && (
              <div className="flex gap-3" role="status">
                <LogoMark className="h-7 w-7 shrink-0 rounded-lg" />
                <div className="flex items-center gap-1 pt-2">
                  <span className="sr-only">Motology is working on it…</span>
                  {[0, 1, 2].map(i => (
                    <span
                      key={i}
                      aria-hidden
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {handoff && (
              <div role="status" className="card animate-scale-in flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon name="handshake" />
                </span>
                <div className="flex-1 text-sm">
                  <p className="font-semibold">You&apos;re now chatting with the dealership&apos;s sales assistant.</p>
                  <p className="mt-0.5 text-muted">
                    {contactRequestId
                      ? 'Want a person to follow up? Share how to reach you. Nothing is sent until you confirm.'
                      : 'Your target prices stay private to you.'}
                  </p>
                </div>
                {contactRequestId && (
                  <Link href={`/confirm/${encodeURIComponent(contactRequestId)}`} className={buttonClass({ size: 'sm' })}>
                    Share contact details
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">
            {error && (
              <div role="alert" className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-bad/25 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
                <span className="flex items-center gap-2">
                  <Icon name="alert" size={16} className="shrink-0" />
                  {error}
                </span>
                {failedText && (
                  <button
                    type="button"
                    onClick={() => void send(failedText)}
                    className="shrink-0 font-semibold underline-offset-2 hover:underline"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 rounded-2xl border border-border bg-surface p-2 pl-4 shadow-lift transition focus-within:border-brand focus-within:shadow-ring"
            >
              <label htmlFor="chat-input" className="sr-only">
                Message
              </label>
              <textarea
                ref={inputRef}
                id="chat-input"
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                maxLength={MAX_MESSAGE_LENGTH}
                autoComplete="off"
                enterKeyHint="send"
                placeholder={stockNumber ? 'Ask about this car, or name your price' : 'Ask about a car, a price or an offer'}
                className="max-h-[168px] min-h-[40px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-ink outline-none placeholder:text-muted/70"
              />
              <button
                type="submit"
                aria-label="Send message"
                disabled={pending || !input.trim() || tooLong || loadFailed}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-fg transition hover:bg-brand-strong active:scale-95 disabled:opacity-35"
              >
                <Icon name="arrow-up" size={18} strokeWidth={2.4} />
              </button>
            </form>
            <p className="mt-2 flex justify-between gap-3 px-1 text-[11px] text-muted">
              <span className="hidden sm:inline">Shift + Enter for a new line</span>
              {input.length > COUNTER_THRESHOLD && (
                <span className={cn('tabular shrink-0', tooLong && 'text-bad')}>
                  {input.length}/{MAX_MESSAGE_LENGTH}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Deal panel: a column on desktop, a sheet on mobile */}
      <aside aria-label="Your deal" className="hidden w-[360px] shrink-0 overflow-y-auto border-l border-border p-5 lg:block">
        <p className="eyebrow mb-4">Your deal</p>
        <DealPanel state={state} conversationId={conversationId} stockNumber={stockNumber} stale={stale} />
      </aside>

      <dialog
        ref={dialogRef}
        aria-label="Your deal"
        onClose={() => setDealOpen(false)}
        onClick={e => {
          if (e.target === e.currentTarget) setDealOpen(false)
        }}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-t border-border bg-canvas p-0 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm lg:hidden"
      >
        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Your deal</p>
            <button
              type="button"
              onClick={() => setDealOpen(false)}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink"
            >
              <Icon name="x" />
            </button>
          </div>
          <DealPanel state={state} conversationId={conversationId} stockNumber={stockNumber} stale={stale} />
        </div>
      </dialog>
    </div>
  )
}
