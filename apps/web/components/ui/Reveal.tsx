'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * Fades content up as it scrolls into view. Server HTML is fully visible (no
 * JavaScript, no problem); only content still below the fold at mount is
 * hidden. It starts revealing a little before it enters the viewport, so a
 * scrolling reader never sees an empty gap, and printing shows everything.
 */
export function Reveal({ children, delayMs = 0, className }: { children: ReactNode; delayMs?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'static' | 'hidden' | 'shown'>('static')

  useEffect(() => {
    const el = ref.current
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setState('hidden')
    const show = () => {
      setState('shown')
      io.disconnect()
      window.removeEventListener('beforeprint', show)
    }
    const io = new IntersectionObserver(entries => entries.some(e => e.isIntersecting) && show(), {
      // Positive bottom margin: begin the fade while the card is still just
      // below the fold, so it is already arriving when it comes into view.
      rootMargin: '0px 0px 20% 0px',
    })
    io.observe(el)
    window.addEventListener('beforeprint', show)
    return () => {
      io.disconnect()
      window.removeEventListener('beforeprint', show)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={cn(
        state !== 'static' && 'transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        state === 'hidden' && 'translate-y-4 opacity-0',
        className,
      )}
      style={state === 'shown' ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  )
}
