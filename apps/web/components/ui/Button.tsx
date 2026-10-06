import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-brand-fg shadow-card hover:bg-brand-strong',
  secondary: 'border border-border bg-surface text-ink shadow-card hover:border-ink/20 hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-ink',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 rounded-lg px-3 text-[13px]',
  md: 'h-10 rounded-xl px-4 text-sm',
  lg: 'h-12 rounded-xl px-5 text-[15px]',
}

/** Shared button styling for `<button>` and `<Link>` alike. */
export function buttonClass(
  { variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {},
  className?: string,
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className)
}
