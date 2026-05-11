# Enterprise CPQ — Product Requirements Document (PRD)

---

## 1. Executive Summary

Enterprise CPQ is an open-source, self-hosted **Configure, Price, Quote** platform built for enterprise
healthcare SaaS companies with complex product catalogs and multi-variable pricing models. It enables
Sales Representatives to build accurate, multi-product quotes with real-time financial calculations while
giving Sales Operations complete control over the product catalog, pricing rules, and system settings.

The platform is designed as a **white-label system** — any organization can configure their own company
name, logo, brand colors, and product catalog through an admin settings panel without touching source code.

---

## 2. Problem Statement

Enterprise healthcare sales teams manage pricing that is too complex for spreadsheets: tiered PMPM pricing,
multi-product bundles with parent/child dependencies, volume inheritance, multi-year contracts with annual
escalators, one-time implementation fees, and T&M services must all coexist in a single accurate quote.
Existing generic CPQ tools are expensive, require heavy customization, and don't model the healthcare payer
pricing patterns (PMPM, membership-based volume tiers) that this market requires.

This application closes that gap with a purpose-built, open-source tool that any team can deploy, brand,
and extend.

---

## 3. Goals

| #   | Goal                                                                                            |
| --- | ----------------------------------------------------------------------------------------------- |
| G1  | Provide a multi-user, role-based quoting platform with a proper backend and persistent database |
| G2  | Support native email/password login and Salesforce SSO out of the box                           |
| G3  | Model complex healthcare pricing: PMPM, tiered, flat, monthly fee, per-unit, hourly, multi-year |
| G4  | Enforce discount governance through configurable approval workflows                             |
| G5  | Surface real-time margin scoring with a configurable profitability scorecard                    |
| G6  | Integrate bidirectionally with Salesforce CRM (Opportunities, Pricebooks, Quote writeback)      |
| G7  | Generate polished, branded PDF proposals from finalized quotes                                  |
| G8  | Be deployable with a single `docker compose up` command                                         |

---

## 4. User Roles & Permissions

| Role                  | Key Permissions                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sales Rep**         | Create, edit, copy, delete own quotes; view product catalog (read-only); submit quotes for approval                                                                                     |
| **Sales Manager**     | All Sales Rep permissions; view all quotes for their team; approve or reject quotes in "Manager Review" status                                                                          |
| **Executive**         | All Sales Manager permissions; approve or reject quotes in "Executive Review" status; view all quotes across all teams                                                                  |
| **Sales Ops / Admin** | Full CRUD on products and product lines; manage company settings and branding; manage users and roles; view all quotes; import/export catalog; configure discount and margin thresholds |
| **Super Admin**       | All Admin permissions; configure OAuth and SMTP settings; reset seed data                                                                                                               |

---

## 5. Technology Stack

### Frontend

| Layer          | Technology                                                     |
| -------------- | -------------------------------------------------------------- |
| Framework      | React (latest) + JavaScript                                    |
| Build Tool     | Vite                                                           |
| Routing        | React Router (latest)                                          |
| Styling        | Bootstrap 5 (brand colors via Bootstrap CSS custom properties) |
| PDF Generation | `@react-pdf/renderer`                                          |
| Charts         | Recharts                                                       |
| Excel I/O      | SheetJS (`xlsx`)                                               |
| HTTP Client    | Axios                                                          |

### Backend

| Layer            | Technology                                      |
| ---------------- | ----------------------------------------------- |
| Runtime          | Node.js (LTS)                                   |
| Framework        | Express.js                                      |
| Authentication   | Passport.js + `passport-local` + `passport-jwt` |
| Salesforce OAuth | `passport-oauth2` (Salesforce-configured)       |
| Session Tokens   | JSON Web Tokens (JWT) — `httpOnly` cookies      |
| Password Hashing | bcrypt (min cost factor 12)                     |
| File Parsing     | SheetJS (`xlsx`)                                |

### Database

| Layer    | Technology |
| -------- | ---------- |
| Database | MongoDB    |
| ODM      | Mongoose   |

### Infrastructure

| Layer              | Technology                                                                   |
| ------------------ | ---------------------------------------------------------------------------- |
| Containers         | Docker + Docker Compose                                                      |
| Services           | `mongodb`, `api` (Express), `web` (Caddy)                                    |
| Dev Reverse Proxy  | Vite dev server (hot-reload, no SSL required)                                |
| Prod Reverse Proxy | Caddy (automatic Let's Encrypt SSL provisioning and renewal, HTTPS redirect) |
| Config             | `.env` file; `.env.example` template committed to repo                       |

---

## 6. System Architecture

```text
┌──────────────────────────────────────────────────────────┐
│                      Docker Compose                       │
│                                                           │
│  ┌─────────────┐    ┌───────────────┐    ┌────────────┐  │
│  │  React SPA  │───▶│  Express API  │───▶│  MongoDB   │  │
│  │  (Caddy)    │    │  (Node.js)    │    │            │  │
│  └─────────────┘    └──────┬────────┘    └────────────┘  │
│                            │                              │
│                     ┌──────┴──────────┐                   │
│                     │  Passport.js    │                   │
│                     │  JWT + SF OAuth │                   │
│                     └─────────────────┘                   │
└──────────────────────────────────────────────────────────┘
                              │
                   Salesforce CRM (OAuth + REST API)
```

---

## 7. Feature Requirements

### Phase 1 — Core CPQ Platform

**Goal:** A fully functional quoting platform with auth, product catalog management, quote building,
and real-time financial calculations.

---

#### 7.1 Authentication & Authorization

- **FR-AUTH-1:** Email + password registration and login. Passwords stored as bcrypt hashes.
- **FR-AUTH-2:** JWT-based sessions — short-lived access token (15 min) + refresh token (7 days),
  both stored as `httpOnly` cookies.
- **FR-AUTH-3:** Salesforce OAuth 2.0 login. On first login via Salesforce, a CPQ user record is
  created with `role: 'sales_rep'`; a Super Admin can elevate the role.
- **FR-AUTH-4:** All API routes require a valid JWT. Role-based middleware enforces permissions per route.
- **FR-AUTH-5:** Password reset via email (SMTP config via env vars).
- **FR-AUTH-6:** Account deactivation — deactivated users cannot log in; their historical quotes are preserved.

---

#### 7.2 Company Branding & Settings

- **FR-BRAND-1:** A Super Admin settings page to configure: Company Name, Logo (file upload), Primary
  Brand Color (hex picker), Accent Brand Color (hex picker).
- **FR-BRAND-2:** Brand settings applied globally via Bootstrap CSS custom properties — no hardcoded
  colors in the frontend.
- **FR-BRAND-3:** Default state is a neutral "Enterprise CPQ" identity with a placeholder logo until configured.

---

#### 7.3 Product Line Management

- **FR-LINE-1:** Product Lines are admin-configurable — created, renamed, reordered, and deleted via a settings panel.
- **FR-LINE-2:** Each Product Line has a Name and an optional color/badge for display purposes.
- **FR-LINE-3:** Deleting a Product Line is blocked if any products are currently assigned to it.

---

#### 7.4 Product Catalog Management

- **FR-PROD-1:** Create, read, update, delete (CRUD) products via an Admin product catalog page.
  Only Admins may write; all authenticated users may read.
- **FR-PROD-2:** Product fields:

| Field                          | Type                                          | Description                                                                                                             |
| ------------------------------ | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Name                           | String (required)                             | Display name                                                                                                            |
| SKU                            | String (optional)                             | Unique identifier for linking and import                                                                                |
| Product Line                   | Reference                                     | Links to a configured Product Line                                                                                      |
| Type                           | Enum                                          | `Core`, `Child`, `Add-on` — see hierarchy rules in FR-QUOTE-3/4/5                                                       |
| Pricing Model                  | Enum                                          | `PMPM`, `Flat Fee`, `Monthly Fee`, `Per Unit / Transaction`, `Per User / License`, `Hourly Rate`                        |
| Pricing Strategy               | Enum                                          | `Standard` (flat base price), `Tiered` (continuous volume brackets), `Volume Bands` (fixed membership buckets)          |
| Billing Type                   | Enum                                          | `One-Time`, `Recurring (Monthly)`, `Usage / Transactional`, `Time & Materials`                                          |
| Base Price                     | Number                                        | Price used when strategy is Standard                                                                                    |
| Unit Cost                      | Number                                        | Internal COGS for margin calculations                                                                                   |
| Implementation Fee             | Number                                        | One-time setup fee                                                                                                      |
| Overage Price                  | Number                                        | Per-unit cost if a usage allowance is exceeded                                                                          |
| Is Baseline Product            | Boolean                                       | If true, this product's fee is applied **once per quote** when any product in the same line is selected — never stacked |
| Is Quantity Based              | Boolean                                       | True = price driven by units entered; False = price driven by membership count                                          |
| Inherit Tier Volumes From Core | Boolean                                       | Child products use the parent Core's tier/band index for pricing                                                        |
| Tiers                          | Array `{min, price}`                          | Used when strategy is `Tiered`; price = total monthly fee for PMPM, price per unit for Per Unit                         |
| Volume Bands                   | Array `{label, maxMembers, price, implPrice}` | Used when strategy is `Volume Bands`; final band has no upper bound (e.g. 250,001+)                                     |
| Scope-Based Pricing            | Enum                                          | `None` / `All` (all pricing TBD) / `Implementation Only` (impl TBD; PMPM/monthly costs display normally)                |
| Compatible Core IDs            | Array                                         | Restricts a Child product to only appear when a specific Core is selected                                               |
| Recommended Product IDs        | Array                                         | Products to auto-select when this product is selected                                                                   |
| Description                    | String                                        | Admin-entered product description                                                                                       |

- **FR-PROD-3:** Filter catalog view by Product Line. Search by name or SKU.
- **FR-PROD-4:** XLSX export — exports the full catalog with all fields, resolving IDs to names for human
  readability, and encoding tiers/bands as human-readable strings.
- **FR-PROD-5:** XLSX import — parses uploaded file, maps columns to product schema, resolves parent core
  and recommendation references by Name or SKU, merges with existing catalog (update by ID/SKU, insert new).
- **FR-PROD-6:** Bulk-add modal — inline spreadsheet-style table to add multiple products at once before
  committing to the database.
- **FR-PROD-7:** Duplicate product action — clones a product with "Copy of" prefix for fast catalog expansion.
- **FR-PROD-8:** Reset Catalog — reverts to default seed data after a confirmation dialog.

---

#### 7.5 Quote Builder

- **FR-QUOTE-1:** Quote header inputs: Client Name (required), Effective Date, Membership Count,
  Term Length (months), Annual Uplift % (for multi-year escalation).
- **FR-QUOTE-2:** Product Line selector — toggle pills to include/exclude lines from the quote.
  Only selected lines render their product sections.
- **FR-QUOTE-3:** **Smart Bundling** — selecting a Core product creates a "Configuration Bundle" panel.
  All Child products with a `compatibleCoreIds` reference to that Core appear grouped within the bundle.
  Children without an active parent Core are hidden from the quote entirely.
- **FR-QUOTE-4:** **Volume Inheritance** — Child products default their quantity/volume to their parent
  Core's value. Overridable per line item.
- **FR-QUOTE-5:** **Recommendation Engine:**
  - Selecting a product automatically selects all products in its `recommendedProductIds` array (recursive chain).
  - Deselecting a product cascades removal of its recommendations unless another currently-selected product
    also recommends them (protected dependency check).
- **FR-QUOTE-6:** **Pricing model support:**
  - `PMPM` — price per member per month × membership count × term months
  - `Flat Fee` — fixed price × quantity
  - `Monthly Fee` — fixed recurring fee × term months
  - `Per Unit / Transaction` — price per unit × annual quantity ÷ 12 × term months
  - `Per User / License` — price per seat × seats × term months
  - `Hourly / T&M` — hourly rate × estimated hours
- **FR-QUOTE-7:** **Pricing strategy support:**
  - `Standard` — uses `basePrice` directly.
  - `Tiered` — finds the highest tier `min` ≤ input volume; uses that tier's price. For PMPM Tiered,
    tier price = total monthly fee; effective PMPM = total fee ÷ membership count.
  - `Volume Bands` — membership count falls into one of the configured named bands; uses that band's
    price and impl fee. Child with `inheritTierVolumesFromCore` uses the parent Core's resolved band index.
- **FR-QUOTE-8:** **Baseline Product handling** — for each active Product Line, if a product flagged
  `isBaselineProduct` is present in the catalog, its PMPM and implementation fee are applied once to the
  quote when any product in that line is selected, regardless of how many products are chosen. Displayed
  as a distinct line item in the quote summary.
- **FR-QUOTE-9:** **Scope-based pricing handling** — line items with `Scope-Based Pricing: All` display
  a "Requires Scope Review" badge and are excluded from TCV totals. Items with `Implementation Only` show
  known PMPM/monthly costs in the totals but flag the implementation fee as TBD. The quote summary shows
  a callout listing how many items require pricing review.
- **FR-QUOTE-10:** **Line-item adjustments** — per product, apply a Discount (−) or Uplift (+) as either
  a percentage or flat dollar amount. Strikethrough list price shown alongside adjusted effective price.
  Cannot be applied to scope-based items.
- **FR-QUOTE-11:** **Global quote adjustment** — discount or surcharge applied to Gross TCV after all
  line-item calculations.
- **FR-QUOTE-12:** **Real-time financial summary** (sticky sidebar):
  - PMPM (total per-member-per-month rate)
  - Monthly Fees (flat recurring monthly costs)
  - Monthly Total (PMPM × members + Monthly Fees)
  - ARR (Annual Recurring Revenue = Monthly Total × 12)
  - Implementation Cost (known; TBD items flagged separately)
  - Gross TCV
  - Global Adjustment amount
  - **Net TCV**
  - Scope-review callout (count of items requiring pricing review)
- **FR-QUOTE-13:** **Multi-Year Forecast table** (visible when Term Length > 12 months):
  - Rows: Year 1, Year 2, … Year N
  - Revenue per year with annual uplift applied to recurring items
  - One-time fees attributed to Year 1 only
- **FR-QUOTE-14:** Export quote to CSV.
- **FR-QUOTE-15:** Save quote (creates a record in MongoDB with the current user as owner).
  Load a previously saved quote by ID via URL parameter.
- **FR-QUOTE-16:** Copy/duplicate an existing quote to use as a starting point for a new one.

---

#### 7.6 Quote History Dashboard

- **FR-DASH-1:** Table of quotes scoped by role: Sales Reps see own quotes; Managers see team quotes;
  Execs and Admins see all.
- **FR-DASH-2:** Table columns: Client Name, Created Date, Product Lines (badges), Members, Net TCV,
  Status, Actions (Open, Copy, Delete).
- **FR-DASH-3:** Summary stats cards: Total Quotes, Total Pipeline (Net TCV sum), Quotes by Product
  Line (bar chart).
- **FR-DASH-4:** Filter/search by client name, date range, status, or product line.

---

#### 7.7 User Management (Admin)

- **FR-USER-1:** Admin page listing all users with columns: Name, Email, Role, Status (Active/Inactive),
  Last Login.
- **FR-USER-2:** Admin can change a user's role and activate/deactivate accounts.
- **FR-USER-3:** Invite a new user by email — sends a registration link with a time-limited token.

---

### Phase 2 — Deal Governance & Profitability

**Goal:** Discount controls, approval workflows, and real-time margin intelligence.

---

#### 7.8 Discounting Engine & Approval Workflows

- **FR-DISC-1:** Admin configures **Discount Thresholds** in Settings — e.g., line-item discount > 10%
  triggers Manager Review; > 25% triggers Executive Review.
- **FR-DISC-2:** **Volume Discounts** — admin can define automatic % discounts that apply when total
  membership crosses configured thresholds (distinct from line-item adjustments).
- **FR-DISC-3:** **Quote Status lifecycle:** `Draft` → `Submitted` → `Approved` / `Rejected`. Submitting
  a quote that exceeds a discount threshold automatically routes it to the appropriate approver tier.
- **FR-DISC-4:** Managers and Executives see a dedicated **Approval Queue** — pending quotes with quote
  details, margin score, discount summary, and Approve / Reject + comment actions.
- **FR-DISC-5:** Email notifications sent to the approver on submission; to the Sales Rep on approval or
  rejection (with comment).

---

#### 7.9 Margin Scoring & Profitability

- **FR-MARGIN-1:** Blended Margin calculated per quote in real time:
  - **Total Revenue** = sum of all effective extended prices + one-time fees (after line-item adjustments,
    before global adjustment; excludes scope-based items)
  - **Total Cost** = sum of (`unitCost × quantity`) for all line items
  - **Gross Profit** = Total Revenue − Total Cost
  - **Margin %** = (Gross Profit ÷ Total Revenue) × 100
- **FR-MARGIN-2:** Admin configures a **Margin Scorecard** in Settings — global thresholds and optional
  per-product-line overrides:

  ```text
  Global:     green ≥ 50%,  yellow ≥ 30%
  Per line:   { "Navigate": { green: 60%, yellow: 40% }, ... }
  ```

- **FR-MARGIN-3:** **Traffic Light badge** displayed in the Quote Summary sidebar:
  - Green (≥ green threshold) → Auto-Approve
  - Yellow (≥ yellow, < green) → Manager Review
  - Red (< yellow) → Executive Review
- **FR-MARGIN-4:** Margin status contributes alongside discount thresholds to determine the approval
  routing tier (the higher tier wins).

---

### Phase 3 — Salesforce Integration & Proposal Generation

**Goal:** Close-loop CRM connectivity and polished client-facing proposal output.

---

#### 7.10 Salesforce Integration

- **FR-SF-1:** Admin settings page for Salesforce connection: Consumer Key, Consumer Secret, Instance
  URL, field mapping configuration.
- **FR-SF-2:** **Opportunity Pull** — when creating a quote, Sales Rep can search and link a Salesforce
  Opportunity; pre-populates Client Name (Account Name), Opportunity Type, Close Date.
- **FR-SF-3:** **Intelligent Defaulting** — admin can map Salesforce Opportunity Type (or custom fields)
  to auto-activate specific product lines or pre-select core products in the Quote Builder.
- **FR-SF-4:** **Quote Writeback** — "Save to Salesforce" action on a finalized/approved quote pushes
  to the linked Opportunity: Net TCV, MRR, ARR, line items as Opportunity Products, and attaches the
  generated PDF.
- **FR-SF-5:** **Pricebook Sync** — admin can trigger a one-way sync from Salesforce Pricebooks into
  the CPQ product catalog, matching entries by SKU.

---

#### 7.11 Proposal Generation

- **FR-PROP-1:** "Generate Proposal" action available on Approved quotes — produces a styled PDF using
  `@react-pdf/renderer`.
- **FR-PROP-2:** PDF template includes: company logo and brand colors, client name, effective date,
  prepared-by (Sales Rep name), product line sections with descriptions and pricing tables, TCV/MRR/ARR
  summary, multi-year forecast (if applicable), signature block.
- **FR-PROP-3:** Admin can configure which sections appear in the proposal template (toggles in Settings).
- **FR-PROP-4:** Generated PDF is stored against the Quote record and available for download at any time.
  Optionally pushed to Salesforce as an attachment when using quote writeback.

---

## 8. Data Models (MongoDB Collections)

**`users`**

```text
id, email, passwordHash, firstName, lastName, role, salesforceId,
isActive, lastLogin, passwordResetToken, passwordResetExpires,
inviteToken, inviteExpires, createdAt, updatedAt
```

**`productLines`**

```text
id, name, displayColor, sortOrder, createdAt, updatedAt
```

**`products`**

```text
id, name, sku, productLineId, type, pricingModel, pricingStrategy,
billingType, basePrice, unitCost, implementationFee, overagePrice,
isBaselineProduct, isQuantityBased, inheritTierVolumesFromCore,
scopeBasedPricing, tiers[{min, price}],
volumeBands[{label, maxMembers, price, implPrice}],
compatibleCoreIds[], recommendedProductIds[],
description, createdBy, createdAt, updatedAt
```

**`quotes`**

```text
id, clientName, effectiveDate, termLength, annualUplift, membershipCount,
salesforceOpportunityId, ownerId, status, approvedBy, approvalComment,
selectedItems[QuoteItem], globalAdjustmentType, globalDiscountType,
globalDiscountValue, grossTCV, globalAdjustmentAmount, netTCV,
totalPMPM, totalMonthlyFees, monthlyTotal, arr, implementationTotal,
marginPercent, marginStatus, yearlySummary[{year, revenue}],
productLineIds[], hasScopeBasedItems, createdAt, updatedAt
```

**`settings`** (singleton document)

```text
id, companyName, logoUrl, primaryColor, accentColor,
discountThresholds{managerReviewPercent, executiveReviewPercent},
marginTargets{global{green, yellow}, productLines{...}},
volumeDiscountRules[], salesforceConfig, smtpConfig
```

---

## 9. Non-Functional Requirements

| #     | Requirement                                                                                                                                                                                                       |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1 | **Security:** bcrypt password hashing (cost ≥ 12); JWTs in `httpOnly` cookies with `Secure` flag in production; no secrets exposed to the client; OWASP Top 10 compliance; input validation on all API endpoints  |
| NFR-2 | **Performance:** Quote builder recalculations complete in < 100ms for catalogs up to 500 products                                                                                                                 |
| NFR-3 | **Deployment:** Full application starts with `docker compose up`; Caddy automatically provisions and renews Let's Encrypt SSL in production; requires a valid domain pointed at the server for HTTPS provisioning |
| NFR-4 | **Configuration:** All environment-specific values managed via `.env` (DB URI, JWT secret, SMTP, Salesforce credentials)                                                                                          |
| NFR-5 | **Open Source:** MIT License; `README.md` covers quickstart, branding setup, catalog seeding, and Docker deployment                                                                                               |
| NFR-6 | **Browser Support:** Modern evergreen browsers (Chrome, Firefox, Safari, Edge)                                                                                                                                    |
| NFR-7 | **Accessibility:** WCAG 2.1 AA compliance for primary user flows                                                                                                                                                  |

---

## 10. Out of Scope

- Mobile native app (responsive web only)
- Real-time collaborative editing of the same quote by multiple users simultaneously
- Payment processing or e-signature
- BI/data warehouse integrations (Snowflake, Tableau, etc.)
- Multi-tenant SaaS hosting (self-hosted Docker only)
- AI-generated content of any kind

---

## 11. Open Source Repository Deliverables

- `LICENSE` — MIT
- `README.md` — quickstart, branding setup, catalog import guide, Salesforce OAuth config
- `CONTRIBUTING.md` — local dev setup
- `docker-compose.yml` — `mongodb`, `api`, `web` (Caddy) services
- `docker-compose.dev.yml` — development override (volume mounts, exposed ports, hot-reload)
- `Caddyfile` — reverse proxy config, automatic HTTPS, `/api` routing to Express service
- `Makefile` — targets: `make dev`, `make prod`, `make down`, `make logs`, `make seed`, `make reset`, `make build`
- `.env.example` — all required and optional variables documented with descriptions
- Generic seed data — example products with no company-specific data
