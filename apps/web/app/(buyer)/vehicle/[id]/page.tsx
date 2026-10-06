import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { isMotologyApiError } from '@motology/api-client'
import type { Vehicle } from '@motology/types'
import { buttonClass } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { StatGrid } from '@/components/ui/StatGrid'
import { VehicleImage } from '@/components/vehicle/VehicleImage'
import { EMPTY, formatCurrency, formatMileage, humanize, vehicleTitle } from '@/lib/format'
import { toPublicError } from '@/lib/server/errors'
import { gatewayRequestOptions, getMotologyClient } from '@/lib/server/motology'
import { isValidStockNumber } from '@/lib/validation'

interface Props {
  params: Promise<{ id: string }>
}

type VehicleResult =
  | { status: 'ok'; vehicle: Vehicle }
  | { status: 'not_found' }
  | { status: 'error'; message: string }

/** Deduplicated between generateMetadata and the page within one request. */
const loadVehicle = cache(async (stockNumber: string): Promise<VehicleResult> => {
  if (!isValidStockNumber(stockNumber)) return { status: 'not_found' }
  try {
    return { status: 'ok', vehicle: await getMotologyClient().getVehicle(stockNumber, await gatewayRequestOptions()) }
  } catch (err) {
    if (isMotologyApiError(err) && err.code === 'http' && err.status === 404) return { status: 'not_found' }
    return { status: 'error', message: toPublicError(err, 'vehicle page').message }
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const result = await loadVehicle(id)
  return { title: result.status === 'ok' ? vehicleTitle(result.vehicle) : 'Vehicle' }
}

const QUESTIONS = ['Is this a fair price?', 'What should I offer?', 'Any recalls or history issues?']

const INCLUDED: { icon: IconName; label: string }[] = [
  { icon: 'chart', label: 'Market value from comparable cars near you' },
  { icon: 'tag', label: 'Opening offer, good price and walk-away' },
  { icon: 'clock', label: 'Days on the lot and local supply' },
  { icon: 'wrench', label: 'Vehicle history and open recalls' },
]

function chatHref(stockNumber: string, question?: string): string {
  const params = new URLSearchParams({ stock: stockNumber })
  if (question) params.set('q', question)
  return `/chat?${params.toString()}`
}

export default async function VehiclePage({ params }: Props) {
  const { id } = await params
  const result = await loadVehicle(id)

  if (result.status === 'not_found') notFound()
  if (result.status === 'error') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <div role="alert" className="card flex flex-col items-center px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bad/10 text-bad">
            <Icon name="alert" />
          </span>
          <p className="mt-4 font-semibold">We couldn&apos;t load this car</p>
          <p className="mt-1 max-w-sm text-sm text-muted">{result.message}</p>
          <Link href="/search" className={buttonClass({ variant: 'secondary' }, 'mt-6')}>
            <Icon name="arrow-left" size={16} /> Back to cars
          </Link>
        </div>
      </div>
    )
  }

  const v = result.vehicle
  const title = vehicleTitle(v)
  const details = [
    { label: 'Mileage', value: formatMileage(v.mileage) },
    { label: 'Condition', value: humanize(v.condition) },
    { label: 'Exterior', value: humanize(v.exterior_color) },
    { label: 'Trim', value: v.trim || EMPTY },
    { label: 'Stock #', value: v.stock_number },
    { label: 'VIN', value: v.vin || EMPTY, mono: Boolean(v.vin) },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/search" className="inline-flex items-center gap-1.5 text-muted hover:text-ink">
          <Icon name="arrow-left" size={15} /> All cars
        </Link>
      </nav>

      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <VehicleImage
            src={v.image_url}
            alt={title}
            className="aspect-[16/10] rounded-[1.25rem] border border-border"
            sizes="(min-width: 1024px) 720px, 100vw"
            priority
          />
          <section aria-labelledby="specs" className="card p-5">
            <h2 id="specs" className="font-semibold">
              Details
            </h2>
            <div className="mt-4">
              <StatGrid stats={details} columns={3} />
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-5 sm:p-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {v.trim && <p className="mt-0.5 text-muted">{v.trim}</p>}
            <div className="mt-5 border-t border-border pt-5">
              <p className="text-sm text-muted">Dealer asking price</p>
              <p className="tabular mt-0.5 text-4xl font-semibold tracking-tight">{formatCurrency(v.price)}</p>
              <p className="mt-2 text-sm text-muted">Find out if that&apos;s fair before you call the dealer.</p>
            </div>

            <Link href={chatHref(v.stock_number, QUESTIONS[0])} className={buttonClass({ size: 'lg' }, 'mt-5 w-full')}>
              Check this price <Icon name="arrow-right" size={16} />
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUESTIONS.slice(1).map(q => (
                <Link
                  key={q}
                  href={chatHref(v.stock_number, q)}
                  className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-ink/20 hover:text-ink"
                >
                  {q}
                </Link>
              ))}
              <Link
                href={chatHref(v.stock_number)}
                className="rounded-full border border-border px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-ink/20 hover:text-ink"
              >
                Ask something else
              </Link>
            </div>

            <ul className="mt-6 space-y-3 border-t border-border pt-5">
              {INCLUDED.map(item => (
                <li key={item.label} className="flex items-start gap-3 text-sm">
                  <Icon name={item.icon} size={17} className="mt-0.5 shrink-0 text-brand" />
                  <span className="text-muted">{item.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-[13px] text-muted">
              <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
              Your opening offer and good price are never shared with the dealership.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
