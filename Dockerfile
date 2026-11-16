# Trajectory API in one container.
#
#   docker build -t trajectory .
#   docker run -p 4700:4700 -v trajectory-data:/data \
#     -e TRAJECTORY_BASE_DOMAIN=trajectory.example trajectory
#
# The SQLite file lives at /data/trajectory.db. Mount a volume or a host folder
# at /data so the data outlives the container. Migrations run each time the
# container starts, before the server takes requests. They are safe to run again.
#
# The base image is pinned by version and digest. A floating tag changes what
# ships with no change to the code, so move the pin on purpose, in a commit.
ARG NODE_IMAGE=node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee

# ---------------------------------------------------------------------------
# Build: install every dependency and compile the app.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build

# better-sqlite3 is a native module. It uses a prebuilt binary when one exists
# for this platform, and compiles from source when not. The compiler is here
# for that case only, and stays out of the final image.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10.30.0

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
# Run: the built app, its dependencies, and the migrations.
#
# Development dependencies stay in, because the migration step runs through
# tsx. The image is a little larger, and there is only one way to migrate.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS run

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    TRAJECTORY_DB=/data/trajectory.db

WORKDIR /app
COPY --from=build --chown=node:node /app /app

RUN mkdir -p /data && chown node:node /data
USER node

EXPOSE 4700

# Any answer below 500 means the server is up. The check route needs no token.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4700/v1/spaces/check?domain=health').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node_modules/.bin/tsx scripts/migrate.ts && exec node_modules/.bin/next start -H 0.0.0.0 -p 4700"]
