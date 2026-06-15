# Performance Investigation Patterns

## 1. Memory Leak Profiling (Heap Snapshots)

When a leak is suspected:

1. Open Chrome DevTools > Memory tab.
2. Select **Heap snapshot** and take an initial snapshot.
3. Perform the suspected action multiple times (e.g., open/close modal).
4. Take a second snapshot.
5. Use the **Comparison** view to find objects that were created but not destroyed.
6. **Lookup**: Search for "Detached" elements (often `Detached HTMLElement`).

## 2. Bundle Inspection (`source-map-explorer`)

If the bundle size is too large:

1. Run a build with source maps enabled: `npm run build`.
2. Analyze the output: `npx source-map-explorer dist/assets/*.js`.
3. **Investigation**: Look for large dependencies that can be replaced by smaller alternatives or lazy-loaded.

## 3. Network Waterfall Debugging

1. Open DevTools > Network tab.
2. Filter by `Fetch/XHR`.
3. Look for the "Waterfall" column.
4. **Red Flags**:
   - A sequence of requests where each starts only after the previous one finishes.
   - Large payloads (>100KB) for simple data.
5. **Solution**: Use `Promise.all` or move logic to a single Supabase RPC call.

## 4. RLS Policy Profiling

If Supabase queries are slow despite indexes:

1. Check the `EXPLAIN ANALYZE` output for the query.
2. **Investigation**: Look for nested `SELECT` or heavy function calls within RLS policies.
3. **Pattern**: Prefer simple boolean checks on columns over complex joins in policies.
