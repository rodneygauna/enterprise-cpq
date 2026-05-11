---
description: "Scaffold Salesforce OAuth setup, REST API call patterns, opportunity pull, quote writeback, and pricebook sync. Use when implementing Phase 3 Salesforce integration (FR-SF-1 through FR-SF-5)."
argument-hint: "Which Salesforce feature to implement (e.g. 'OAuth setup', 'opportunity pull', 'quote writeback', 'pricebook sync')"
agent: "agent"
---

Scaffold a Salesforce integration feature for Enterprise CPQ.

Reference [docs/PRD.md](../../docs/PRD.md) sections FR-SF-1 through FR-SF-5 before generating any code.
Reference [auth.instructions.md](../instructions/auth.instructions.md) for the Salesforce OAuth strategy setup.

---

## FR-SF-1 — Admin Settings Page for Salesforce Connection

Store Salesforce credentials in the `settings` singleton document (never in `.env` alone — admins must be able to update them via UI):

Fields: `consumerKey`, `consumerSecret`, `instanceUrl`, field mapping configuration.

Admin UI: `frontend/src/pages/admin/SalesforceSettings.jsx`

- Form with Consumer Key, Consumer Secret, Instance URL inputs
- All inputs type `password` or `text` (never pre-fill consumer secret in the form value)
- Save calls `PUT /api/settings/salesforce`
- "Test Connection" button calls `POST /api/settings/salesforce/test`

Backend: `PUT /api/settings/salesforce` — admin/super_admin only; validate all fields; never log credentials.

---

## FR-SF-2 — Opportunity Pull

When creating a quote, allow the Sales Rep to search for and link a Salesforce Opportunity.

Backend endpoint: `GET /api/salesforce/opportunities?search=<query>`

- Reads Salesforce credentials from the `settings` collection
- Calls Salesforce SOQL: `SELECT Id, Name, AccountId, Account.Name, CloseDate, Type FROM Opportunity WHERE Name LIKE '%<query>%' LIMIT 20`
- Uses the Salesforce REST API: `GET <instanceUrl>/services/data/v58.0/query?q=<encoded_soql>`
- Authenticates with a stored Salesforce access token (obtained via the admin OAuth setup, or via the user's Salesforce session if they logged in via SF OAuth)
- Returns opportunity list in standard `{ data: [...], error: null, meta: null }` shape

Frontend: In the Quote Builder header, add a "Link Opportunity" button that opens a search modal.
On selection, pre-populate: `clientName` from `Account.Name`, store `salesforceOpportunityId`.

---

## FR-SF-3 — Intelligent Defaulting

Admin configures field mappings in Settings: Salesforce Opportunity Type → CPQ product line activation or core product pre-selection.

Store mapping in `settings.salesforceConfig.fieldMappings` as:

```json
[
  {
    "sfField": "Type",
    "sfValue": "New Business",
    "action": "activateProductLine",
    "targetId": "<productLineId>"
  },
  {
    "sfField": "Type",
    "sfValue": "Renewal",
    "action": "preselectProduct",
    "targetId": "<productId>"
  }
]
```

Apply mappings in the Quote Builder when an Opportunity is linked.

---

## FR-SF-4 — Quote Writeback

"Save to Salesforce" action on Approved quotes.

Backend endpoint: `POST /api/quotes/:id/salesforce-push`

- Requires role: `sales_rep` (own quotes), `sales_manager`, `admin`, `super_admin`
- Quote must have status `Approved` and a linked `salesforceOpportunityId`
- Pushes to Salesforce via REST API:
  - Update Opportunity Amount with `netTCV`
  - Create `OpportunityLineItem` records for each selected product (matched by SKU to Salesforce Pricebook)
  - Attach the generated PDF (if available) as a `ContentVersion` record linked to the Opportunity
- Log the sync result and timestamp on the Quote document

---

## FR-SF-5 — Pricebook Sync

One-way sync from Salesforce Pricebooks into the CPQ product catalog.

Backend endpoint: `POST /api/settings/salesforce/pricebook-sync`

- Admin/super_admin only
- Fetches all `PricebookEntry` records from Salesforce
- Matches to CPQ products by `SKU`; updates `basePrice` on matches
- Inserts new products for entries with no matching SKU (with a `syncedFromSalesforce: true` flag)
- Returns a summary: `{ updated: N, inserted: N, skipped: N, errors: [] }`

---

## Salesforce REST API Helper (`backend/src/utils/salesforce.js`)

```js
const axios = require("axios");

async function sfGet(instanceUrl, accessToken, path) {
  const res = await axios.get(`${instanceUrl}/services/data/v58.0/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data;
}

async function sfPost(instanceUrl, accessToken, path, body) {
  const res = await axios.post(
    `${instanceUrl}/services/data/v58.0/${path}`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  return res.data;
}

module.exports = { sfGet, sfPost };
```

Never expose `accessToken` in logs or error messages.

---

## Security Notes

- Salesforce Consumer Secret must be stored encrypted at rest (or at minimum, only in the `settings` MongoDB document, never in source code or logs)
- All Salesforce API calls must be made server-side — never expose Salesforce tokens to the browser
- Validate and sanitize the `search` query param before embedding it in SOQL to prevent SOQL injection
