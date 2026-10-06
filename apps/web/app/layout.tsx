import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SiteHeader } from '@/components/site/SiteHeader'
import { APP_URL } from '@/lib/site'
// Self-hosted: served from this site, never from a third-party font CDN.
import '@fontsource-variable/inter'
import './globals.css'

const appUrl = APP_URL

export const metadata: Metadata = {
  title: {
    default: 'Motology: know what to pay for your next car',
    template: '%s · Motology',
  },
  description:
    'See what a car is really worth, what to offer and when to walk away, from live market data. Your targets stay private.',
  metadataBase: appUrl,
  openGraph: {
    title: 'Motology',
    description: 'Know what to pay before you talk to a dealer.',
    url: appUrl,
    siteName: 'Motology',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Motology',
    description: 'Know what to pay before you talk to a dealer.',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0C0B' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-fg focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
