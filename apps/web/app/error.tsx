'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Only the digest is reported; server error details are never sent to the browser.
    if (error.digest) console.error('Page error', error.digest)
  }, [error])

  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bad/10 text-bad">
        <Icon name="alert" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">That&apos;s on us. Please try again in a moment.</p>
      <div className="mt-7 flex gap-2">
        <button type="button" onClick={reset} className={buttonClass()}>
          <Icon name="refresh" size={16} /> Try again
        </button>
        <Link href="/" className={buttonClass({ variant: 'secondary' })}>
          Go home
        </Link>
      </div>
    </div>
  )
}
