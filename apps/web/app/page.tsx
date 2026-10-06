import Link from 'next/link'
import { HeroDemo } from '@/components/home/HeroDemo'
import { StartComposer } from '@/components/home/StartComposer'
import { Icon, type IconName } from '@/components/ui/Icon'
import { Reveal } from '@/components/ui/Reveal'

const PROMPTS = [
  'Is this RAV4 fairly priced?',
  'Best family SUV under $40k',
  'Most fuel-efficient commuter',
  'Should I buy now or wait?',
]

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'message',
    title: 'Tell us what you want',
    body: 'Describe the car, your budget and how you will use it, or pick a car from the lot.',
  },
  {
    icon: 'chart',
    title: 'See what it is really worth',
    body: 'Market value from comparable listings near you, days on the lot, local supply, vehicle history and open recalls.',
  },
  {
    icon: 'tag',
    title: 'Negotiate with a plan',
    body: 'An opening offer, a good price and a walk-away number. Try an offer and see how the dealer is likely to respond.',
  },
  {
    icon: 'handshake',
    title: 'Talk to the dealer when you are ready',
    body: 'When you want to move forward, you choose how the dealership can reach you. Not before.',
  },
]

const PROMISES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'lock',
    title: 'Your targets stay private',
    body: 'Your opening offer and good price are never shared with the dealership.',
  },
  {
    icon: 'shield',
    title: 'No contact without your OK',
    body: 'A dealership only gets your details after you enter them and agree to be contacted.',
  },
  {
    icon: 'eye',
    title: 'Every number shows its source',
    body: 'Live market data is labelled. When data is missing, we say so instead of guessing.',
  },
  {
    icon: 'gauge',
    title: 'Your walk-away price, up front',
    body: 'You know the number to stop at before the conversation starts.',
  },
]

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-24 lg:pt-20">
          <div>
            <h1 className="animate-fade-up text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
              Know what to pay <span className="mark">before you talk to a dealer.</span>
            </h1>
            <p style={{ animationDelay: '90ms' }} className="mt-5 max-w-xl animate-fade-up text-pretty text-lg leading-relaxed text-muted">
              Motology checks any car on the lot against live market prices near you, then tells you what to offer,
              what a good price is and when to walk away.
            </p>

            <StartComposer className="mt-8 max-w-xl animate-fade-up [animation-delay:180ms]" />

            <div className="mt-4 flex max-w-xl animate-fade-up flex-wrap gap-2 [animation-delay:260ms]">
              {PROMPTS.map(p => (
                <Link
                  key={p}
                  href={`/chat?q=${encodeURIComponent(p)}`}
                  className="rounded-full border border-border bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-ink/20 hover:text-ink"
                >
                  {p}
                </Link>
              ))}
            </div>
          </div>

          <div className="animate-fade-up [animation-delay:200ms] lg:pl-6">
            <HeroDemo />
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-surface/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-3 text-lg text-muted">Four steps, from the first question to the dealership.</p>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Reveal delayMs={i * 90} className="card h-full p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon name={s.icon} />
                  </span>
                  <span className="tabular flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-fg">{i + 1}</span>
                </div>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-forest text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Built for the person <span className="text-accent">buying the car.</span>
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-white/70">
              You decide what to share, when to share it and with whom. Until you say otherwise, you are just a shopper doing research.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {PROMISES.map((p, i) => (
              <li key={p.title}>
                <Reveal delayMs={i * 90} className="h-full rounded-card border border-white/10 bg-white/[0.04] p-5">
                <Icon name={p.icon} className="text-accent" />
                <h3 className="mt-4 font-semibold">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/70">{p.body}</p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-accent px-6 py-12 text-accent-fg sm:px-12 sm:py-14">
          <div className="relative flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">
                Found a car you like? Check the price first.
              </h2>
              <p className="mt-2 text-accent-fg/75">No dealership hears from you until you say so.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/chat"
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-forest px-5 text-[15px] font-semibold text-white transition hover:opacity-90"
              >
                Get my price <Icon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/search"
                className="inline-flex h-12 items-center rounded-xl border border-accent-fg/30 px-5 text-[15px] font-semibold text-accent-fg transition hover:bg-accent-fg/5"
              >
                Browse cars
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
