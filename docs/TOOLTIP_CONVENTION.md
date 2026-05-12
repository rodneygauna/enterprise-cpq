# Tooltip Convention

> **Status:** Active — applies to all phases
> **Related PRD:** Section 7.13 FR-TTIP-1 through FR-TTIP-9

All contextual field tooltips in the application follow a single convention
defined here. Read this before adding, editing, or removing any tooltip.

---

## Quick Start

1. Add your plain-text string to **`frontend/src/utils/tooltips.js`** in the
   correct namespace.
2. Import and render `<FieldHelp>` **immediately after** the closing `</label>`
   tag for the field.

```jsx
// 1. In tooltips.js
export const TOOLTIPS = {
  myPage: {
    newField: "Explanation of what this field is and why it matters.",
  },
};

// 2. In your component
import FieldHelp from "../components/FieldHelp";
import { TOOLTIPS } from "../utils/tooltips";

<label htmlFor="newField" className="form-label">
  New Field
</label>
<FieldHelp text={TOOLTIPS.myPage.newField} />
<input id="newField" ... />
```

---

## Rules

### Placement

| Element type            | Where to put `<FieldHelp>`                                     |
| ----------------------- | -------------------------------------------------------------- |
| Standard input / select | Immediately after the closing `</label>` tag                   |
| Checkbox                | After the closing `</label>` tag, inside the `.form-check` div |
| Fieldset / legend       | Inline inside the `<legend>` element, after the legend text    |

**Do NOT** put `<FieldHelp>` (or any `<button>`) inside a `<label>` element.
The HTML spec forbids interactive content (labelable elements) as descendants
of `<label>`. This would cause double-activation when the label is clicked.

### Tooltip text

- **Plain text only.** No HTML markup, markdown, or JSX expressions in the
  string. The Bootstrap Tooltip plugin renders the title as text (`html: false`).
- **One sentence, two at most.** Aim for 10–25 words. Long text is truncated
  beyond `--bs-tooltip-max-width` (280 px by default).
- **Start with a capital letter; end without a period** for brief labels; use a
  period for full sentences.
- **Explain the _why_, not just the _what_.** Bad: "The SKU." Good: "Unique
  internal identifier used in exports and Salesforce sync."
- **No HTML entities** (`&amp;`, `&gt;`, etc.) — write the literal character.

### Registry

All strings live in `frontend/src/utils/tooltips.js` inside the `TOOLTIPS`
export. Use namespaced sub-objects that match the page/domain:

```
TOOLTIPS.quoteBuilder.*   QuoteBuilder.jsx + QuoteSummaryPanel.jsx
TOOLTIPS.products.*       Products.jsx + sub-components
TOOLTIPS.settings.*       Settings.jsx (all sub-forms)
TOOLTIPS.productLines.*   ProductLines.jsx
TOOLTIPS.users.*          Users.jsx
```

No tooltip string may be hard-coded inline in a component (enforced by the
`tooltips.test.js` uniqueness test and code review).

---

## FieldHelp Component API

```jsx
<FieldHelp
  text="Plain text to display."   {/* required */}
  id="optional-unique-id"          {/* defaults to React useId() */}
  placement="top"                  {/* 'top' | 'bottom' | 'left' | 'right' — default 'top' */}
/>
```

The component renders:

- A `<button type="button">` with `aria-label="Help"` and a Bootstrap Icon
  `bi-info-circle`.
- A `<span role="tooltip" className="visually-hidden">` always present in the
  DOM so screen readers announce the description when focus reaches the button.
- A Bootstrap 5 `Tooltip` instance (initialised on mount, disposed on unmount).

---

## Accessibility Checklist

Before shipping a page with new tooltips:

- [ ] Every `<FieldHelp>` is placed **after** `</label>`, not inside it.
- [ ] Tooltip text is plain text — no HTML tags.
- [ ] All strings are registered in `tooltips.js`, not inline.
- [ ] `npm test` in `frontend/` passes (including `tooltips.test.js`).
- [ ] Tab through the form — each info button is reachable and announces text.
- [ ] Toggle dark mode — icon is legible against both light and dark backgrounds.

---

## Adding a New Namespace

If you are building a brand-new page:

1. Add a new key to `TOOLTIPS` in `tooltips.js`.
2. Add coverage assertions to `frontend/src/utils/__tests__/tooltips.test.js`
   in a new `describe` block.
3. Reference this document in your PR description.
