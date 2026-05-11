---
description: "Audit a React component or page file for WCAG 2.1 AA compliance. Reports violations with line references, suggested fixes, and WCAG criterion mapping."
argument-hint: "Path to the component or page file to audit (e.g. 'frontend/src/pages/QuoteBuilder.jsx')"
agent: "agent"
---

Audit the specified React component or page file for WCAG 2.1 AA accessibility compliance.

Follow the rules in [accessibility.instructions.md](../instructions/accessibility.instructions.md) as the authoritative checklist.

## Audit Steps

1. **Read the file** in full
2. **Check each rule** from the accessibility instructions against the file's code
3. **Report all violations** found
4. **Fix all violations** in the file
5. **Confirm the file is clean** — re-read it and confirm no violations remain

---

## Checklist to Verify

| Rule                 | Check                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Semantic HTML        | No `<div>` / `<span>` used in place of `<nav>`, `<main>`, `<header>`, `<section>`, `<button>`, `<a>` |
| Interactive elements | All buttons/links have discernible text or `aria-label`                                              |
| Icon-only buttons    | Have `aria-label`; icon has `aria-hidden="true"`                                                     |
| Color contrast       | No hardcoded color values that may fail 4.5:1 ratio; Bootstrap CSS custom properties used            |
| Color alone          | Status indicators include a text label, not color only                                               |
| Form labels          | Every `<input>`, `<select>`, `<textarea>` has an associated `<label htmlFor>` or `aria-label`        |
| Error messages       | Validation errors linked to inputs via `aria-describedby`; field marked `aria-invalid`               |
| ARIA live regions    | Dynamic content updates (quote totals, notifications) use `aria-live="polite"`                       |
| Modal focus          | Modal traps focus on open; returns focus to trigger on close                                         |
| Images               | All `<img>` have `alt`; decorative images have `alt=""`                                              |
| Keyboard nav         | No `onClick` on non-interactive elements; all flows keyboard-operable                                |
| Keyboard traps       | Nothing prevents Tab or Escape from working                                                          |
| Headings             | No skipped heading levels; single `<h1>` per page                                                    |
| Tables               | `<th scope="col                                                                                      | row">`on header cells;`<caption>`or`aria-label` on table |
| Skip link            | `<a href="#main-content">Skip to main content</a>` as first focusable element (check layout)         |

---

## Report Format

For each violation found, report:

```
VIOLATION: <Short description>
File:      <filename>:<line number>
WCAG:      <criterion number and name> (e.g. 1.3.1 Info and Relationships)
Current:   <the problematic code>
Fix:       <the corrected code>
```

If no violations are found, confirm: "No WCAG 2.1 AA violations found in `<filename>`."

---

## After Reporting — Fix All Violations

Apply all fixes to the file. Do not leave violations for the developer to fix manually.
After applying fixes, re-read the file and run through the checklist once more to confirm everything is resolved.
