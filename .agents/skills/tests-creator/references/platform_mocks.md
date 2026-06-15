# Platform and SDK Mocks

Standard mock implementations for libraries used in the project.

## Supabase Client Mock

```typescript
import { vi } from 'vitest';

export const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  then: vi.fn((cb) => cb({ data: [], error: null })),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockSupabase,
}));
```

## Telegram TMA SDK Mock

```typescript
import { vi } from 'vitest';

vi.mock('@telegram-apps/sdk', () => ({
  useLaunchParams: () => ({ initData: { user: { id: 123 } } }),
  useHapticFeedback: () => ({ impactOccurred: vi.fn() }),
  // Mock other hooks as needed
}));
```

## Electron IPC Mock

```typescript
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  window.electron = {
    ipcRenderer: {
      send: vi.fn(),
      on: vi.fn(),
      invoke: vi.fn(),
    },
  } as any;
}
```
