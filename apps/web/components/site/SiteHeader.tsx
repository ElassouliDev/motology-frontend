'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Logo } from '@/components/ui/Logo'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/search', label: 'Browse cars', match: ['/search', '/vehicle'] },
  { href: '/#how-it-works', label: 'How it works', match: [] as string[] },
]

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const inChat = pathname.startsWith('/chat')

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-canvas/80 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas/70">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="rounded-lg" aria-label="Motology home">
          <Logo className="h-6" />
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          {NAV.map(item => {
            const active = item.match.some(m => pathname.startsWith(m))
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'hidden rounded-lg px-3 py-2 text-sm font-medium transition-colors sm:inline-flex',
                  active ? 'text-ink' : 'text-muted hover:text-ink',
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/search"
            aria-label="Browse cars"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink sm:hidden"
          >
            <Icon name="search" />
          </Link>
          {!inChat && (
            <Link href="/chat" className={buttonClass({ size: 'md' }, 'ml-1')}>
              <span>Get my price</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
