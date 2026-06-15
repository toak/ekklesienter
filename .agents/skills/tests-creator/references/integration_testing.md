# Integration Testing Patterns

Integration tests verify that different parts of the application work together, specifically focusing on data flows between services and the UI.

## Core Principles

- **Avoid Real Database**: Use a local instance (Supabase CLI/Docker) or high-fidelity mocks.
- **Test Full Flows**: e.g., "User fills form -> Service calls DB -> UI updates".
- **Mock External APIs**: Use MSW to intercept network requests.

## Supabase Service Integration

When testing a service file that interacts with Supabase:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { UserService } from './UserService';
import { mockSupabase } from './platform_mocks';

describe('UserService', () => {
  it('fetches user profiles with joined data', async () => {
    mockSupabase.then.mockImplementationOnce((cb) => cb({ 
      data: [{ id: '1', name: 'John', category: { name: 'Admin' } }], 
      error: null 
    }));

    const users = await UserService.getAllUsers();
    expect(users[0].categoryName).toBe('Admin');
  });
});
```

## MSW for Network Requests

```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.get('*/rest/v1/users', () => {
    return HttpResponse.json([{ id: 1, name: 'Mocked User' }]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```
