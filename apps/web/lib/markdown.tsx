/**
 * A deliberately small Markdown subset for assistant replies: paragraphs,
 * bullet and numbered lists, **bold**, *italic* and `code`. Output is React
 * elements built from text nodes only, so model output can never inject HTML.
 */
import { Fragment, type ReactNode } from 'react'

type Block =
  | { kind: 'p'; lines: string[] }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'h'; text: string }

const BULLET_RE = /^\s*[-*•]\s+(.*)$/
const NUMBERED_RE = /^\s*\d{1,3}[.)]\s+(.*)$/
const HEADING_RE = /^\s*#{1,6}\s+(.*)$/
const INLINE_RE = /(\*\*[^*\n]+\*\*|__[^_\n]+__|`[^`\n]+`|\*[^*\s][^*\n]*\*)/g

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let current: Block | null = null
  const flush = () => {
    if (current) blocks.push(current)
    current = null
  }

  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') {
      flush()
      continue
    }
    const heading = HEADING_RE.exec(line)
    const bullet = BULLET_RE.exec(line)
    const numbered = NUMBERED_RE.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: 'h', text: heading[1] ?? '' })
    } else if (bullet) {
      if (current?.kind !== 'ul') {
        flush()
        current = { kind: 'ul', items: [] }
      }
      current.items.push(bullet[1] ?? '')
    } else if (numbered) {
      if (current?.kind !== 'ol') {
        flush()
        current = { kind: 'ol', items: [] }
      }
      current.items.push(numbered[1] ?? '')
    } else if ((current?.kind === 'ul' || current?.kind === 'ol') && /^\s{2,}\S/.test(line)) {
      // Indented continuation of the previous list item.
      const last = current.items.length - 1
      current.items[last] = `${current.items[last] ?? ''} ${line.trim()}`
    } else {
      if (current?.kind !== 'p') {
        flush()
        current = { kind: 'p', lines: [] }
      }
      current.lines.push(line.trim())
    }
  }
  flush()
  return blocks
}

export function renderInline(text: string): ReactNode[] {
  return text.split(INLINE_RE).map((part, i) => {
    if (!part) return null
    if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('__') && part.endsWith('__'))) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    return <Fragment key={i}>{part}</Fragment>
  })
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text)
  return (
    <div className="space-y-3">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'h':
            return (
              <p key={i} className="font-semibold">
                {renderInline(b.text)}
              </p>
            )
          case 'ul':
            return (
              <ul key={i} className="list-disc space-y-1 pl-5 marker:text-muted">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="list-decimal space-y-1 pl-5 marker:text-muted">
                {b.items.map((item, j) => (
                  <li key={j}>{renderInline(item)}</li>
                ))}
              </ol>
            )
          default:
            return (
              <p key={i}>
                {b.lines.map((line, j) => (
                  <Fragment key={j}>
                    {j > 0 && <br />}
                    {renderInline(line)}
                  </Fragment>
                ))}
              </p>
            )
        }
      })}
    </div>
  )
}
