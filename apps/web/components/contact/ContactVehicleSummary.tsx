import type { ContactRequestVehicle } from '@motology/types'
import { VehicleImage } from '@/components/vehicle/VehicleImage'
import { formatCurrency, vehicleTitle } from '@/lib/format'

interface Props {
  vehicle: ContactRequestVehicle
}

/**
 * Read-only vehicle summary in the VehicleCard style. Not a link: the buyer
 * should stay on the confirmation page.
 */
export function ContactVehicleSummary({ vehicle: v }: Props) {
  const title = vehicleTitle(v)
  return (
    <div className="card flex overflow-hidden">
      <VehicleImage src={v.image_url} alt={title} className="w-32 shrink-0 sm:w-44" sizes="176px" />
      <div className="min-w-0 p-4">
        <p className="font-semibold text-ink">{title}</p>
        {v.trim && <p className="mt-0.5 text-sm text-muted">{v.trim}</p>}
        <p className="tabular mt-2 text-xl font-semibold tracking-tight">{formatCurrency(v.price)}</p>
        {v.stock_number && <p className="mt-1 text-xs text-muted">Stock #{v.stock_number}</p>}
      </div>
    </div>
  )
}
