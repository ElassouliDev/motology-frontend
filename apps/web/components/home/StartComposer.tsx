import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { MAX_MESSAGE_LENGTH } from '@/lib/validation'
import { cn } from '@/lib/utils'

/**
 * A plain GET form to `/chat?q=…`, so it works before any JavaScript loads.
 * The chat screen sends `q` as the first message.
 */
export function StartComposer({ className }: { className?: string }) {
  return (
    <form action="/chat" method="get" role="search" className={cn('relative', className)}>
      <label htmlFor="start-q" className="sr-only">
        What are you shopping for?
      </label>
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-4 shadow-lift transition focus-within:border-brand focus-within:shadow-ring">
        <Icon name="search" className="shrink-0 text-muted" />
        <input
          id="start-q"
          name="q"
          required
          maxLength={MAX_MESSAGE_LENGTH}
          autoComplete="off"
          placeholder="A family SUV under $40k with good safety ratings"
          className="min-w-0 flex-1 bg-transparent py-2 text-[15px] text-ink outline-none placeholder:text-muted/70"
        />
        <button type="submit" className={buttonClass({ size: 'md' })}>
          <span className="hidden sm:inline">Start</span>
          <Icon name="arrow-right" size={16} />
          <span className="sr-only sm:hidden">Start</span>
        </button>
      </div>
    </form>
  )
}
