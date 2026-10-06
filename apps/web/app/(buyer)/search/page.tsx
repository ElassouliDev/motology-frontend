import type { Metadata } from 'next'
import Link from 'next/link'
import type { Vehicle, VehicleSearchParams } from '@motology/types'
import { SearchFilters } from '@/components/search/SearchFilters'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { VehicleCard } from '@/components/vehicle/VehicleCard'
import { toPublicError } from '@/lib/server/errors'
import { gatewayRequestOptions, getMotologyClient } from '@/lib/server/motology'
import { parseSearchParams, type RawSearchParams, type SearchFormValues } from '@/lib/validation'

export const metadata: Metadata = {
  title: 'Browse cars',
}

interface Props {
  searchParams: Promise<RawSearchParams>
}

const FIELD_LABELS: Record<keyof SearchFormValues, string> = {
  q: 'Keyword',
  make: 'Make',
  model: 'Model',
  max_price: 'Max price',
  year_min: 'Year from',
}

type SearchResult = { ok: true; vehicles: Vehicle[] } | { ok: false; message: string }

async function runSearch(params: VehicleSearchParams): Promise<SearchResult> {
  try {
    return { ok: true, vehicles: await getMotologyClient().searchVehicles(params, await gatewayRequestOptions()) }
  } catch (err) {
    return { ok: false, message: toPublicError(err, 'search page').message }
  }
}

function SearchHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-3xl font-semibold tracking-tight">Browse cars</h1>
      <p className="text-muted">Pick a car to see what it is really worth and what to offer.</p>
    </div>
  )
}

function retryHref(form: SearchFormValues): string {
  const qs = new URLSearchParams(Object.entries(form).filter(([, v]) => v !== '')).toString()
  return qs ? `/search?${qs}` : '/search'
}

export default async function SearchPage({ searchParams }: Props) {
  const { params, form, hasFilters, invalid } = parseSearchParams(await searchParams)
  const result = await runSearch(params)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <SearchHeader />

      <div className="mt-6">
        <SearchFilters form={form} hasFilters={hasFilters} />
      </div>

      {invalid.length > 0 && (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-warn">
          <Icon name="info" size={15} />
          We ignored the {invalid.map(f => FIELD_LABELS[f].toLowerCase()).join(' and ')} filter because it
          wasn&apos;t a valid number.
        </p>
      )}

      <section aria-label="Results" className="mt-8">
        {!result.ok ? (
          <div role="alert" className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bad/10 text-bad">
              <Icon name="alert" />
            </span>
            <p className="mt-4 font-semibold">We couldn&apos;t load cars right now</p>
            <p className="mt-1 max-w-sm text-sm text-muted">{result.message}</p>
            <Link href={retryHref(form)} className={buttonClass({ variant: 'secondary' }, 'mt-6')}>
              <Icon name="refresh" size={16} /> Try again
            </Link>
          </div>
        ) : result.vehicles.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-muted">
              <Icon name="search" />
            </span>
            <p className="mt-4 font-semibold">{hasFilters ? 'No cars match those filters' : 'No cars listed right now'}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {hasFilters
                ? 'Try a higher price, an earlier year or fewer filters. Or tell Motology what you need and it will look for you.'
                : 'Check back soon, or tell Motology what you are looking for.'}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {hasFilters && (
                <Link href="/search" className={buttonClass({ variant: 'secondary' })}>
                  Clear filters
                </Link>
              )}
              <Link href="/chat" className={buttonClass()}>
                <Icon name="message" size={16} /> Ask Motology
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted" role="status">
              <span className="tabular font-medium text-ink">{result.vehicles.length}</span>{' '}
              {result.vehicles.length === 1 ? 'car' : 'cars'}
              {hasFilters ? ' match your search' : ' available'}
            </p>
            <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.vehicles.map((v, i) => (
                <li key={v.stock_number}>
                  <VehicleCard vehicle={v} priority={i < 3} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
