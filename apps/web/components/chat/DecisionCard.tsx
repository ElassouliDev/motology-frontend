import type { PricingFrame, ScenarioSummary } from '@motology/types'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { formatCurrency, formatInteger, hasValue, humanize, statLabel } from '@/lib/format'
import { Markdown } from '@/lib/markdown'
import { cn } from '@/lib/utils'
import { StatGrid, type Stat } from '../ui/StatGrid'

interface Props {
  scenario: ScenarioSummary | null
  pricingFrame: PricingFrame | null
  dealScore: number | null
  /** Called with the primary action's label so it can be sent as the next message. */
  onAction?: (label: string) => void
  disabled?: boolean
}

function confidenceLabel(confidence: ScenarioSummary['confidence']): string | null {
  if (confidence === null || confidence === '') return null
  return typeof confidence === 'number' ? formatInteger(confidence) : humanize(confidence)
}

export function DecisionCard({ scenario, pricingFrame, dealScore, onAction, disabled }: Props) {
  if (!scenario && !pricingFrame) return null

  const source = scenario?.data_source?.toLowerCase() ?? null
  const isLive = source === 'live'
  const confidence = scenario ? confidenceLabel(scenario.confidence) : null

  const stats: Stat[] = scenario ? scenario.stats.map(s => ({ label: statLabel(s.key), value: s.value })) : []
  if (stats.length === 0 && pricingFrame) {
    stats.push(
      { label: 'Market value', value: formatCurrency(pricingFrame.market_price) },
      { label: 'Opening offer', value: formatCurrency(pricingFrame.open_offer) },
      { label: 'Good price', value: formatCurrency(pricingFrame.good_price) },
      { label: 'Walk-away', value: formatCurrency(pricingFrame.walk_away) },
    )
  }
  if (hasValue(dealScore)) stats.push({ label: 'Deal score', value: formatInteger(dealScore) })

  const action = scenario?.primary_action

  return (
    <section aria-label="Motology analysis" className="card animate-scale-in overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <Icon name="chart" size={15} className="text-brand" />
          {scenario ? humanize(scenario.scenario_id) : 'Pricing'}
        </span>
        {source && (
          <Badge tone={isLive ? 'ok' : 'neutral'} dot>
            {isLive ? 'Live market data' : 'Estimate'}
          </Badge>
        )}
      </div>

      {scenario?.recommendation && (
        <div className="px-4 pt-3.5 text-[15px] leading-relaxed text-ink">
          <Markdown text={scenario.recommendation} />
        </div>
      )}

      {stats.length > 0 && (
        <div className={cn('px-4', scenario?.recommendation ? 'pt-3.5' : 'pt-4')}>
          <StatGrid stats={stats} />
        </div>
      )}

      <div className="flex flex-col gap-3 px-4 pb-4 pt-3">
        {confidence && <p className="text-xs text-muted">Confidence: {confidence}</p>}
        {action && onAction && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onAction(action.label)}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-brand-fg transition hover:bg-brand-strong active:scale-[0.99] disabled:opacity-45"
          >
            {action.label}
            <Icon name="arrow-right" size={15} />
          </button>
        )}
      </div>
    </section>
  )
}
