---
description: "Planning workflow for a net-new feature or improvement not covered by the PRD. Researches the codebase, interviews the developer, produces a structured plan doc in docs/plans/, drafts a PRD addition, and hands off to /implement-feature. Use before starting any work that has no existing PRD section."
argument-hint: "short feature title (e.g. 'bulk product import' or 'quote activity log')"
agent: "agent"
---

Plan a net-new Enterprise CPQ feature or improvement end-to-end.

**Before writing a single line of the plan, complete Steps 1 and 2 in full.**

---

## Step 1 — Codebase Research

Follow [planning.instructions.md](../instructions/planning.instructions.md) — Section 1.

Run an `Explore` subagent with a thorough search to identify:

- Mongoose models in `backend/src/models/` that will be created or modified
- Express routers in `backend/src/routes/` that need new endpoints or changes
- Service files in `backend/src/services/` with related business logic
- Pricing utilities in `backend/src/utils/pricing.js` and `frontend/src/utils/pricing.js`
- Pages and components in `frontend/src/pages/` and `frontend/src/components/` that are relevant
- Any existing partial implementations (TODOs, stubs, incomplete routes) related to the feature
- Any naming conflicts with existing symbols, routes, or component names

Present a concise research summary to the user before asking any questions. Format as:

**Research Summary**

- Models touched: ...
- Routes touched: ...
- Services touched: ...
- Frontend files touched: ...
- Partial implementations found: ...
- Naming conflicts: ...

---

## Step 2 — Developer Interview

Follow [planning.instructions.md](../instructions/planning.instructions.md) — Section 2.

Ask the user all seven required questions. **Do not proceed to Step 3 until answers are received.**

1. What specific user pain point or business need does this feature address? Who experiences it and how often?
2. Which user roles will use this feature? Which should be restricted?
3. What does the current system do (or fail to do) in this area today?
4. What should the system do after this feature is built? What does "done" look like for the end user?
5. Is this a Phase 1 enhancement, a Phase 2/3 feature brought forward, or something entirely new?
6. What should explicitly _not_ be included in this iteration?
7. Any specific performance, security, or accessibility constraints beyond the defaults?

---

## Step 3 — Feasibility & NFR Assessment

Before drafting the plan, assess:

- [ ] **Phase alignment** — Does this fit Phase 1 (active), Phase 2, or Phase 3? If out-of-phase, flag it and ask the user to confirm they want to proceed.
- [ ] **Cross-feature dependencies** — Does this depend on any not-yet-implemented PRD sections? List them.
- [ ] **Performance budget** — Will any new calculation touch the quote builder recalc path? If so, the < 100ms budget (NFR) applies.
- [ ] **Security surface** — Does this add new API endpoints, file uploads, or OAuth interactions? Identify OWASP Top 10 risks upfront.
- [ ] **WCAG 2.1 AA** — Does this add any new UI? If yes, accessibility audit is required in the implementation phase.
- [ ] **New environment variables** — Will `.env.example` need new entries?

Note any blockers or risks in the plan document.

---

## Step 4 — Draft the Plan Document

Follow [planning.instructions.md](../instructions/planning.instructions.md) — Sections 3 and 5.

Create `docs/plans/<kebab-case-title>.md` (create the `docs/plans/` directory if it does not exist) with all required sections:

- [ ] TL;DR
- [ ] Problem Statement
- [ ] Desired Behavior & Success Criteria
- [ ] Phase Alignment
- [ ] Out-of-Scope
- [ ] Affected Files table (layer, file path, create/modify)
- [ ] Implementation Steps (Backend / Frontend / Tests / Seed Data / Accessibility)
- [ ] NFR Impact
- [ ] Open Questions
- [ ] Deferred Items
- [ ] Draft PRD Section (Step 5 output goes here)

Also mirror the plan to `/memories/session/plan.md` for in-context reference during this session.

---

## Step 5 — Draft the PRD Addition

Follow [planning.instructions.md](../instructions/planning.instructions.md) — Section 4.

Produce a draft PRD section in the style of `docs/PRD.md`:

- [ ] Section heading: `### 7.X <Feature Title>` (propose next available number; use `7.X (TBD)` if unsure)
- [ ] One sentence describing the feature
- [ ] `**FR-<ABBR>-N:**` items covering every functional requirement surfaced during the interview
- [ ] Data model table for any new or modified fields
- [ ] New enum values (if any)
- [ ] Cross-references to existing FR-\* items where there are dependencies

Append this draft as the last section of `docs/plans/<kebab-case-title>.md`.

---

## Step 6 — Present the Plan & Iterate

Show the user the full plan inline. Ask:

> "Does this plan look correct? Would you like to adjust scope, add requirements, or defer anything before I finalize it?"

Apply any requested changes to `docs/plans/<kebab-case-title>.md` and re-present the affected sections. Repeat until the user approves.

**Do not proceed to Step 7 until the user explicitly approves the plan.**

---

## Step 7 — PRD Update

Once the plan is approved:

- [ ] Propose adding the Draft PRD Section from Step 5 directly into `docs/PRD.md` at the appropriate location
- [ ] Show the user exactly where it would be inserted (section heading and surrounding context)
- [ ] Wait for explicit confirmation before making any changes to `docs/PRD.md`

If the user declines the PRD update, note it in the Deferred Items section of the plan document.

---

## Step 8 — Handoff to Implementation

Follow [planning.instructions.md](../instructions/planning.instructions.md) — Section 6.

- [ ] Confirm `docs/plans/<kebab-case-title>.md` is saved and complete
- [ ] Present the exact invocation command:

  ```
  /implement-feature <Feature Title>
  ```

- [ ] Remind the user that the agent will use `docs/plans/<kebab-case-title>.md` as additional context for implementation, supplementing the PRD section created in Step 7.
- [ ] Do **not** begin implementation. Wait for the user to run `/implement-feature`.

---

## Definition of Done for This Prompt

Before considering the planning phase complete, confirm:

- [ ] `docs/plans/<kebab-case-title>.md` exists and contains all required sections
- [ ] `/memories/session/plan.md` mirrors the current plan
- [ ] Draft PRD section uses FR-\* numbering, data model tables, and correct section heading style
- [ ] `docs/PRD.md` updated (or update explicitly deferred and noted)
- [ ] User has been given the `/implement-feature` handoff command
- [ ] No code has been written — this is a planning-only prompt
