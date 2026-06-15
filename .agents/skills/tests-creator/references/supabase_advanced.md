# Supabase Advanced Testing

Mocking complex database interactions including Realtime and Auth edge cases.

## Realtime Subscription Mocking

```typescript
export const mockChannel = {
  on: vi.fn(() => mockChannel),
  subscribe: vi.fn((cb) => {
    if (cb) cb('SUBSCRIBED');
    return mockChannel;
  }),
  unsubscribe: vi.fn(),
};

mockSupabase.channel.mockReturnValue(mockChannel);
```

## Auth Session Failures

Test how the UI handles session timeouts or invalid tokens.

```typescript
it('redirects to login on session expiry', async () => {
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: { message: 'Session expired' }
  });

  render(<ProtectedRoute />);
  expect(await screen.findByText('Please log in')).toBeInTheDocument();
});
```

## Storage Upload Timeouts

```typescript
it('handles upload failure', async () => {
  mockSupabase.storage.from.mockReturnValue({
    upload: vi.fn().mockRejectedValue(new Error('Network Timeout'))
  });

  const result = await uploadFile(file);
  expect(result.error).toBeDefined();
});
```
