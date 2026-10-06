'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/components/ui/Logo'
import { PRIVACY_URL, TERMS_URL } from '@/lib/site'

/** Hidden on the chat screen, which fills the viewport. */
export function SiteFooter() {
  const pathname = usePathname() ?? '/'
  if (pathname.startsWith('/chat')) return null

  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo className="h-6" />
          <p className="mt-4 text-sm leading-relaxed text-muted">
            The car-buying advisor that works for you. Your target prices stay private, and no dealership hears from
            you until you say so.
          </p>
        </div>
        <div>
          <p className="eyebrow">Shop</p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/search" className="text-muted hover:text-ink">
                Browse cars
              </Link>
            </li>
            <li>
              <Link href="/chat" className="text-muted hover:text-ink">
                Get a price analysis
              </Link>
            </li>
            <li>
              <Link href="/#how-it-works" className="text-muted hover:text-ink">
                How it works
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow">About the numbers</p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Prices marked <span className="font-medium text-ink">Live market</span> come from current listings near
            you. Anything else is marked as an estimate. Always confirm the final numbers with the
            dealership before you sign.
          </p>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} Motology. Motology is not a dealership and does not sell vehicles.
          </p>
          {(PRIVACY_URL || TERMS_URL) && (
            <ul className="flex gap-5">
              {PRIVACY_URL && (
                <li>
                  <a href={PRIVACY_URL} className="hover:text-ink">
                    Privacy
                  </a>
                </li>
              )}
              {TERMS_URL && (
                <li>
                  <a href={TERMS_URL} className="hover:text-ink">
                    Terms
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </footer>
  )
}
