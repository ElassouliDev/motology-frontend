# Motology.ai — Consumer Car Buying Platform

Standalone buyer-facing product. AutomotiveAI is the backbone.

## Architecture

```
Browser ──► Next.js (this app)                       ──► AutomotiveAI gateway
            pages + BFF route handlers (/api/*)          /api/motology/*
            server-side only: X-Motology-Key             pricing, negotiation,
                                                         agents, dealer CRM
```

All intelligence comes from the AutomotiveAI backend. This repo owns the UX only.

- **The browser never calls the gateway and never sees the API key.** Pages are
  server components that call the gateway through `@motology/api-client`; the
  chat UI posts to the app's own BFF route (`POST /api/chat`), which forwards
  the request server-side.
- Every gateway request carries `X-Motology-Key: $MOTOLOGY_API_KEY` and
  `X-Source: motology`. The backend uses `X-Source` to route to the
  `motology_chat` agent and apply the correct persona, handoff triggers and
  pricing-frame behaviour.
- Every gateway request also carries `X-Motology-Client-Ip` with the buyer's
  IP for per-buyer rate limiting. In production the edge proxy verifies the
  visitor's address (trusting only Cloudflare and the load balancer) and
  passes exactly that one address in `X-Forwarded-For`, stripping any
  client-sent `CF-Connecting-IP` / `X-Real-IP`. Elsewhere the order is
  `CF-Connecting-IP`, the first `X-Forwarded-For` entry, then `X-Real-IP`, so
  deploy behind a proxy that overwrites them. The value is omitted unless it
  is a valid IPv4/IPv6 literal.

## Key principle

**Never compute numbers here.** Every price, offer, counter and score comes
from the AutomotiveAI engine. The frontend validates, formats and renders
them; missing values render as "—" rather than being derived.

## Buyer accounts (deferred)

There are no buyer accounts yet. Sessions are anonymous: the BFF stores the
current gateway `conversation_id` in an `httpOnly`, `SameSite=Lax` cookie
(`motology_cid`, `Secure` in production, 30 days). The offer page
(`/offer/[conversation_id]`) is only viewable from the browser holding that
cookie; any other id returns 404. Login/signup will be added once a buyer
user store exists.

## Agent-initiated dealer contact

Outside AI agents (a person's own assistant) can ask Motology to have a
dealership contact their human. Nothing reaches the dealer until the human
confirms:

1. The agent creates a contact request at the AutomotiveAI gateway and
   receives a personal link, `https://motology.ai/confirm/<id>`
   (`id` matches `^[A-Za-z0-9_-]{16,64}$`).
2. The agent gives the link to its human, who opens it. The page
   (`/confirm/[id]`, a server component) loads the request via
   `GET /api/motology/contact-requests/{id}` and shows the vehicle, who
   requested it ("Requested by <agent> on your behalf") and the agent's note
   (untrusted text, rendered as plain text only).
3. The buyer enters first and last name plus a phone number (common US
   formats, normalised to `+1XXXXXXXXXX`) and/or an email, and ticks the
   consent checkbox. The checkbox is never pre-ticked, the gateway's
   `consent_text` is shown verbatim next to it, and submit stays disabled
   until it is ticked.
4. The form posts to the BFF (`POST /api/contact-requests/[id]/confirm`),
   which re-validates everything (including `consent === true`) and forwards
   to `POST /api/motology/contact-requests/{id}/confirm`. Only then is a lead
   created at the dealer.

Expired requests show "ask your assistant to start again"; confirmed requests
show "You're all set"; unknown ids render the 404 page. Confirmation pages are
`noindex, nofollow`.

## Setup

Requires Node.js 22.12+.

```bash
cp apps/web/.env.example apps/web/.env.local   # then set the values
npm install
npm run dev                                     # http://localhost:3000
```

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `npm run dev`        | Next.js dev server                                    |
| `npm run build`      | Production build (standalone output)                  |
| `npm start`          | `next start` against the build                        |
| `npm run type-check` | `tsc` across all workspaces (generates route types)   |
| `npm run lint`       | ESLint across all workspaces                          |
| `npm test`           | Vitest: api-client and BFF route tests                |

## Environment

Set in `apps/web/.env.local` (dev) or the container environment (prod).

| Variable               | Scope       | Description                                         |
| ---------------------- | ----------- | --------------------------------------------------- |
| `MOTOLOGY_GATEWAY_URL` | server only | AutomotiveAI gateway base URL, e.g. `http://gateway:8080` |
| `MOTOLOGY_API_KEY`     | server only | Secret sent as `X-Motology-Key`                     |
| `NEXT_PUBLIC_APP_URL`  | public      | This app's public URL (metadata / Open Graph)       |

The gateway variables are read at request time, so `npm run build` does not
need them. If they are missing at runtime, pages show a "temporarily
unavailable" message and `POST /api/chat` returns 503.

## Routes

| Route                | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| `/`                  | Landing page                                                       |
| `/chat`              | Chat with Motology. `?stock=<stock_number>` starts a conversation about that vehicle |
| `/search`            | Inventory search (make, model, max price, min year, keyword)      |
| `/vehicle/[stock]`   | Vehicle details + "Ask Motology about this car"                   |
| `/offer/[id]`        | Offer tracking for the session's conversation (current offer + pricing frame) |
| `/confirm/[id]`      | Buyer confirms an agent-initiated dealer contact request (noindex) |
| `POST /api/chat`     | BFF → gateway `POST /api/motology/chat`. Body: `{ message, zip_code?, stock_number?, new_conversation? }` |
| `DELETE /api/chat`   | Forget the current conversation (clears the cookie)                |
| `POST /api/contact-requests/[id]/confirm` | BFF → gateway `POST /api/motology/contact-requests/{id}/confirm`. JSON only, 4 KiB cap. Body: `{ first_name, last_name, phone?, email?, consent: true }` |
| `GET /api/health`    | Liveness probe (does not call the gateway)                         |

BFF errors are returned as `{ "error": "<safe message>" }`. Upstream status
codes are passed through (e.g. 404, 429, 502, 504), except gateway 401/403,
which indicate a server misconfiguration and surface as 502. A chat 429 (buyer
rate-limited) returns "You're sending messages too fast, try again in a
minute." Contact confirmation returns specific messages for 404 (unknown
request), 409 (already confirmed or expired), 422 and 429. Validation
failures return 400 with `{ "error", "field" }`. Upstream
`detail`, stack traces and configuration values are logged server-side only.

## Docker

```bash
docker build -t motology-web .
docker run -p 3000:3000 \
  -e MOTOLOGY_GATEWAY_URL=http://gateway:8080 \
  -e MOTOLOGY_API_KEY=... \
  motology-web
```

The image uses the Next.js standalone output on `node:22-alpine`, runs as a
non-root user and has a `HEALTHCHECK` on `/api/health`.

## Structure

```
apps/
  web/                      Next.js 15 app
    app/
      (buyer)/
        chat/               Primary interface
        search/             Inventory search
        vehicle/[id]/       Vehicle detail (id = stock number)
        offer/[id]/         Offer tracking (id = conversation id)
        confirm/[id]/       Dealer-contact confirmation (id = contact request id)
      api/
        chat/               BFF for the chat agent
        contact-requests/   BFF for contact-request confirmation
        health/             Liveness probe
    components/
      chat/                 ChatInterface, DecisionCard
      contact/              ConfirmContactForm, ContactVehicleSummary
      offer/                OfferCard, PricingFrameCard
      vehicle/              VehicleCard, VehicleImage
    lib/
      server/               Gateway client + error mapping (server-only)
      session.ts            Anonymous session cookie
      validation.ts         BFF / search input validation
      contact.ts            Contact confirmation validation (shared with the form)
      format.ts             Display formatting
    test/                   BFF route tests

packages/
  api-client/               MotologyApiClient: typed fetch wrapper for /api/motology/*
  types/                    Shared contract types (Vehicle, PricingFrame, ContactRequest, ...)
```
