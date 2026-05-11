# ── Development stage ────────────────────────────────────────────────────────
FROM node:lts-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:lts-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production stage (static files only — served by Caddy) ───────────────────
# The built output is copied out by the web (Caddy) service via a volume mount.
# This stage exists only to produce the /app/dist artifact.
FROM build AS production
