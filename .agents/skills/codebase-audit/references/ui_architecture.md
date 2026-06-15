# UI Architecture & Defensive Rendering

This document outlines the strict UI architecture and defensive rendering principles required to prevent visual bugs, accessibility failures, and layout crashes.

## Table of Contents

1. [Naked Modals (Z-Index Hell)](#1-naked-modals-z-index-hell)
2. [Flexbox Compressions (Missing min-w-0)](#2-flexbox-compressions-missing-min-w-0)
3. [The "No Global Scroll" Policy](#3-the-no-global-scroll-policy)
4. [Naked UUIDs in UI](#4-naked-uuids-in-ui)
5. [Async UI States (Double Submit & CLS)](#5-async-ui-states-double-submit--cls)
6. [Hardcoded UI Strings (i18n)](#6-hardcoded-ui-strings-i18n)
7. [Semantic Interaction (onClick Divs)](#7-semantic-interaction-onclick-divs)
8. [Z-Index Magic Numbers](#8-z-index-magic-numbers)
9. [Inline Massive SVGs](#9-inline-massive-svgs)

---

## 1. Naked Modals (Z-Index Hell)

### Constraint

MANDATORY PORTALS: All Modals, Dialogs, and Tooltips MUST be rendered using `React.createPortal` into `document.body` (or `#portal-root`). Never render a modal directly inside a parent component's DOM tree, as this causes inescapable z-index stacking context clipping.

### Bad

```tsx
// ❌ Rendered inline. Will be clipped by any parent with overflow-hidden or z-index.
return (
  <div className="relative">
    <button>Open</button>
    {isOpen && <div className="absolute inset-0 z-50 bg-black/50">Modal Content</div>}
  </div>
);
```

### Self-Correction Rule

If you see a UI component named `Modal`, `Dialog`, or `BottomSheet` returning a massive absolute/fixed `div` that is NOT wrapped in `createPortal` (or using a trusted Radix/Portal wrapper) → **CRITICAL LAYOUT FLAW**.

---

## 2. Flexbox Compressions (Missing min-w-0)

### Constraint

By default, flex items (inputs, text divs) will push out boundaries instead of shrinking if their content is long. Always apply `min-w-0` (and `truncate`) to any flex-child that needs to shrink to fit available space. Buttons next to inputs must have `shrink-0`.

### Bad

```tsx
// ❌ Long text will push the "Go" button off the screen
<div className="flex w-full">
  <div className="truncate">{longAddressString}</div>
  <button>Go</button>
</div>
```

### Good

```tsx
// ✅ min-w-0 forces the flex child to shrink, shrink-0 protects the button
<div className="flex w-full">
  <div className="min-w-0 flex-1 truncate">{longAddressString}</div>
  <button className="shrink-0">Go</button>
</div>
```

### Self-Correction Rule

If a flex container has a text or input child intended to truncate, but that child lacks `min-w-0` → **WARNING: Layout Blowout Risk**.

---

## 3. The "No Global Scroll" Policy

### Constraint

The main Page wrapper and Modal Root must NEVER have a horizontal scrollbar. The top-level container must always have `w-full max-w-full overflow-x-hidden`. Horizontal scrolling is allowed ONLY on specific inner "Scroll Islands" (e.g., `<div className="w-full overflow-x-auto"><table... /></div>`).

### Self-Correction Rule

If the root element of a page component has `overflow-x-auto` or `overflow-scroll` without a specific island → **CRITICAL: Global Scroll Violation**. Replace with `overflow-x-hidden`.

---

## 4. Naked UUIDs in UI

### Constraint

It is STRICTLY FORBIDDEN to render raw UUIDs (e.g., `550e8400...`) in user-facing labels, badges, or table cells. If a variable ends in `_id` or `Id` (e.g., `categoryId`), do not render it. Join the relation to fetch the `.name` or use a fallback.

### Bad

```tsx
// ❌ Rendering a raw database UUID to the user
<div>Category: {transaction.category_id}</div>
```

### Good

```tsx
// ✅ Resolving to an entity name with a fallback
<div>Category: {transaction.category?.name ?? 'Unknown Category'}</div>
```

### Self-Correction Rule

If JSX contains `{.*[iI]d}` or `{.*_id}` directly inside a DOM node (not as a prop like `key={item.id}`) → **WARNING: Naked UUID**.

---

## 5. Async UI States (Double Submit & CLS)

### Constraint 5A: Missing Skeletons (CLS Penalty)

When fetching data, render a Skeleton UI that mimics the final layout dimensions. Returning `null` or a tiny spinner causes Cumulative Layout Shift (CLS).

### Constraint 5B: Double-Submit Vulnerability

Buttons triggering async actions MUST show a spinner and have `disabled={isLoading}` (or `disabled={isSubmitting}`) to prevent users from firing the request twice.

### Bad

```tsx
// ❌ Can be clicked 5 times rapidly before the async function finishes
<button onClick={async () => await submitPayment()}>Pay Now</button>
```

### Good

```tsx
// ✅ Protected against double-submits
<button disabled={isSubmitting} onClick={handleSubmit}>
  {isSubmitting ? <Spinner /> : 'Pay Now'}
</button>
```

---

## 6. Hardcoded UI Strings (i18n)

### Constraint

NO HARDCODED STRINGS. Always use the translation function (e.g., `t('auth.login_btn')`).

### Bad

```tsx
// ❌ Hardcoded English
<h1>Welcome to Voicefin</h1>
<button>Get Started</button>
```

### Good

```tsx
// ✅ i18n ready
<h1>{t('onboarding.welcome')}</h1>
<button>{t('onboarding.start_btn')}</button>
```

### Self-Correction Rule

If raw text > 3 words is found directly inside JSX tags without being wrapped in `{t('...')}` → **WARNING: Hardcoded Strings**. *(Exceptions exist for dev toolbacks or debug views, but user-facing UI is strict).*

---

## 7. Semantic Interaction (onClick Divs)

### Constraint

Never use `div`, `span`, or `p` for buttons. Anything clickable must have `cursor-pointer`. If it performs an action, it MUST be an interactive element (e.g., `<button type="button">`). Icon-only buttons must have `aria-label`.

### Bad (Accessibility failure)

```tsx
// ❌ No keyboard support or screen reader role
<div onClick={closeModal} className="cursor-pointer">X</div>
```

### Good (Semantic)

```tsx
// ✅ Screen-reader friendly, keyboard navigable
<button type="button" onClick={closeModal} aria-label="Close" className="p-2 cursor-pointer">
  <Icon name="x" />
</button>
```

### Self-Correction Rule

If `onClick` is attached to a non-interactive tag → **WARNING: A11y Violation**. Convert to `<button type="button">`.

---

## 8. Z-Index Magic Numbers

### Constraint

Avoid using arbitrary magic numbers for `z-index` (e.g., `z-[9999]`). Use a project-defined scale or standard increments. If many layers are involved, manage z-index based on component depth or a central store.

### Self-Correction Rule

If a component uses a hardcoded `z-index` exceeding `z-50` without referencing a design system variable → **WARNING: Z-Index Magic Number**.

---

## 9. Inline Massive SVGs

### Constraint

Do not dump raw 50+ line `<svg>` code directly into feature components or pages. It destroys readability. Extract them to dedicated Icon components or use an icon library (e.g., Lucide).

### Self-Correction Rule

If an `<svg>` block exceeds 20 lines inside a standard React component → **WARNING: Inline SVG**. Extract to an icon component.
