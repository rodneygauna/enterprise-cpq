---
description: "Use when planning a net-new feature or improvement that has no PRD section yet. Covers codebase research, stakeholder interview, plan document structure, PRD draft format, and handoff to /implement-feature."
---

# Planning Instructions

These rules govern how the agent conducts feature planning for Enterprise CPQ. Apply them whenever
`/plan-feature` is invoked or when the user asks to plan, scope, or design something that has no
existing PRD section.

---

## 1. Codebase Research (always do this first)

Before asking the user any questions, run an `Explore` subagent to answer:

- **Models affected** — which Mongoose schemas in `backend/src/models/` will need to be created or modified?
- **Routes affected** — which Express routers in `backend/src/routes/` will need new endpoints or changes?
- **Services affected** — which files in `backend/src/services/` contain related business logic?
- **Pricing utilities** — does `backend/src/utils/pricing.js` or `frontend/src/utils/pricing.js` need changes?
- **Pages / components affected** — which files in `frontend/src/pages/` or `frontend/src/components/` are relevant?
- **Existing partial implementations** — any TODO comments, stub functions, or incomplete routes that relate to the feature?
- **Naming conflicts** — any existing symbols, routes, or component names that could collide with the proposed feature?

Summarize the research findings before presenting the Step 2 questions to the user.

---

## 2. Required Interview Questions

Ask these questions before writing any plan. Wait for answers before proceeding.

1. **Problem / motivation** — What specific user pain point or business need does this feature address? Who experiences it and how often?
2. **User roles** — Which roles (`super_admin`, `admin`, `executive`, `sales_manager`, `sales_rep`) will use this feature? Which roles should be restricted from it?
3. **Existing behavior** — What does the current system do (or fail to do) in this area?
4. **Desired behavior** — What should the system do after this feature is implemented? What does success look like for the end user?
5. **Phase alignment** — Is this an enhancement to an active Phase 1 feature, a Phase 2 / Phase 3 feature brought forward, or something entirely new?
6. **Out-of-scope boundaries** — What explicitly should _not_ be included in this iteration?
7. **NFR concerns** — Are there specific performance, security, or accessibility constraints beyond the defaults?

Do not write the plan until the user has answered all seven questions.

---

## 3. Plan Document Structure

Every plan saved to `docs/plans/<kebab-case-title>.md` must contain these sections in order:

```
# Plan: <Feature Title>

## TL;DR
One-paragraph summary of what is being built and why.

## Problem Statement
Restates the user's answer to interview Q1–Q3 in precise terms.

## Desired Behavior & Success Criteria
Bullet list of observable outcomes that define "done" for this feature.

## Phase Alignment
Which phase this belongs to (1 / 2 / 3) and any cross-phase dependencies.

## Out-of-Scope
Explicit list of items deferred from this iteration.

## Affected Files
Table of every existing file that will be created or modified.

| Layer     | File                                        | Change Type |
|-----------|---------------------------------------------|-------------|
| Model     | backend/src/models/Foo.js                   | Create      |
| Route     | backend/src/routes/foo.js                   | Create      |
| Service   | backend/src/services/fooService.js          | Create      |
| Utility   | backend/src/utils/pricing.js                | Modify      |
| Page      | frontend/src/pages/Foo.jsx                  | Create      |
| API       | frontend/src/api/foo.js                     | Create      |
| Seed      | backend/seeds/foo.js                        | Create      |
| Test (BE) | backend/src/routes/__tests__/foo.test.js    | Create      |
| Test (FE) | frontend/src/pages/__tests__/Foo.test.jsx   | Create      |

## Implementation Steps
Ordered list of tasks grouped by layer. Mark dependencies explicitly.

### Backend
- [ ] ...

### Frontend
- [ ] ...

### Tests
- [ ] ...

### Seed Data
- [ ] ...

### Accessibility
- [ ] ...

## NFR Impact
Call out any changes to performance budget, security model, or WCAG compliance.

## Open Questions
Anything that requires further clarification before or during implementation.

## Deferred Items
Items explicitly excluded from this plan with a brief rationale.

## Draft PRD Section
(See Section 4 below for format rules.)
```

---

## 4. Draft PRD Section Format

The draft PRD section must follow the same style used in `docs/PRD.md`. Rules:

- **Section heading:** `### 7.X <Feature Title>` — propose the next available section number; if unsure, use `### 7.X (TBD) <Feature Title>` and note that the user should assign the final number.
- **FR-\* items:** Prefix every functional requirement with `**FR-<ABBR>-N:**` where `<ABBR>` is a 2–5-letter uppercase abbreviation of the feature title (e.g. `BULK`, `NOTIF`, `AUDIT`) and `N` starts at 1.
- **Data model fields:** Present new or modified fields as a Markdown table matching the style in PRD Section 8.
- **New enum values:** List as inline code in a bullet, e.g. `` `pending` | `active` | `archived` ``.
- **Cross-references:** Reference existing FR-\* items when there is a dependency (e.g. "Extends FR-PROD-1").

Example stub:

```markdown
### 7.X Bulk Notifications

- **FR-NOTIF-1:** ...
- **FR-NOTIF-2:** ...

#### Data Model — Notification

| Field       | Type     | Notes                |
| ----------- | -------- | -------------------- |
| `recipient` | ObjectId | Ref: User            |
| `message`   | String   | Max 500 characters   |
| `read`      | Boolean  | Default `false`      |
| `createdAt` | Date     | Auto-set by Mongoose |
```

---

## 5. Output Locations

| Artifact               | Location                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Plan document          | `docs/plans/<kebab-case-title>.md`                                                                                           |
| Session context mirror | `/memories/session/plan.md`                                                                                                  |
| PRD draft              | Inline in the plan doc under "Draft PRD Section"; agent also proposes a direct edit to `docs/PRD.md` for the user to approve |

`docs/plans/` will be created if it does not exist. Plan file names use kebab-case matching the feature title argument.

---

## 6. Handoff to Implementation

After the user approves the plan:

1. Confirm `docs/plans/<feature>.md` has been saved.
2. Offer to update `docs/PRD.md` with the draft section — wait for user confirmation before making any changes to the PRD.
3. Present the exact command the user should run next:

   ```
   /implement-feature <Feature Title>
   ```

   Include a note that the agent will automatically find `docs/plans/<feature>.md` as context for the implementation.

Do **not** begin implementation autonomously. The user must explicitly invoke `/implement-feature`.

---

## 7. Constraints

- Never propose changes to seed data with real company names, real pricing, or real logos.
- Never hardcode colors — use Bootstrap CSS custom properties.
- Never skip the codebase research step, even for "simple" features — naming conflicts and partial implementations are common.
- If the proposed feature conflicts with the phase roadmap (e.g. a Phase 3 feature requested during Phase 1), flag it explicitly and ask the user to confirm they want to proceed out of phase.
- All plan language must be implementation-neutral at the planning stage — do not write code in the plan document, only file paths and task descriptions.
