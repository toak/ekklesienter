# Unit Testing Patterns

Use Vitest for fast, isolated tests of pure logic and utilities.

## Core Principles

- **No DOM dependency**: Tests should run in `node` environment if possible for speed.
- **Pure Functions**: Focus on input/output validation.
- **Edge Cases**: Always test nulls, undefineds, and error states.

## Example Pattern

```typescript
import { describe, it, expect } from 'vitest';
import { formatCurrency } from './utils';

describe('formatCurrency', () => {
  it('formats positive numbers correctly', () => {
    expect(formatCurrency(10.5, 'USD')).toBe('$10.50');
  });

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
  });

  it('returns fallback for invalid input', () => {
    expect(formatCurrency(null as any, 'USD')).toBe('--');
  });
});
```

## Testing Services

Services should be tested by mocking their internal Supabase or API clients. See [platform_mocks.md](platform_mocks.md).
