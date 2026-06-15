# RUM (Real-User Monitoring) Patterns

## 1. Database Schema (`performance_metrics`)

Create this table in Supabase to track real-world performance.

```sql
create table performance_metrics (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  metric_name text not null, -- 'TTI', 'Large_Render', 'DB_Query_Time'
  value float not null,
  context jsonb, -- { url, screen, component_name }
  created_at timestamp with time zone default now()
);
```

## 2. Capturing Core Web Vitals

Use `PerformanceObserver` to capture metrics without blocking the main thread.

```typescript
export const trackMetric = (name: string, value: number, context: Record<string, any>) => {
  // Use non-blocking Supabase call or batching
  supabase.from('performance_metrics').insert({ metric_name: name, value, context });
};

// Example: TTI / LCP
new PerformanceObserver((entryList) => {
  for (const entry of entryList.getEntries()) {
    trackMetric(entry.name, entry.startTime, { url: window.location.href });
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
```

## 3. Detecting Long Tasks (Lag)

Monitor the main thread for blocking operations.

```typescript
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) {
      trackMetric('long-task', entry.duration, {
        url: window.location.href,
        attribution: entry.attribution?.[0]?.name
      });
    }
  }
}).observe({ type: 'longtask' });
```

## 4. Integration with `error_logs`

When a performance threshold is severely exceeded (e.g., DB query > 10s), log it to the `error_logs` table (Rule 4.4) with the context to trigger developer alerts.
