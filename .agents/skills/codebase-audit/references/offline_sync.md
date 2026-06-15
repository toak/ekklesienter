# Offline Sync Audit Reference (Dexie.js + Supabase)

## Table of Contents
1. [Mutation Queue Integrity](#mutation-queue-integrity)
2. [Race Conditions](#race-conditions)
3. [Schema Drift](#schema-drift)
4. [Data Loss Vectors](#data-loss-vectors)
5. [Pull/Push Ordering](#pullpush-ordering)
6. [IndexedDB Performance](#indexeddb-performance)

---

## Mutation Queue Integrity

### Constraint
Every local write (CREATE/UPDATE/DELETE) MUST enqueue a mutation entry in `db.mutation_queue` BEFORE the local Dexie write resolves. If the app crashes between the local write and the enqueue, data is lost.

### Bad
```tsx
// ❌ Local write succeeds, but mutation queue write can fail silently
await db.transactions.put(newTx);
await db.mutation_queue.add({ type: 'CREATE', table: 'transactions', payload: newTx, timestamp: Date.now() });
// If the second line throws, the server never knows about the transaction
```

### Good
```tsx
// ✅ Wrap in a single Dexie transaction — atomic
await db.transaction('rw', [db.transactions, db.mutation_queue], async () => {
  await db.transactions.put(newTx);
  await db.mutation_queue.add({ type: 'CREATE', table: 'transactions', payload: newTx, timestamp: Date.now() });
});
```

### Self-Correction Rule
Search for `.put()`, `.add()`, `.update()`, `.delete()` on Dexie tables. If a corresponding `mutation_queue.add()` exists but is NOT inside `db.transaction('rw', ...)`, flag as **CRITICAL — data loss risk**.

---

## Race Conditions

### Known Race: Concurrent Sync + User Write
If `SyncService.sync()` pulls new data while the user creates a transaction locally, the pull's `bulkPut` can overwrite the local version.

### Mitigation Check
1. `SyncService.isSyncing` guard exists ✓
2. But: does the UI disable writes during sync? If not → **WARNING**.
3. Does `pullTable()` check `updated_at` against local? If it blindly `bulkPut`s, a newer local record gets overwritten → **CRITICAL**.

### Known Race: Rapid Tab Switching
Telegram Mini Apps can background the WebView. If:
1. User writes offline → mutation queued
2. App backgrounded → sync fires on `visibilitychange`
3. User reopens and writes again before sync finishes

Result: duplicate mutations or out-of-order pushes.

### Self-Correction Rule
Grep for `visibilitychange` or `focus` event listeners. If sync is triggered there without debouncing or queue-locking, flag as **WARNING**.

---

## Schema Drift

### Constraint
The local Dexie schema (version 1 in `db.ts`) MUST match the Supabase table columns. If Supabase adds a column but Dexie doesn't index it, pulled data with the new column is stored but inaccessible by index.

### Specific Risk
The `SyncService` has a catch for `42703` (undefined column) errors. If Dexie's local interfaces have extra fields not in Supabase (e.g., legacy `limit_amount` on budgets), the push sanitizer must strip them. Verify the sanitizer handles ALL legacy fields.

### Self-Correction Rule
Compare every field in `db.ts` interfaces against the Supabase schema. Flag any mismatch as **WARNING — schema drift**.

---

## Data Loss Vectors

### Vector 1: `bulkDelete` Without Confirmation
`pullTable()` deletes records where `deleted === true`. If the server erroneously marks a record as deleted, the client permanently loses it from IndexedDB.

### Vector 2: `any` in Mutation Payload
`MutationQueueEntry.payload` is typed as `any`. A malformed payload silently passes type checks but causes `22P02` (invalid input syntax) on push. The error handler drops these entries — data loss.

### Bad
```tsx
export interface MutationQueueEntry {
  payload: any; // ❌ No type checking on what gets pushed
}
```

### Good
```tsx
export interface MutationQueueEntry {
  payload: Record<string, unknown>; // ✅ At least forces object shape
  // Better: union type of all entity partial types
}
```

### Vector 3: Clearing All LocalStorage on Logout
`authStore.logout` calls `localStorage.clear()` then `window.location.reload()`. This wipes `last_sync_timestamp` meta. On next login, force-full-pull happens — but if IndexedDB was also cleared, unsynced mutations in `mutation_queue` are lost.

### Self-Correction Rule
Check if `logout()` flushes `mutation_queue` BEFORE clearing storage. If not → **CRITICAL**.

---

## Pull/Push Ordering

### Constraint
The sync MUST push local changes BEFORE pulling remote changes. Otherwise:
1. Local creates get overwritten by stale server data
2. Conflict resolution becomes impossible

### Current Code Analysis
`SyncService.sync()` correctly does `pushChanges()` first, then `pullTable()`. ✅ But the push has a `try/catch` that **continues with pull even on push failure**:

```tsx
try { await this.pushChanges(); }
catch (pushError) { console.warn('Push changes failed, continuing with pull:', pushError); }
```

Risk: If push fails due to network, pull succeeds and overwrites local data with stale server state. The local mutations are still in the queue but the UI shows server data → confusion + potential duplicate transactions.

---

## IndexedDB Performance

### Bottleneck 1: No Compound Indexes for Common Queries
If the UI frequently queries `transactions` by `user_id + month`, but the Dexie index is `[user_id+transaction_date]`, date-range queries on month boundaries require scanning.

### Bottleneck 2: `bulkPut` Without Chunking
For initial sync with thousands of records, a single `bulkPut` can block the main thread. Chunk into batches of ~500.

### Bottleneck 3: `toArray()` on Large Tables
`db.mutation_queue.orderBy('id').toArray()` loads ALL pending mutations into memory. For offline-heavy users, this could be hundreds of entries.

---

## 7. Dexie as Source of Truth (Dexie Abuse)

### Constraint
Dexie.js is STRICTLY a read cache and offline queue. Critical business data must never be saved directly and ONLY to Dexie without corresponding to the `mutation_queue` or triggering a Supabase API call. 

### Self-Correction Rule
If you see business logic writing to a local Dexie table (e.g. `db.users.put(...)`) without a corresponding network API call or a `mutation_queue.add()` in the same transaction → **CRITICAL: Dexie as Source of Truth Violation**. Data will be lost on clear cache.
