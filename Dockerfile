# syntax=docker/dockerfile:1
# Production image for the Motology web app (Next.js standalone output).
# Build from the motology/ directory:  docker build -t motology-web .

ARG NODE_IMAGE=node:22-alpine

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/types/package.json packages/types/
RUN npm ci --no-audit --no-fund

# ── Build ─────────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
# NEXT_PUBLIC_* are inlined into the bundle by `next build`: pass them as build
# args. Empty legal URLs hide the footer and consent-form links.
ARG NEXT_PUBLIC_APP_URL=https://motology.ai
ARG NEXT_PUBLIC_PRIVACY_URL=
ARG NEXT_PUBLIC_TERMS_URL=
ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_PRIVACY_URL=${NEXT_PUBLIC_PRIVACY_URL} \
    NEXT_PUBLIC_TERMS_URL=${NEXT_PUBLIC_TERMS_URL}
COPY --from=deps /app ./
COPY . .
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

# The standalone bundle contains server.js plus only the traced node_modules.
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

# MOTOLOGY_GATEWAY_URL and MOTOLOGY_API_KEY must be provided at runtime.
CMD ["node", "apps/web/server.js"]
