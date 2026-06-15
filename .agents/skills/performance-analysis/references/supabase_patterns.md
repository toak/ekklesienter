# Supabase & Query Optimization

## 1. Selective Column Fetching

Never use `select('*')` if you only need 2-3 columns. Fetching unnecessary data increases payload size and memory usage on the client.

```typescript
// [GOOD] Explicit columns
const { data } = await supabase.from('transactions').select('id, amount, date');
```

## 2. Server-side Filtering

Always filter data on the server rather than fetching everything and filtering with `.filter()` in JS.

## 3. Pagination & Range Queries

For tables with potentially thousands of rows (like transactions), always implement range-based loading.

```typescript
const { data } = await supabase
  .from('transactions')
  .select('*')
  .range(0, 49) // First 50 items
  .order('date', { ascending: false });
```

## 4. PostgREST Indexing

Ensure that columns used in `.eq()`, `.gt()`, and `.order()` are indexed in the Postgres database. Common candidates: `user_id`, `created_at`, `status`.

## 5. Caching Strategy

For data that doesn't change frequently (e.g., categories, user preferences), load once into a global store (Zustand/Jotai) and use the store as the primary source, rather than re-fetching from the DB on every mount.

## 6. RLS Policy Optimization

Avoid complex joins or subqueries inside RLS policies. These are executed for *every* row in the result set.

- **Pattern**: Denormalize user ownership (e.g., add `user_id` to every child table) to allow simple policies like `auth.uid() = user_id`.

## 7. RPC for Atomic Multi-Table Operations

If a single user action requires updating 3+ tables, use a Supabase RPC function instead of multiple `await supabase...` calls. This reduces network round-trips to one.
