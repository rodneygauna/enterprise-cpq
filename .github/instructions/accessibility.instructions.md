---
applyTo: "frontend/**"
description: "Use when creating or editing any React component, page, or layout. Enforces WCAG 2.1 AA compliance (NFR-7) on all frontend code."
---

# Accessibility — WCAG 2.1 AA

Reference: PRD NFR-7. All primary user flows must meet WCAG 2.1 AA.

---

## Semantic HTML

Use the correct HTML element for its semantic role — never substitute a `<div>` or `<span>` for a meaningful element:

```jsx
// Correct
<nav aria-label="Main navigation">...</nav>
<main>...</main>
<header>...</header>
<section aria-labelledby="section-heading">...</section>
<table>...</table>   // for tabular data (quote line items, product catalog)

// Wrong
<div class="nav">...</div>
<div class="main-content">...</div>
```

Bootstrap layout classes (`container`, `row`, `col-*`) may be applied to semantic elements — they are not a reason to use `<div>`.

---

## Interactive Elements

Every interactive element must have a discernible accessible name:

```jsx
// Visible label is sufficient
<button>Save Quote</button>

// Icon-only button — requires aria-label
<button aria-label="Delete product"><TrashIcon /></button>

// Link — descriptive text, not "click here"
<a href="/quotes/123">View Quote #123</a>  // Correct
<a href="/quotes/123">Click here</a>        // Wrong
```

Avoid using `<div onClick>` or `<span onClick>` — use `<button>` for actions and `<a>` for navigation.

---

## Color Contrast

- Text on background must meet **4.5:1** contrast ratio (WCAG AA for normal text)
- Large text (≥ 18pt or 14pt bold) must meet **3:1**
- Never override Bootstrap's CSS custom properties with low-contrast values
- Never communicate information by color alone — pair color with text, icons, or patterns
- Status badges (quote status, margin traffic light) must include text labels, not just color

```jsx
// Correct — color + text label
<span className="badge bg-success">Approved</span>
<span className="badge bg-warning text-dark">Pending Review</span>
<span className="badge bg-danger">Rejected</span>

// Wrong — color only
<span className="badge bg-success"></span>
```

---

## Forms

Every form input must have an associated `<label>`:

```jsx
// Correct — explicit label association
<label htmlFor="clientName">Client Name</label>
<input id="clientName" type="text" name="clientName" />

// Correct — Bootstrap floating label
<div className="form-floating">
  <input id="memberCount" type="number" className="form-control" placeholder=" " />
  <label htmlFor="memberCount">Membership Count</label>
</div>

// Wrong — no label
<input type="text" placeholder="Client Name" />
```

Required fields must be marked both visually and programmatically. Use explicit `(required)` text in the label — this is self-explanatory without needing a form-level legend and is recommended by W3C WAI, the UK Government Design System, and Nielsen Norman Group. Combine with `aria-required="true"` on the input:

```jsx
<label htmlFor="companyName" className="form-label">
  Company Name <span className="text-muted fw-normal small">(required)</span>
</label>
<input
  id="companyName"
  type="text"
  aria-required="true"
  required
/>
```

Do **not** use an asterisk (`*`) as the sole required indicator — it requires a form-level legend to be WCAG 3.3.2 compliant and is not universally understood.

> **Tip:** If most fields in a form are required, mark the _optional_ ones instead with `<span className="text-muted fw-normal small">(optional)</span>` — this reduces visual noise while still meeting 3.3.2.

Validation error messages must be programmatically linked:

```jsx
<input
  id="clientName"
  aria-describedby="clientName-error"
  aria-invalid={!!errors.clientName}
/>;
{
  errors.clientName && (
    <div
      id="clientName-error"
      className="invalid-feedback d-block"
      role="alert"
    >
      {errors.clientName}
    </div>
  );
}
```

---

## Dynamic Content — ARIA Live Regions

Quote builder recalculations and toast notifications must announce updates to screen readers:

```jsx
// Quote summary sidebar — updates on every line item change
<div aria-live="polite" aria-atomic="true">
  <p>Net TCV: {formatCurrency(netTCV)}</p>
</div>

// Toast notification
<div role="status" aria-live="polite" className="toast-container">
  {message && <div className="toast show">{message}</div>}
</div>
```

Use `aria-live="polite"` for non-urgent updates. Use `aria-live="assertive"` only for critical errors.

---

## Focus Management

Modal dialogs must trap focus while open and return focus to the trigger element on close:

```jsx
// On modal open — move focus inside the modal
useEffect(() => {
  if (isOpen) {
    firstFocusableRef.current?.focus();
  } else {
    triggerRef.current?.focus(); // return focus to button that opened modal
  }
}, [isOpen]);

// Trap Tab/Shift+Tab within modal
const handleKeyDown = (e) => {
  if (e.key !== "Tab") return;
  // cycle focus between firstFocusable and lastFocusable
};
```

Bootstrap modals handle this natively — do not override their default focus behaviour.

---

## Images

```jsx
// Meaningful image — describe the content
<img src={logoUrl} alt="Acme Corp company logo" />

// Decorative image — empty alt suppresses screen reader announcement
<img src="/decorative-bg.svg" alt="" role="presentation" />

// Icon used alongside text — hide from screen readers
<span aria-hidden="true"><SearchIcon /></span> Search
```

---

## Keyboard Navigation

- All interactive elements must be reachable and operable via Tab and Enter/Space
- No keyboard traps — pressing Tab or Escape must always allow the user to move on
- Custom dropdown menus must support arrow key navigation
- Skip-to-main-content link must be the first focusable element on every page:

```jsx
<a href="#main-content" className="visually-hidden-focusable">
  Skip to main content
</a>
...
<main id="main-content">...</main>
```

---

## Headings

Use a logical, single-level-at-a-time heading hierarchy. Never skip levels for visual styling:

```jsx
// Correct
<h1>Quote Builder</h1>
  <h2>Product Line: Navigate</h2>
    <h3>Core Products</h3>

// Wrong — use CSS to change visual size, not heading level
<h1>Quote Builder</h1>
<h3>Product Line: Navigate</h3>  // skipped h2
```

---

## Tables

Data tables (product catalog, quote line items, quote history) must include header cells:

```jsx
<table className="table">
  <caption className="visually-hidden">Product Catalog</caption>
  <thead>
    <tr>
      <th scope="col">Product Name</th>
      <th scope="col">Pricing Model</th>
      <th scope="col">Base Price</th>
    </tr>
  </thead>
  <tbody>...</tbody>
</table>
```

---

## Checklist Before Every PR

- [ ] All form inputs have associated `<label>` elements
- [ ] All icon-only buttons have `aria-label`
- [ ] Dynamic content updates use `aria-live`
- [ ] Modals trap and restore focus correctly
- [ ] All images have `alt` text (or `alt=""` if decorative)
- [ ] No information conveyed by color alone
- [ ] Page is fully operable with keyboard only
- [ ] Heading hierarchy is logical (no skipped levels)
- [ ] Skip-to-main-content link is present
