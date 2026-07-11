# syntax=docker/dockerfile:1

# Multi-stage: the runtime image carries Chromium and the standalone server only —
# no source, no dev dependencies, no bundled Chromium download.

# ---------- deps ----------
FROM node:20-slim AS deps
WORKDIR /app

# Puppeteer downloads its own ~300MB Chromium on install. We use the distro's
# instead, so skip it in every stage that runs npm.
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json ./
RUN npm ci

# ---------- build ----------
FROM node:20-slim AS builder
WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ---------- runtime ----------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
# Chromium's own sandbox needs kernel privileges the container does not grant.
# Dropping it is only acceptable because the container is itself the boundary and
# the process runs unprivileged (§6 Security).
ENV PUPPETEER_NO_SANDBOX=true
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# chromium: the headless browser Puppeteer drives.
# fonts-liberation + fonts-dejavu-core: Helvetica/Arial metric-compatible faces,
#   without which the PDF falls back to a single ugly bitmap font.
# ca-certificates: TLS for remote <img> in the user's Markdown.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-liberation \
      fonts-dejavu-core \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# output: "standalone" emits a minimal server plus only the node_modules it traced.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# `node` (uid 1000) ships with the base image; never run Chromium as root.
USER node

EXPOSE 3000

# Chromium writes its profile and shared-memory files under the home directory.
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

CMD ["node", "server.js"]
