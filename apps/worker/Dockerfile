# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS base

RUN apt-get update \
  && apt-get install -y --no-install-recommends wget git ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# =========================================================================== #

FROM base AS installer

# Use `npm view vite-plus version` to get the latest version of vite-plus for reproducible builds
# FIXME: Use the documented manual method when it's available
# @see {@link https://github.com/voidzero-dev/vite-plus/issues/896}
ARG VITE_PLUS_VERSION=0.2.4
RUN npm pack "@voidzero-dev/vite-plus-cli-linux-x64-gnu@${VITE_PLUS_VERSION}" \
        --pack-destination /tmp && \
    mkdir -p /root/.vite-plus/bin && \
    tar xzf /tmp/voidzero-dev-vite-plus-cli-linux-x64-gnu-*.tgz -C /root/.vite-plus/bin \
        --strip-components=1 package/vp && \
    chmod +x /root/.vite-plus/bin/vp
ENV PATH="/root/.vite-plus/bin:$PATH"

# This layer only invalidates when dependencies change, not on source changes.
# --parents preserves directory structure, picking up all workspace packages automatically.
COPY --parents **/package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN vp install --frozen-lockfile --ignore-scripts

# =========================================================================== #

FROM installer AS builder

COPY . .

ARG SOURCE_COMMIT VITE_SERVER_URL VITE_WEB_URL MEDIA_PUBLIC_BASE_URL
ENV NODE_ENV=production \
    IS_BUILD=true \
    SOURCE_COMMIT=${SOURCE_COMMIT} \
    VITE_SERVER_URL=${VITE_SERVER_URL} \
    VITE_WEB_URL=${VITE_WEB_URL} \
    MEDIA_PUBLIC_BASE_URL=${MEDIA_PUBLIC_BASE_URL:-http://localhost:5000/server/media}

RUN cp packages/env/.env.example packages/env/.env

RUN vp run -v --filter worker build

# =========================================================================== #

FROM installer AS dev

COPY . .

RUN npm install -g tsx@4.22.4

RUN addgroup --gid 1001 nodejs \
    && adduser --uid 1001 --ingroup nodejs --disabled-password --gecos "" worker

USER worker
WORKDIR /app

ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=45s \
  CMD wget -qO- http://127.0.0.1:9100/health/ready || exit 1

EXPOSE 9100

CMD ["tsx", "apps/worker/src/index.ts"]

# =========================================================================== #

FROM base AS production

RUN addgroup --gid 1001 nodejs \
    && adduser --uid 1001 --ingroup nodejs --disabled-password --gecos "" worker

COPY --from=builder --chown=worker:nodejs /app/apps/worker/.output /app/.output

USER worker
WORKDIR /app

ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=45s \
  CMD wget -qO- http://127.0.0.1:9100/health/ready || exit 1

EXPOSE 9100

CMD ["node", "/app/.output/index.mjs"]
