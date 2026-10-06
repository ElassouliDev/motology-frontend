export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading car">
      <div className="skeleton h-4 w-20" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="skeleton aspect-[16/10] rounded-[1.25rem]" />
        <div className="card space-y-4 p-6">
          <div className="skeleton h-7 w-3/4" />
          <div className="skeleton h-4 w-1/3" />
          <div className="skeleton h-10 w-1/2" />
          <div className="skeleton h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
