import { VehicleCardSkeleton } from '@/components/vehicle/VehicleCard'

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Loading cars">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      <div className="skeleton mt-6 h-[88px] rounded-card" />
      <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i}>
            <VehicleCardSkeleton />
          </li>
        ))}
      </ul>
    </div>
  )
}
