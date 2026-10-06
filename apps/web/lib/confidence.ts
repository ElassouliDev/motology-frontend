import type { BadgeTone } from '@/components/ui/Badge'

/** Engine confidence tiers: 1 = strong local comparables, 2 = thin data, 3 = no reliable market price. */
export function confidenceTierLabel(tier: number | null | undefined): { label: string; tone: BadgeTone } | null {
  switch (tier) {
    case 1:
      return { label: 'Live market · high confidence', tone: 'ok' }
    case 2:
      return { label: 'Live market · limited data', tone: 'warn' }
    case 3:
      return { label: 'No reliable market data', tone: 'neutral' }
    default:
      return null
  }
}
