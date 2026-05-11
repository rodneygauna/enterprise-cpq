# ── Development stage ────────────────────────────────────────────────────────
FROM node:lts-alpine AS dev
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npx", "nodemon", "src/server.js"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:lts-alpine AS production
WORKDIR /app

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY seeds ./seeds

# Run as non-root user for security (OWASP A05)
RUN addgroup -S cpq && adduser -S cpq -G cpq
USER cpq

EXPOSE 3001
CMD ["node", "src/server.js"]
