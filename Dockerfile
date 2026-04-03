# ── Dockerfile (root) — frontend ──────────────────────────────────────────────
# Multi-stage build:
#   Stage 1 (builder) — Node 20 installs dependencies and runs `vite build`.
#   Stage 2 (server)  — nginx:alpine serves the compiled dist/ directory.
#
# Runtime configuration
# ─────────────────────
# The backend API URL is injected into every HTML response at container startup
# via nginx's envsubst template processing and the sub_filter directive in
# nginx/default.conf.template.  Set the CHUNKS_BACKEND_URL environment variable
# to the URL your browser uses to reach the API:
#
#   docker run -p 80:80 -e CHUNKS_BACKEND_URL=http://localhost:5000 chunks-frontend
#
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better layer caching (only re-runs when
# package*.json changes, not on every source change).
COPY package*.json ./
RUN npm ci --silent

# Copy the rest of the source and build
COPY . .
RUN npm run build


# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove the default nginx site so our template is the only one.
RUN rm /etc/nginx/conf.d/default.conf

# nginx processes every *.template file in /etc/nginx/templates/ via envsubst
# and writes the result to /etc/nginx/conf.d/ before starting.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Copy the compiled SPA
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Default backend URL — override at runtime for your deployment environment.
# In docker-compose this is set to http://localhost:5000 so a locally-running
# api container is reachable from the browser on the Docker host.
ENV CHUNKS_BACKEND_URL=http://localhost:5000
