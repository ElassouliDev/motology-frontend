import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { isMotologyApiError } from '@motology/api-client'
import type { ContactRequest } from '@motology/types'
import { ConfirmContactForm } from '@/components/contact/ConfirmContactForm'
import { ContactVehicleSummary } from '@/components/contact/ContactVehicleSummary'
import { buttonClass } from '@/components/ui/Button'
import { Icon, type IconName } from '@/components/ui/Icon'
import { isValidContactRequestId } from '@/lib/contact'
import { toPublicError } from '@/lib/server/errors'
import { gatewayRequestOptions, getMotologyClient } from '@/lib/server/motology'

// Personal links: never index them.
export const metadata: Metadata = {
  title: 'Confirm dealer contact',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ id: string }>
}

type ContactRequestResult =
  | { status: 'ok'; request: ContactRequest }
  | { status: 'error'; message: string }

async function loadContactRequest(id: string): Promise<ContactRequestResult | null> {
  try {
    return {
      status: 'ok',
      request: await getMotologyClient().getContactRequest(id, await gatewayRequestOptions()),
    }
  } catch (err) {
    if (isMotologyApiError(err) && err.code === 'http' && err.status === 404) return null
    return { status: 'error', message: toPublicError(err, 'confirm page').message }
  }
}

const ASSURANCES: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'Nothing is shared with the dealership until you confirm.' },
  { icon: 'message', text: 'You agree to texts and emails about this car only, not marketing or phone calls.' },
  { icon: 'check', text: 'Reply STOP to a text at any time to opt out.' },
]

export default async function ConfirmContactPage({ params }: Props) {
  const { id } = await params
  if (!isValidContactRequestId(id)) notFound()

  const result = await loadContactRequest(id)
  if (!result) notFound()

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      {result.status === 'error' ? (
        <StatusMessage icon="alert" tone="bad" title="We couldn't load this request">
          {result.message}
        </StatusMessage>
      ) : (
        <ContactRequestView id={id} request={result.request} />
      )}
    </div>
  )
}

function ContactRequestView({ id, request }: { id: string; request: ContactRequest }) {
  if (request.status === 'expired') {
    return (
      <StatusMessage icon="clock" tone="neutral" title="This link has expired">
        For your security, confirmation links only work for 48 hours. Ask your assistant to start again and it will
        send you a new link.
      </StatusMessage>
    )
  }

  if (request.status === 'confirmed') {
    return (
      <StatusMessage icon="check-circle" tone="ok" title="You're all set">
        This request is already confirmed. The dealership will reach out using the details you shared.
      </StatusMessage>
    )
  }

  // `agent_name` and `buyer_note` come from an outside agent: rendered as
  // React text nodes only (escaped), never as HTML.
  return (
    <div className="space-y-6">
      <div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
          <Icon name="shield" size={22} />
        </span>
        <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight">Have the dealership contact you?</h1>
        {request.agent_name && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-sm text-muted">
            <Icon name="user" size={15} />
            Requested by <span className="font-medium text-ink">{request.agent_name}</span> on your behalf
          </p>
        )}
      </div>

      <ul className="space-y-2.5">
        {ASSURANCES.map(a => (
          <li key={a.text} className="flex items-start gap-3 text-sm text-muted">
            <Icon name={a.icon} size={16} className="mt-0.5 shrink-0 text-brand" />
            {a.text}
          </li>
        ))}
      </ul>

      {request.vehicle && <ContactVehicleSummary vehicle={request.vehicle} />}

      {request.buyer_note && (
        <section className="rounded-card border border-border p-4">
          <h2 className="text-[13px] text-muted">What you&apos;re looking for</h2>
          <p className="mt-1 whitespace-pre-wrap break-words text-[15px] text-ink">{request.buyer_note}</p>
        </section>
      )}

      <ConfirmContactForm requestId={id} consentText={request.consent_text} />
    </div>
  )
}

const TONES = {
  ok: 'bg-ok/10 text-ok',
  bad: 'bg-bad/10 text-bad',
  neutral: 'bg-surface-2 text-muted',
} as const

function StatusMessage({
  icon,
  tone,
  title,
  children,
}: {
  icon: IconName
  tone: keyof typeof TONES
  title: string
  children: ReactNode
}) {
  return (
    <div role={tone === 'bad' ? 'alert' : undefined} className="card flex flex-col items-center px-6 py-12 text-center">
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon name={icon} size={22} />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-sm text-muted">{children}</p>
      <Link href="/" className={buttonClass({ variant: 'secondary' }, 'mt-7')}>
        Go to Motology
      </Link>
    </div>
  )
}
