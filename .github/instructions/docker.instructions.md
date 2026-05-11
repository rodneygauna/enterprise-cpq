---
applyTo: "{docker-compose*.yml,Caddyfile,.env,.env.example,Makefile}"
description: "Use when editing Docker Compose files, Caddyfile, .env files, or the Makefile. Covers service definitions, dev vs prod differences, environment variable documentation, and Makefile targets."
---

# Docker & Infrastructure Conventions

## Services

Three services defined in `docker-compose.yml`:

| Service   | Image                           | Purpose                                              |
| --------- | ------------------------------- | ---------------------------------------------------- |
| `mongodb` | `mongo:7`                       | Database                                             |
| `api`     | Built from `backend/Dockerfile` | Express.js API                                       |
| `web`     | `caddy:2-alpine`                | Reverse proxy + static file server + automatic HTTPS |

```yaml
# docker-compose.yml (production)
services:
  mongodb:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASS}

  api:
    build: ./backend
    restart: unless-stopped
    depends_on: [mongodb]
    env_file: .env
    expose:
      - "3001"

  web:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on: [api]
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./frontend/dist:/srv
      - caddy_data:/data
      - caddy_config:/config

volumes:
  mongo_data:
  caddy_data:
  caddy_config:
```

---

## Dev Override (`docker-compose.dev.yml`)

- Mounts source directories as volumes for hot-reload
- Exposes ports directly (no Caddy in dev — Vite dev server proxies `/api`)
- Uses `nodemon` for backend hot-reload

```yaml
# docker-compose.dev.yml
services:
  api:
    volumes:
      - ./backend:/app
      - /app/node_modules
    ports:
      - "3001:3001"
    command: npx nodemon src/server.js

  frontend:
    build: ./frontend
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "5173:5173"
    command: npm run dev
```

Run dev with: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up`
Or simply: `make dev`

---

## Caddyfile

```
{$DOMAIN} {
    encode gzip

    handle /api/* {
        reverse_proxy api:3001
    }

    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }
}
```

- `{$DOMAIN}` is read from the `DOMAIN` environment variable
- Caddy provisions Let's Encrypt SSL automatically when `DOMAIN` is a real public domain
- The `/api/*` block routes to the Express service; all other requests serve the React SPA with HTML5 history fallback

---

## `.env.example`

Every variable must be documented. New variables must be added to `.env.example` before they are used in code:

```env
# Application
NODE_ENV=production
PORT=3001
DOMAIN=cpq.yourcompany.com

# Database
MONGO_URI=mongodb://mongo_user:mongo_pass@mongodb:27017/enterprise_cpq?authSource=admin
MONGO_USER=mongo_user
MONGO_PASS=mongo_pass

# JWT (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=change_me_to_a_random_64_char_string
JWT_REFRESH_SECRET=change_me_to_a_different_random_64_char_string

# Salesforce OAuth (Phase 3 — leave blank to disable SF login)
SF_CONSUMER_KEY=
SF_CONSUMER_SECRET=
SF_INSTANCE_URL=https://login.salesforce.com
SF_CALLBACK_URL=https://cpq.yourcompany.com/api/auth/salesforce/callback

# SMTP (for password reset emails)
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourcompany.com
```

---

## Makefile Targets

```makefile
dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

prod:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

seed:
	docker compose exec api node seeds/index.js

reset:
	@read -p "Reset DB to seed data? This deletes all data. [y/N] " confirm && \
	[ "$$confirm" = "y" ] && docker compose exec api node seeds/reset.js

build:
	docker compose build
```

All targets should be PHONY:

```makefile
.PHONY: dev prod down logs seed reset build
```

---

## Rules

- **Never commit `.env`** — only `.env.example` is committed to the repo
- All secrets come from environment variables; never hardcode credentials in `docker-compose.yml` or source code
- `MONGO_URI` in the API container uses the service name `mongodb` as the hostname, not `localhost`
- The `api` service must wait for MongoDB to be healthy — use `depends_on` with a health check or add a connection retry loop in the app startup code
