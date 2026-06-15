# TMA Precision Testing

Mocking the Telegram Mini App environment and SDK.

## Initial Data Mocking

```typescript
import { vi } from 'vitest';

vi.mock('@telegram-apps/sdk', () => ({
  useLaunchParams: () => ({
    initData: {
      user: { id: 123, firstName: 'Test', username: 'tester' },
      queryId: 'abc'
    },
    platform: 'android',
    themeParams: { backgroundColor: '#ffffff' }
  }),
  useHapticFeedback: () => ({
    impactOccurred: vi.fn(),
    notificationOccurred: vi.fn(),
  }),
  useMiniApp: () => ({
    close: vi.fn(),
    ready: vi.fn(),
  })
}));
```

## Simulation Themes

Test UI responsiveness to Telegram system themes.

```tsx
it('applies dark theme background', () => {
  (useLaunchParams as any).mockReturnValue({
    themeParams: { backgroundColor: '#000000' }
  });
  
  render(<MyComponent />);
  const container = screen.getByTestId('tma-container');
  expect(container).toHaveStyle({ backgroundColor: '#000000' });
});
```

## Cloud Storage Mocks

```typescript
export const mockCloudStorage = {
  set: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue('mock-value'),
  delete: vi.fn().mockResolvedValue(undefined),
};
```
