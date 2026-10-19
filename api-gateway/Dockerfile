# Production image for the NestJS API Gateway.
#
# Multi-stage: the builder installs every dependency (including dev dependencies, which
# `tsc` needs) and compiles TypeScript; the runtime stage then carries only the compiled
# output and production dependencies, so the shipped image does not contain tooling that a
# deployed container has no reason to hold.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first so Docker can cache the dependency layer across source-only changes.
COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

# Docker CLI is needed because the gateway talks to the Docker daemon to run the grading
# sandbox. Without it the sandbox silently degrades to static analysis — which would look
# like a working deployment while actually never executing a student's program.
RUN apk add --no-cache docker-cli

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Uploaded archives are written here; mount a volume to persist them across restarts.
RUN mkdir -p /app/uploads/submissions /app/data

EXPOSE 3000

# The gateway's tsconfig sets `rootDir: ./src`, so the compiled entry point is dist/main.js.
# (Verified by compiling: main.js lands at the dist root, not under dist/src/.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/submissions/stats',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
