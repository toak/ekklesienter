# State Management Performance Patterns

## 1. Zustand Selector Optimization

Destructuring directly from a store without `useShallow` creates a new object on every render, causing the component to re-render even if the specific keys haven't changed.

```tsx
// [BAD] Re-renders on ANY store change
const { a, b } = useStore();

// [GOOD] Re-renders ONLY if a or b change
const { a, b } = useStore(useShallow(state => ({ a: state.a, b: state.b })));
```

## 2. Splitting Stores

If a store grows too large and contains frequently changing values (like timers or mouse positions) alongside static data, split them.

- `useStaticStore`: For user settings, profiles, etc.
- `useFastStore`: For frequently updated UI state.

## 3. Atomic State (Jotai)

For feature-specific state that needs to be shared across a complex subtree without triggering global re-renders, use Jotai atoms.

- **Derived Atoms**: Use `selectAtom` or read-only atoms for computed values to avoid recalculating in the component.

## 4. Transient Updates (The "Ref" Pattern)

For performance-critical UI (like custom scrollbars or audio visualizers), use a manual `subscribe` to the store and update a Ref instead of triggering React re-renders.

```tsx
useEffect(() => {
  const unsub = useStore.subscribe(
    state => state.value,
    value => {
      ref.current.textContent = value;
    }
  );
  return unsub;
}, []);
```
