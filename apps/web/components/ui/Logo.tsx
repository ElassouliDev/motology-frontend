import { cn } from '@/lib/utils'
import { SYMBOL, WORDMARK } from './logo-paths'

/**
 * The motology wordmark. The first "o" is the price point: a lime dot, the
 * one number Motology finds for you. On light pages the dot gets a thin green
 * rim (plain lime vanishes on white); on dark pages the rim turns lime too.
 */
export function Wordmark({ className, title = 'motology' }: { className?: string; title?: string | null }) {
  const { dot } = WORDMARK
  return (
    <svg
      viewBox={WORDMARK.viewBox}
      className={cn('h-[22px] w-auto text-ink', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title ?? undefined}
    >
      <path d={WORDMARK.d} fill="currentColor" />
      <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill="rgb(var(--dot-rim))" />
      <circle cx={dot.cx} cy={dot.cy} r={dot.r * 0.84} fill="#C8F169" />
    </svg>
  )
}

/** The symbol: "m●" on the green tile. Favicon, app icon, chat avatar. */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={cn('h-8 w-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="1000" height="1000" rx="250" fill="rgb(var(--mark))" />
      <path d={SYMBOL.d} fill="#fff" />
      <circle cx={SYMBOL.dot.cx} cy={SYMBOL.dot.cy} r={SYMBOL.dot.r} fill="#C8F169" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return <Wordmark className={className} />
}
