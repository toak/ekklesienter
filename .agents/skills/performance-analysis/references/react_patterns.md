# React Performance Patterns (React 19)

## 1. Selective Rendering with `memo`

Ensure that expensive components are wrapped in `React.memo`. This is especially important for items in long lists.

```tsx
// [GOOD] Optimized list item
export const ListItem = React.memo(({ item, onSelect }: Props) => {
  return <div onClick={() => onSelect(item.id)}>{item.name}</div>;
});
```

## 2. Dependency Array Hygiene

Unstable references in `useEffect`, `useMemo`, or `useCallback` cause unnecessary re-calculations.

- **Bad**: Passing an object literal `[]` or `{}` as a dependency.
- **Good**: Using stable references from state or primitive values.

## 3. Context Provider Splitting

Deeply nested context providers can cause massive re-render trees.

- **Pattern**: Prefer small, focused providers over a single "God Provider".
- **Optimization**: Use `useMemo` for the context value to prevent re-renders when the parent re-renders but the state hasn't changed.

## 4. Lazy Loading

Use `React.lazy` and `Suspense` for screens and heavy modals that are not immediately visible.

```tsx
const ComplexModal = React.lazy(() => import('./ComplexModal'));

// Inside component
<Suspense fallback={<Loading />}>
  {isOpen && <ComplexModal />}
</Suspense>
```

## 5. React 19 Compiler

If the React Compiler is enabled, manual `useMemo` and `useCallback` are often unnecessary. However, you must still ensure that your data structures are "stable" enough for the compiler to work effectively.
