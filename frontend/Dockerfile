# Production image for the React 19 + Vite frontend, served by nginx.
#
# Two stages: Vite compiles the bundle, then nginx serves the static files. Vite inlines
# `import.meta.env.VITE_*` at BUILD time, so the API URLs must be supplied as build arguments
# rather than runtime environment variables — a common source of "the deployed app calls
# localhost" bugs.

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# These must be build args, not runtime env: Vite bakes them into the bundle. The defaults
# keep `docker build .` working out of the box for a single-host deployment.
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_GENAI_HUB_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GENAI_HUB_URL=$VITE_GENAI_HUB_URL

COPY package*.json ./

# `--legacy-peer-deps` is required, not cosmetic. Resolving this dependency graph under npm 10
# crashes the arborist resolver with:
#     npm error Cannot read properties of null (reading 'edgesOut')
# which aborts the build outright. The flag uses the pre-npm-7 peer resolution, which installs
# the same tree successfully. This is an npm resolver defect, not a real incompatibility.
#
# The trade-off: this flag does NOT auto-install peer dependencies. `recharts` declares
# `react-is` as a peer, so it is listed explicitly in package.json — without it the bundle fails
# with `Rolldown failed to resolve import "react-is"`. On the host it only worked by accident,
# because npm had hoisted react-is for another package.
RUN npm install --no-audit --no-fund --legacy-peer-deps

COPY . .
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runtime

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
