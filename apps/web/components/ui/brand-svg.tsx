import { SYMBOL, WORDMARK } from './logo-paths'

/** Brand art for image routes (next/og), which cannot read CSS variables. */
export function SymbolSvg({ size, tile = '#0A5C36', radius = 250 }: { size: number; tile?: string; radius?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1000 1000">
      <rect width="1000" height="1000" rx={radius} fill={tile} />
      <path d={SYMBOL.d} fill="#fff" />
      <circle cx={SYMBOL.dot.cx} cy={SYMBOL.dot.cy} r={SYMBOL.dot.r} fill="#C8F169" />
    </svg>
  )
}

export function WordmarkSvg({ height, color = '#111412', rim = '#0A5C36' }: { height: number; color?: string; rim?: string }) {
  const { dot } = WORDMARK
  return (
    <svg height={height} width={(height * WORDMARK.width) / WORDMARK.height} viewBox={WORDMARK.viewBox}>
      <path d={WORDMARK.d} fill={color} />
      <circle cx={dot.cx} cy={dot.cy} r={dot.r} fill={rim} />
      <circle cx={dot.cx} cy={dot.cy} r={dot.r * 0.84} fill="#C8F169" />
    </svg>
  )
}
