import { describe, expect, it } from 'vitest'
import { safeImageUrl } from '@/lib/format'

describe('safeImageUrl', () => {
  it('keeps https URLs', () => {
    expect(safeImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
  })

  it.each(['http://cdn.example.com/a.jpg', 'javascript:alert(1)', 'data:image/png;base64,AAAA', 'not a url', '', null])(
    'drops %j',
    value => {
      expect(safeImageUrl(value)).toBeNull()
    },
  )
})
