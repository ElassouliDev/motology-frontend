import type { OutTheDoor } from '@motology/types'
import { formatCurrency, hasValue } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Props {
  estimate: OutTheDoor
  className?: string
}

/** The total the buyer would pay, with every line it is built from. */
export function OutTheDoorCard({ estimate, className }: Props) {
  const rows: [string, number][] = [
    [estimate.basis ? `Price (${estimate.basis})` : 'Price', estimate.price],
    ['Sales tax', estimate.sales_tax],
    ['Government fees', estimate.fees_total],
  ]
  const financed = estimate.amount_financed
  const showFinancing = hasValue(financed) && hasValue(estimate.est_monthly_payment) && financed > 0

  return (
    <section aria-label="Out-the-door estimate" className={cn('card p-4 sm:p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">Out the door</h2>
        <span className="text-[13px] text-muted">ZIP {estimate.zip_code}</span>
      </div>
      <p className="tabular mt-1 text-2xl font-semibold tracking-tight">{formatCurrency(estimate.out_the_door)}</p>

      <dl className="mt-4 space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-muted">{label}</dt>
            <dd className="tabular font-medium">{formatCurrency(value)}</dd>
          </div>
        ))}
        {showFinancing && (
          <>
            <div className="flex justify-between gap-3 border-t border-border pt-2">
              <dt className="text-muted">Amount financed</dt>
              <dd className="tabular font-medium">{formatCurrency(financed)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">
                Est. payment{hasValue(estimate.months) ? `, ${estimate.months} mo` : ''}
                {hasValue(estimate.assumed_apr) ? ` at ~${estimate.assumed_apr}%` : ''}
              </dt>
              <dd className="tabular font-medium">{formatCurrency(estimate.est_monthly_payment)}/mo</dd>
            </div>
          </>
        )}
      </dl>

      <p className="mt-4 text-[13px] text-muted">
        Tax and government fees for this ZIP. Dealer fees are not included: ask for them in writing. Your lender
        sets the actual rate.
      </p>
    </section>
  )
}
