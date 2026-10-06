import Link from 'next/link'
import type { Vehicle } from '@motology/types'
import { Icon } from '@/components/ui/Icon'
import { EMPTY, formatCurrency, formatMileage, humanize, vehicleTitle } from '@/lib/format'
import { VehicleImage } from './VehicleImage'

interface Props {
  vehicle: Vehicle
  priority?: boolean
}

export function VehicleCard({ vehicle: v, priority = false }: Props) {
  const title = vehicleTitle(v)
  const details = [
    v.mileage !== null ? formatMileage(v.mileage) : null,
    v.condition ? humanize(v.condition) : null,
    v.exterior_color ? humanize(v.exterior_color) : null,
  ].filter((d): d is string => Boolean(d) && d !== EMPTY)

  return (
    <Link
      href={`/vehicle/${encodeURIComponent(v.stock_number)}`}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift"
    >
      <VehicleImage
        src={v.image_url}
        alt={title}
        className="aspect-[4/3]"
        imageClassName="transition-transform duration-500 group-hover:scale-[1.03]"
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
      />
      <div className="flex flex-1 flex-col p-4">
        <p className="font-semibold leading-snug text-ink">{title}</p>
        <p className="mt-0.5 min-h-[1.25rem] truncate text-sm text-muted">{v.trim || ' '}</p>
        {details.length > 0 && <p className="mt-2 text-[13px] text-muted">{details.join(' · ')}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-4">
          <div>
            <p className="text-[11px] text-muted">Dealer asking</p>
            <p className="tabular text-xl font-semibold tracking-tight">{formatCurrency(v.price)}</p>
          </div>
          <span className="inline-flex items-center gap-1 text-[13px] font-medium text-brand opacity-80 transition group-hover:opacity-100">
            Check price <Icon name="arrow-right" size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}

export function VehicleCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <div className="skeleton aspect-[4/3] rounded-none" />
      <div className="space-y-2.5 p-4">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3.5 w-1/3" />
        <div className="skeleton mt-5 h-6 w-1/2" />
      </div>
    </div>
  )
}
