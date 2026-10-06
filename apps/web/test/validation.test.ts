import { describe, expect, it } from 'vitest'
import { isValidConversationId } from '@/lib/session'
import { isValidStockNumber, parseSearchParams } from '@/lib/validation'

describe('parseSearchParams', () => {
  it('maps valid filters to gateway params', () => {
    const { params, hasFilters, invalid } = parseSearchParams({
      make: ' Toyota ',
      model: 'RAV4',
      max_price: '40000',
      year_min: '2020',
      q: 'hybrid',
    })
    expect(params).toEqual({ make: 'Toyota', model: 'RAV4', max_price: 40000, year_min: 2020, q: 'hybrid' })
    expect(hasFilters).toBe(true)
    expect(invalid).toEqual([])
  })

  it('drops and reports invalid numeric filters', () => {
    const { params, invalid, form } = parseSearchParams({ max_price: '-5', year_min: '20x0' })
    expect(params).toEqual({})
    expect(invalid).toEqual(['max_price', 'year_min'])
    expect(form.max_price).toBe('-5')
  })

  it('rejects out-of-range years and prices', () => {
    expect(parseSearchParams({ year_min: '1800' }).invalid).toEqual(['year_min'])
    expect(parseSearchParams({ max_price: '99999999999' }).invalid).toEqual(['max_price'])
  })

  it('uses the first value of repeated params and caps text length', () => {
    const { params } = parseSearchParams({ make: ['Honda', 'Ford'], q: 'x'.repeat(500) })
    expect(params.make).toBe('Honda')
    expect(params.q).toHaveLength(60)
  })

  it('treats empty params as no filters', () => {
    expect(parseSearchParams({}).hasFilters).toBe(false)
  })
})

describe('identifier validation', () => {
  it.each(['A100', 'stk-12.3_b', 'Z'])('accepts stock number %s', v => {
    expect(isValidStockNumber(v)).toBe(true)
  })

  it.each(['', '../x', 'a b', '-lead', 'x'.repeat(65)])('rejects stock number %j', v => {
    expect(isValidStockNumber(v)).toBe(false)
  })

  it('validates conversation ids', () => {
    expect(isValidConversationId('3f2b9c4e0d6a4b1c8e7f5a2d1c0b9e8f')).toBe(true)
    expect(isValidConversationId('6f1c2a7e-1b2c-4d3e-9f8a-7b6c5d4e3f2a')).toBe(true)
    expect(isValidConversationId('../etc/passwd')).toBe(false)
    expect(isValidConversationId(undefined)).toBe(false)
  })
})
