.PHONY: dev prod down logs seed reset build test

# ── Development ───────────────────────────────────────────────────────────────
# Starts the API (nodemon hot-reload), Vite frontend dev server, and MongoDB
# with ports exposed. Caddy is NOT used in dev.
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# ── Production ────────────────────────────────────────────────────────────────
# Builds the React SPA, starts all services (MongoDB, Express API, Caddy).
# Caddy provisions Let's Encrypt SSL automatically when DOMAIN is a public domain.
prod:
	docker compose up -d

# ── Stop all services ─────────────────────────────────────────────────────────
down:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile prod down --remove-orphans

# ── Tail logs ─────────────────────────────────────────────────────────────────
logs:
	docker compose logs -f

# ── Seed the database ─────────────────────────────────────────────────────────
# Requires the stack to be running (make dev or make prod).
seed:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api node seeds/index.js

# ── Reset database to seed data ───────────────────────────────────────────────
# Prompts for confirmation before wiping all data.
reset:
	@read -p "Reset DB to seed data? This deletes ALL data. [y/N] " confirm && \
	[ "$$confirm" = "y" ] && docker compose -f docker-compose.yml -f docker-compose.dev.yml exec api node seeds/reset.js || echo "Aborted."

# ── Rebuild Docker images ─────────────────────────────────────────────────────
build:
	docker compose build

# ── Run all tests (outside Docker — requires local node_modules) ──────────────
# Runs backend Jest suite then frontend Vitest suite.
test:
	cd backend && npm test
	cd frontend && npm test
