import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-muted">
        <Icon name="search" size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">We can&apos;t find that page</h1>
      <p className="mt-2 text-muted">The car may have sold, or the link may be out of date.</p>
      <div className="mt-7 flex gap-2">
        <Link href="/search" className={buttonClass()}>
          Browse cars
        </Link>
        <Link href="/chat" className={buttonClass({ variant: 'secondary' })}>
          Ask Motology
        </Link>
      </div>
    </div>
  )
}
