'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { Icon } from '@/components/ui/Icon'
import { isValidZip } from '@/lib/zip'
import { cn } from '@/lib/utils'

interface Props {
  zip: string | null
  onChange: (zip: string | null) => void
  /** `chip` sits in a toolbar; `inline` is a full-width prompt. */
  variant?: 'chip' | 'inline'
  /** Called after the inline prompt closes, so the page can place focus (it unmounts). */
  onDone?: () => void
}

export function ZipControl({ zip, onChange, variant = 'chip', onDone }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(zip ?? '')
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  /** Set when the editor closes, so focus returns to the chip instead of <body>. */
  const returnFocus = useRef(false)
  const id = useId()

  useEffect(() => {
    if (editing) inputRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      chipRef.current?.focus()
    }
  }, [editing])

  const close = () => {
    returnFocus.current = true
    setEditing(false)
    setInvalid(false)
    if (variant === 'inline') onDone?.()
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const value = draft.trim()
    if (value === '') {
      onChange(null)
      close()
      return
    }
    if (!isValidZip(value)) {
      setInvalid(true)
      return
    }
    onChange(value)
    close()
  }

  const form = (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <label htmlFor={id} className="sr-only">
        ZIP code
      </label>
      <input
        ref={inputRef}
        id={id}
        value={draft}
        onChange={e => {
          setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))
          setInvalid(false)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setDraft(zip ?? '')
            close()
          }
        }}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="ZIP code"
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-err` : undefined}
        className={cn(
          'w-24 rounded-lg border bg-surface px-2.5 py-1.5 text-sm tabular outline-none transition focus:border-brand focus:shadow-ring',
          invalid ? 'border-bad' : 'border-border',
        )}
      />
      <button type="submit" className="rounded-lg bg-brand px-2.5 py-1.5 text-[13px] font-semibold text-brand-fg hover:bg-brand-strong">
        Save
      </button>
      {invalid && (
        <span id={`${id}-err`} role="alert" className="text-xs text-bad">
          5 digits
        </span>
      )}
    </form>
  )

  if (variant === 'inline') {
    if (zip && !editing) return null
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-border bg-surface/60 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2.5 text-sm text-muted">
          <Icon name="map-pin" size={17} className="mt-0.5 shrink-0 text-brand" />
          <span>
            <span className="font-medium text-ink">Add your ZIP for local pricing.</span> Market value depends on
            comparable cars near you.
          </span>
        </p>
        {form}
      </div>
    )
  }

  if (editing) return form

  return (
    <button
      ref={chipRef}
      type="button"
      onClick={() => {
        setDraft(zip ?? '')
        setEditing(true)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
        zip ? 'text-muted hover:bg-surface-2 hover:text-ink' : 'bg-warn/10 text-warn hover:bg-warn/15',
      )}
      aria-label={zip ? `Pricing near ${zip}. Change ZIP code` : 'Add your ZIP code for local pricing'}
    >
      <Icon name="map-pin" size={15} />
      <span className="tabular">{zip ?? 'Add ZIP'}</span>
    </button>
  )
}
