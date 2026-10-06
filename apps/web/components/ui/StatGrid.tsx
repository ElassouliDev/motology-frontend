import { cn } from '@/lib/utils'

export interface Stat {
  label: string
  value: string
  mono?: boolean
}

export function StatGrid({ stats, columns = 2 }: { stats: Stat[]; columns?: 2 | 3 }) {
  if (stats.length === 0) return null
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-xl border border-border bg-border',
        columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2',
      )}
    >
      {stats.map((s, i) => (
        <div
          key={`${i}:${s.label}`}
          className={cn(
            'bg-surface px-3.5 py-2.5',
            // An odd last cell spans the row instead of leaving a grey gap.
            columns === 2 && i === stats.length - 1 && stats.length % 2 === 1 && 'col-span-2',
          )}
        >
          <dt className="text-[11px] font-medium text-muted">{s.label}</dt>
          <dd
            className={cn(
              'tabular mt-0.5 font-semibold text-ink',
              s.mono ? 'break-all font-mono text-[13px] leading-6' : 'break-words text-[15px]',
            )}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
