# Enterprise CPQ — AI Agent Scaffold Guide

This guide explains how to use the GitHub Copilot agent scaffold in this repository to develop
Enterprise CPQ features faster, more consistently, and with fewer gaps.

---

## What This Scaffold Does

The scaffold gives the AI agent deep, persistent knowledge about this project so you don't have to
re-explain conventions, stack choices, or PRD requirements on every prompt.

It is organized into three types of files:

| Type                           | Location                                 | Purpose                                     |
| ------------------------------ | ---------------------------------------- | ------------------------------------------- |
| **Always-on instructions**     | `.github/copilot-instructions.md`        | Loaded automatically on every chat request  |
| **File-specific instructions** | `.github/instructions/*.instructions.md` | Auto-attached when you open a matching file |
| **Slash-command prompts**      | `.github/prompts/*.prompt.md`            | On-demand via `/` in the chat input         |

---

## Quick Start — Implementing a PRD Feature

The single most powerful thing in this scaffold is the `/implement-feature` prompt.

To implement an entire PRD section end-to-end:

1. Open GitHub Copilot chat (Ctrl+Shift+I / Cmd+Shift+I)
2. Type: `/implement-feature 7.1 Authentication`
3. The agent will:
   - Read the PRD section and summarize the requirements
   - **Ask you clarifying questions before writing any code**
   - Implement the backend (models, routes, middleware, validation)
   - Implement the frontend (pages, components, hooks, routing)
   - Write backend tests (Jest + Supertest + `mongodb-memory-server`)
   - Write frontend tests (Vitest + React Testing Library)
   - Create or update seed data
   - Audit all new frontend components for WCAG 2.1 AA compliance (and fix violations)
   - Run `npm test` in both layers and report results
   - List any requirements it deferred (nothing is silently skipped)

---

## How Automatic Context Works

### Always-On (loads on every chat request)

`copilot-instructions.md` is always in context. It tells the agent:

- The project overview, goals, and tech stack
- The monorepo structure
- Which phase is active (Phase 1 → 2 → 3)
- Build commands (`make dev`, `make seed`, etc.)
- Non-functional requirements (bcrypt ≥ 12, JWT cookies, OWASP Top 10, < 100ms recalc, WCAG 2.1 AA)

### Auto-Attached by File (loads when you open a matching file)

| File you open                                           | Instruction auto-attached          |
| ------------------------------------------------------- | ---------------------------------- |
| Any file under `backend/`                               | `backend.instructions.md`          |
| Any file under `backend/src/models/`                    | `mongoose-models.instructions.md`  |
| Any `*.test.js` file under `backend/`                   | `testing-backend.instructions.md`  |
| Any file under `frontend/`                              | `frontend.instructions.md`         |
| Any file under `frontend/`                              | `accessibility.instructions.md`    |
| Any `*.test.js` / `*.test.jsx` under `frontend/src/`    | `testing-frontend.instructions.md` |
| `docker-compose*.yml`, `Caddyfile`, `.env*`, `Makefile` | `docker.instructions.md`           |

### On-Demand (agent discovers when relevant)

`auth.instructions.md` is not tied to a specific file pattern. The agent loads it when you ask about
authentication, JWT, Passport.js, Salesforce OAuth, or password reset.

---

## Slash Command Reference

Type `/` in the Copilot chat input to see available prompts.

| Command                   | Argument                                        | What it does                                                                                                                         |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `/implement-feature`      | `7.1 Authentication`                            | Full end-to-end feature implementation from PRD                                                                                      |
| `/plan-feature`           | `bulk product import`                           | Plans a net-new feature not in the PRD: codebase research, developer interview, plan doc, PRD draft, handoff to `/implement-feature` |
| `/add-product`            | _(optional) product name_                       | Scaffolds Mongoose schema + Express CRUD routes + React admin form                                                                   |
| `/create-api-route`       | `quotes — GET list, POST create`                | Scaffolds an Express router file with auth, validation, response shape                                                               |
| `/create-mongoose-model`  | `Quote — clientName, termLength, status`        | Scaffolds a Mongoose schema from a field list                                                                                        |
| `/create-react-page`      | `ProductCatalog at /admin/products, admin only` | Scaffolds a React page with routing, layout, fetching, role guard                                                                    |
| `/create-tests`           | `backend/src/routes/products.js`                | Generates unit + integration tests for a route file or component                                                                     |
| `/audit-accessibility`    | `frontend/src/pages/QuoteBuilder.jsx`           | Audits a component for WCAG 2.1 AA, reports violations, applies fixes                                                                |
| `/salesforce-integration` | `opportunity pull`                              | Scaffolds a specific Salesforce integration feature (FR-SF-1 through FR-SF-5)                                                        |

---

## File Inventory

### Always-On Instructions

| File                      | What it covers                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| `copilot-instructions.md` | Project overview, tech stack, phase roadmap, build commands, NFRs |

### File-Specific Instructions (`.github/instructions/`)

| File                               | Triggers on                                 | What it covers                                                                                                 |
| ---------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `backend.instructions.md`          | `backend/**`                                | Express router pattern, middleware chain, response shape, input validation                                     |
| `mongoose-models.instructions.md`  | `backend/src/models/**`                     | PRD Section 8 schemas, all enums, timestamps, soft-delete, embed vs reference                                  |
| `frontend.instructions.md`         | `frontend/**`                               | React/Vite project structure, Bootstrap CSS vars, React Router v6, Axios, `useAuth`                            |
| `auth.instructions.md`             | On-demand                                   | Passport.js local + JWT, access/refresh cookies, Salesforce OAuth, password reset                              |
| `planning.instructions.md`         | On-demand                                   | Codebase research checklist, developer interview template, plan doc structure, PRD draft format, handoff rules |
| `docker.instructions.md`           | `docker-compose*.yml`, `Caddyfile`, `.env*` | Three services, dev vs prod, `.env.example`, Makefile targets                                                  |
| `testing-backend.instructions.md`  | `backend/**/*.test.js`                      | Jest + Supertest, `mongodb-memory-server`, test structure, what to test per route                              |
| `testing-frontend.instructions.md` | `frontend/src/**/*.test.*`                  | Vitest + RTL, mock Axios + `useAuth`, behavior assertions, no snapshots                                        |
| `accessibility.instructions.md`    | `frontend/**`                               | WCAG 2.1 AA rules: semantic HTML, labels, contrast, ARIA, focus, keyboard nav                                  |

### Prompts (`.github/prompts/`)

| File                               | Slash command             | What it does                                                                                |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------- |
| `implement-feature.prompt.md`      | `/implement-feature`      | Master workflow: PRD → backend → frontend → tests → seed → a11y audit → test run            |
| `plan-feature.prompt.md`           | `/plan-feature`           | Planning workflow: codebase research → developer interview → plan doc → PRD draft → handoff |
| `add-product.prompt.md`            | `/add-product`            | Full product scaffold: Mongoose schema, Express CRUD, React admin form                      |
| `create-api-route.prompt.md`       | `/create-api-route`       | Express router with middleware, validation, response shape                                  |
| `create-mongoose-model.prompt.md`  | `/create-mongoose-model`  | Mongoose schema from field list                                                             |
| `create-react-page.prompt.md`      | `/create-react-page`      | React page with routing, Bootstrap layout, fetching, role guard                             |
| `create-tests.prompt.md`           | `/create-tests`           | Unit + integration tests for a route file or component/hook                                 |
| `audit-accessibility.prompt.md`    | `/audit-accessibility`    | WCAG 2.1 AA audit of a component; fixes violations in-place                                 |
| `salesforce-integration.prompt.md` | `/salesforce-integration` | Phase 3: Salesforce OAuth, opportunity pull, quote writeback, pricebook sync                |

---

## Definition of Done

Every feature implemented via `/implement-feature` must satisfy all of these before it is considered complete:

- [ ] All FR-\* items in the PRD section are implemented **or** explicitly deferred with a reason
- [ ] All new API endpoints use the standard response shape `{ data, error, meta }`
- [ ] All new API endpoints apply the correct middleware chain: `authenticate → requireRole → validate → handler`
- [ ] All new UI uses Bootstrap CSS custom properties — no hardcoded hex colors
- [ ] All backend tests pass (`npm test` in `backend/`)
- [ ] All frontend tests pass (`npm test` in `frontend/`)
- [ ] All new React components pass the WCAG 2.1 AA checklist in `accessibility.instructions.md`
- [ ] `.env.example` is updated with any new environment variables
- [ ] Seed data in `backend/seeds/` covers any new MongoDB collections
- [ ] Seed data is generic — no real company names, logos, or pricing

---

## How to Extend This Scaffold

### Adding a new instruction file

1. Create `.github/instructions/<topic>.instructions.md`
2. Add YAML frontmatter with either `applyTo: "glob/pattern/**"` (file-based trigger) or
   `description: "Use when..."` (on-demand trigger) — pick one
3. Write concise, actionable rules with code examples
4. Add the file to the table in this guide

### Adding a new prompt

1. Create `.github/prompts/<task>.prompt.md`
2. Add YAML frontmatter: `description`, `argument-hint`, `agent: "agent"`
3. Write the prompt as a step-by-step task, referencing instruction files where relevant
4. Add the command to the Slash Command Reference table in this guide

### Updating enums when the PRD changes

The canonical enum arrays live in two places — keep them in sync:

- `backend/src/models/` — update the enum arrays in the relevant model file
- `.github/instructions/mongoose-models.instructions.md` — update the reference arrays in the "All PRD Enums" section

---

## The Source of Truth

**`docs/PRD.md` is always the source of truth** for feature requirements, data models, enums, and
non-functional requirements. When in doubt about a business rule, read the PRD — not this guide.
