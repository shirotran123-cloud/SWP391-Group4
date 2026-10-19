# Production image for the GenAI Hub (exam generation, semantic review, AST engine).
#
# The hub is the only service that talks to external LLM providers, so it is kept separate
# from the gateway: it can be scaled, rate-limited or replaced without touching grading.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

EXPOSE 3001

# The hub's tsconfig uses `rootDir: ./` and includes demo.ts and the tests, so `tsc` preserves
# the `src/` level and the compiled entry point is dist/src/server.js.
# (Verified by compiling: server.js lands under dist/src/, not at the dist root.)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/src/server.js"]
