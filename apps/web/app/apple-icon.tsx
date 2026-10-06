import { ImageResponse } from 'next/og'
import { SymbolSvg } from '@/components/ui/brand-svg'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/** iOS home-screen icon: iOS rounds the corners itself, so the tile fills the square. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <SymbolSvg size={180} radius={0} />
      </div>
    ),
    size,
  )
}
