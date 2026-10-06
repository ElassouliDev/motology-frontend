import Link from 'next/link'
import { buttonClass } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { SearchFormValues } from '@/lib/validation'

/** Plain GET form: filters live in the URL, so results are shareable and work without JavaScript. */
export function SearchFilters({ form, hasFilters }: { form: SearchFormValues; hasFilters: boolean }) {
  return (
    <form method="get" action="/search" className="card p-3 sm:p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto] md:items-end">
        <label className="field-label col-span-2 md:col-span-1">
          <span className="text-[13px] text-muted">Search</span>
          <span className="relative block">
            <Icon name="search" size={16} className="pointer-events-none absolute left-3.5 top-1/2 mt-[3px] -translate-y-1/2 text-muted" />
            <input
              name="q"
              defaultValue={form.q}
              maxLength={60}
              placeholder="Hybrid, AWD, third row…"
              className="input pl-10"
            />
          </span>
        </label>
        <label className="field-label">
          <span className="text-[13px] text-muted">Make</span>
          <input name="make" defaultValue={form.make} maxLength={60} placeholder="Any" className="input" />
        </label>
        <label className="field-label">
          <span className="text-[13px] text-muted">Model</span>
          <input name="model" defaultValue={form.model} maxLength={60} placeholder="Any" className="input" />
        </label>
        <label className="field-label">
          <span className="text-[13px] text-muted">Max price</span>
          <input
            name="max_price"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            defaultValue={form.max_price}
            placeholder="No max"
            className="input"
          />
        </label>
        <label className="field-label">
          <span className="text-[13px] text-muted">Year from</span>
          <input
            name="year_min"
            type="number"
            inputMode="numeric"
            min={1900}
            max={2100}
            step={1}
            defaultValue={form.year_min}
            placeholder="Any"
            className="input"
          />
        </label>
        <div className="col-span-2 flex gap-2 md:col-span-1">
          <button type="submit" className={buttonClass({ size: 'lg' }, 'flex-1 md:flex-none')}>
            Search
          </button>
          {hasFilters && (
            <Link href="/search" className={buttonClass({ variant: 'ghost', size: 'lg' })}>
              Clear
            </Link>
          )}
        </div>
      </div>
    </form>
  )
}
