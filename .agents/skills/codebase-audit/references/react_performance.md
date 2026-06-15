# React Performance Audit Reference (React 19, Framer Motion, Recharts)

## Table of Contents
1. [Re-render Detection](#re-render-detection)
2. [Memoization Rules](#memoization-rules)
3. [List Virtualization](#list-virtualization)
4. [Animation Performance](#animation-performance)
5. [Bundle Size](#bundle-size)
6. [Lazy Loading](#lazy-loading)

---

## Re-render Detection

### Constraint
Components MUST NOT re-render when their props/state haven't changed. Common causes:
1. Inline object/array/function creation in JSX
2. Missing `React.memo` on child components receiving stable props
3. Context providers with rapidly changing values

### Bad — Inline Object Creation
```tsx
// ❌ New object created on every render → child always re-renders
<TransactionCard style={{ padding: 16 }} onPress={() => navigate(tx.id)} />
```

### Good
```tsx
// ✅ Stable references
const cardStyle = useMemo(() => ({ padding: 16 }), []);
const handlePress = useCallback(() => navigate(tx.id), [tx.id]);
<TransactionCard style={cardStyle} onPress={handlePress} />
```

### Self-Correction Rule
In list renders (`.map()`), if any prop is an inline function or object literal, flag as **WARNING — re-render trigger**. If the list can exceed 20 items, escalate to **CRITICAL**.

---

## Derived State Anti-Pattern (AI-Slop)

### Constraint
Values derived purely from props or state MUST be computed inline during render. Using `useEffect` + `useState` to "sync" derived state causes double renders and race conditions. This is the single most common AI code generation mistake.

### Bad
```tsx
// ❌ useEffect + useState for something computable inline — 2x renders
const [total, setTotal] = useState(0);
useEffect(() => setTotal(items.reduce((s, i) => s + i.amount, 0)), [items]);
```

### Good
```tsx
// ✅ Compute inline — if cheap, no hook needed
const total = items.reduce((s, i) => s + i.amount, 0);
// ✅ If expensive, wrap in useMemo
const total = useMemo(() => items.reduce((s, i) => s + i.amount, 0), [items]);
```

### Self-Correction Rule
If `useEffect` contains ONLY `setState(derivedValue)`, flag as **CRITICAL — derived state anti-pattern**. See `references/ai_slop_patterns.md` for the full decision tree.

---

## Memoization Rules

### When `React.memo` is REQUIRED
1. List item components (inside `.map()`)
2. Components receiving callbacks from parent
3. Components under frequently updating context/store

### When `React.memo` is WASTEFUL
1. Components that always receive new props (e.g., timestamp display)
2. Components with few children and cheap renders
3. Root-level page components (render infrequently)

### `useMemo` vs `useCallback`
- `useMemo` — for expensive computations (filtering, sorting, aggregation)
- `useCallback` — for functions passed as props to memoized children
- **NEVER** use `useMemo` for simple value assignments or trivial computations

### Bad
```tsx
// ❌ Useless useMemo — more expensive than the computation
const name = useMemo(() => user.firstName, [user.firstName]);
```

### Good
```tsx
// ✅ useMemo for actual computation
const sortedTransactions = useMemo(
  () => transactions.sort((a, b) => new Date(b.date) - new Date(a.date)),
  [transactions]
);
```

---

## List Virtualization

### Constraint
Any list that can exceed **50 items** MUST use `@tanstack/react-virtual` (already in deps). Rendering 200+ DOM nodes for a transaction list destroys scroll performance on TMA WebView.

### Bad
```tsx
// ❌ All items rendered at once
{transactions.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}
```

### Good
```tsx
// ✅ Virtualized — only visible items rendered
const virtualizer = useVirtualizer({ count: transactions.length, getScrollElement, estimateSize: () => 72 });
{virtualizer.getVirtualItems().map((virtualRow) => (
  <TransactionRow key={transactions[virtualRow.index].id} tx={transactions[virtualRow.index]} style={{ transform: `translateY(${virtualRow.start}px)` }} />
))}
```

### Self-Correction Rule
Search for `.map(` in TSX files rendering data arrays. If the data source is a Dexie table or a Supabase query result that could have many items, and no virtualization is present → **WARNING**.

---

## Animation Performance

### Constraint (Framer Motion)
1. **NEVER animate `width`, `height`, or `top`/`left`** — triggers layout recalculation. Use `transform` and `opacity` only for 60fps.
2. **Use `layout` prop sparingly** — it can cause expensive layout measurements. Only use when elements reflow.
3. **`AnimatePresence` MUST wrap exit animations** — missing it means components disappear without animating.
4. **Use `MotionDiv`, `MotionList` from shared/ui** — not raw `motion.div` — to maintain consistency and performance.

### Bad
```tsx
// ❌ Animating height — causes layout thrashing on every frame
<motion.div animate={{ height: isOpen ? 300 : 0 }} />
```

### Good
```tsx
// ✅ Animate transform (GPU-accelerated)
<motion.div
  initial={{ scaleY: 0, opacity: 0 }}
  animate={{ scaleY: 1, opacity: 1 }}
  style={{ transformOrigin: 'top' }}
/>
```

---

## Bundle Size

### Constraint
1. **lodash** — NEVER import the full library. Use specific imports: `import debounce from 'lodash/debounce'`
2. **d3** — Full d3 import is ~500KB. Import only needed modules: `import { scaleLinear } from 'd3-scale'`
3. **recharts** — Import specific chart types, not the barrel export
4. **date-fns** — Already tree-shakeable, but verify no `import * as dateFns`
5. **lucide-react** — Each icon is individually importable. Verify no `import * from 'lucide-react'`

### Self-Correction Rule
Search for:
- `import _ from 'lodash'` or `import lodash` → **CRITICAL — full 75KB import**
- `import * as d3 from 'd3'` → **CRITICAL — full 500KB import**
- `import { ... } from 'recharts'` with > 5 named exports → **WARNING — check tree shaking**

---

## Lazy Loading

### Constraint
Feature pages/routes MUST be lazy-loaded via `React.lazy()` + `Suspense`. Loading the entire app bundle upfront destroys initial load performance in TMA WebView.

### Bad
```tsx
// ❌ All routes loaded eagerly
import Analytics from './features/analytics/AnalyticsPage';
import Budget from './features/budget/BudgetPage';
import Settings from './features/settings/SettingsPage';
```

### Good
```tsx
// ✅ Lazy-loaded routes
const Analytics = lazy(() => import('./features/analytics/AnalyticsPage'));
const Budget = lazy(() => import('./features/budget/BudgetPage'));

<Suspense fallback={<Skeleton />}>
  <Routes>
    <Route path="/analytics" element={<Analytics />} />
    <Route path="/budget" element={<Budget />} />
  </Routes>
</Suspense>
```

### Self-Correction Rule
In `App.tsx` or the router file, if feature page imports are NOT using `lazy()`, flag as **WARNING — bundle bloat**. If App.tsx exceeds 500 lines, flag as **CRITICAL — file too large**.
