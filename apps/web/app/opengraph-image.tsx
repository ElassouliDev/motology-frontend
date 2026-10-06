import { ImageResponse } from 'next/og'
import { WordmarkSvg } from '@/components/ui/brand-svg'

export const alt = 'Motology: know what to pay before you talk to a dealer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Link preview card. Built at build time; uses the default font, so no network. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#FAFAF7',
          color: '#111412',
        }}
      >
        <WordmarkSvg height={64} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2 }}>
            <span>Know what to pay</span>
            <span style={{ display: 'flex' }}>
              <span style={{ background: '#C8F169', padding: '0 12px', marginLeft: -12 }}>before you talk to a dealer.</span>
            </span>
          </div>
          <div style={{ fontSize: 32, color: '#58605C' }}>
            Market value, what to offer and when to walk away.
          </div>
        </div>
      </div>
    ),
    size,
  )
}
