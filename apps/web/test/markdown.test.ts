import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { Markdown, parseBlocks } from '@/lib/markdown'

const html = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }))

describe('parseBlocks', () => {
  it('splits paragraphs, bullet lists and numbered lists', () => {
    expect(parseBlocks('Hello\nthere\n\n- one\n- two\n\n1. first\n2) second')).toEqual([
      { kind: 'p', lines: ['Hello', 'there'] },
      { kind: 'ul', items: ['one', 'two'] },
      { kind: 'ol', items: ['first', 'second'] },
    ])
  })

  it('joins indented continuation lines onto the list item', () => {
    expect(parseBlocks('- open at $33,600\n  and hold firm')).toEqual([
      { kind: 'ul', items: ['open at $33,600 and hold firm'] },
    ])
  })

  it('treats headings as their own block', () => {
    expect(parseBlocks('## Verdict\nGood deal')).toEqual([
      { kind: 'h', text: 'Verdict' },
      { kind: 'p', lines: ['Good deal'] },
    ])
  })
})

describe('Markdown', () => {
  it('renders bold, italic and code', () => {
    expect(html('Offer **$33,600**, *not* `more`')).toContain(
      'Offer <strong class="font-semibold">$33,600</strong>, <em>not</em> <code',
    )
  })

  it('never turns model output into HTML', () => {
    const out = html('<img src=x onerror=alert(1)> **<script>alert(1)</script>**')
    expect(out).not.toContain('<img')
    expect(out).not.toContain('<script>')
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })

  it('leaves a lone asterisk or dollar amounts alone', () => {
    expect(html('5 * 3 costs $5')).toContain('5 * 3 costs $5')
  })
})
