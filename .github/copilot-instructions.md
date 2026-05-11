# Enterprise CPQ — Project Instructions

## Overview

Enterprise CPQ is an open-source, self-hosted **Configure, Price, Quote** platform for enterprise
healthcare SaaS companies. It supports complex product catalogs (PMPM, tiered, volume-band pricing),
multi-product bundles, discount governance workflows, margin scoring, Salesforce CRM integration,
and branded PDF proposal generation.

The canonical requirements document is [`docs/PRD.md`](../docs/PRD.md). Always consult it for
feature requirements, data models, enums, and non-functional requirements before implementing anything.

---

## Monorepo Structure

```
enterprise-cpq/
├── backend/                  # Express.js API (Node.js LTS)
│   ├── src/
│   │   ├── config/           # DB connection, passport strategies, env validation
│   │   ├── middleware/        # authenticate, requireRole, errorHandler
│   │   ├── models/           # Mongoose schemas (users, products, productLines, quotes, settings)
│   │   ├── routes/           # One router file per domain
│   │   ├── services/         # Business logic extracted from route handlers
│   │   └── utils/            # Pure helper functions (pricing calculations, etc.)
│   ├── seeds/                # Seed data scripts; generic, no company-specific data
│   └── tests/
│       └── helpers/          # Shared test utilities and db setup
├── frontend/                 # React SPA (Vite)
│   └── src/
│       ├── api/              # Axios instance + per-domain API modules
│       ├── components/       # Reusable UI components
│       ├── hooks/            # Custom React hooks (useAuth, useQuote, etc.)
│       ├── pages/            # One file per route/page
│       └── utils/            # Pure helpers (pricing calc, formatters)
├── docs/
│   └── PRD.md                # Source of truth for all requirements
├── .github/
│   ├── copilot-instructions.md   # This file
│   ├── COPILOT_GUIDE.md          # How to use the AI agent scaffold
│   ├── instructions/             # File-specific instruction files
│   └── prompts/                  # Reusable slash-command prompts
├── docker-compose.yml            # Production: mongodb + api + web (Caddy)
├── docker-compose.dev.yml        # Dev override: volume mounts, hot-reload
├── Caddyfile                     # Reverse proxy, automatic HTTPS
├── Makefile                      # make dev | prod | down | logs | seed | reset | build
└── .env.example                  # All required env vars documented
```

---

## Technology Stack

| Layer              | Technology                                               |
| ------------------ | -------------------------------------------------------- |
| Frontend framework | React (latest) + JavaScript                              |
| Frontend build     | Vite                                                     |
| Frontend routing   | React Router v6                                          |
| Frontend styling   | Bootstrap 5 (brand colors via CSS custom properties)     |
| PDF generation     | `@react-pdf/renderer`                                    |
| Charts             | Recharts                                                 |
| Excel I/O          | SheetJS (`xlsx`)                                         |
| HTTP client        | Axios                                                    |
| Backend runtime    | Node.js (LTS)                                            |
| Backend framework  | Express.js                                               |
| Authentication     | Passport.js + `passport-local` + `passport-jwt`          |
| Salesforce OAuth   | `passport-oauth2`                                        |
| Session tokens     | JWT — `httpOnly` cookies                                 |
| Password hashing   | bcrypt (min cost factor **12**)                          |
| Database           | MongoDB                                                  |
| ODM                | Mongoose                                                 |
| Containers         | Docker + Docker Compose                                  |
| Reverse proxy      | Caddy (prod, auto Let's Encrypt) / Vite dev server (dev) |

---

## Phase Roadmap

| Phase                            | Status     | Sections                                                                                                                  |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1 — Core CPQ Platform**  | **Active** | 7.1 Auth, 7.2 Branding, 7.3 Product Lines, 7.4 Product Catalog, 7.5 Quote Builder, 7.6 Quote History, 7.7 User Management |
| Phase 2 — Deal Governance        | Future     | 7.8 Discounting & Approval Workflows, 7.9 Margin Scoring                                                                  |
| Phase 3 — Salesforce & Proposals | Future     | 7.10 Salesforce Integration, 7.11 Proposal Generation                                                                     |

When implementing a feature, identify which phase it belongs to and note any cross-phase dependencies.

---

## Build & Run Commands

```bash
make dev        # Start dev environment (hot-reload, exposed ports)
make prod       # Start production environment
make down       # Stop all containers
make logs       # Tail all service logs
make seed       # Run seed scripts against the running DB
make reset      # Reset DB to seed data (requires confirmation)
make build      # Rebuild Docker images
```

---

## Non-Functional Requirements (always enforce)

| NFR                 | Rule                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Security**        | bcrypt cost ≥ 12; JWTs in `httpOnly` + `Secure` cookies; no secrets client-side; OWASP Top 10 compliance; validate all API inputs |
| **Performance**     | Quote builder recalculations < 100ms for catalogs up to 500 products                                                              |
| **Accessibility**   | WCAG 2.1 AA on all primary user flows (see `instructions/accessibility.instructions.md`)                                          |
| **Browser support** | Modern evergreen (Chrome, Firefox, Safari, Edge)                                                                                  |
| **Configuration**   | All env-specific values in `.env`; never hardcode secrets or URLs                                                                 |
| **Open source**     | MIT License; no company-specific data in seed files or defaults                                                                   |

---

## Key Conventions

- **Never hardcode brand colors** — use Bootstrap CSS custom properties (`--bs-primary`, `--bs-secondary`)
- **Standard API response shape:** `{ data: {...}, error: null, meta: { page, total } }`
- **Role hierarchy:** `super_admin > admin > executive > sales_manager > sales_rep`
- **Soft-delete users** via `isActive: false`; never hard-delete user records
- **Pricing calculations** must be pure functions in `backend/src/utils/pricing.js` and `frontend/src/utils/pricing.js` — no side effects, fully testable
- **Seed data** must be generic (no real company names, logos, or pricing) so the repo is safe to open-source
