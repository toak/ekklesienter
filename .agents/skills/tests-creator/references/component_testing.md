# Component Testing Patterns

Use React Testing Library (RTL) with Vitest.

## Core Principles

- **Test Behavior, Not implementation**: Favor `findByRole`, `findByText` over querying by class names.
- **Mock Stores**: Always mock Zustand/Jotai stores to control the component state.
- **Handle Animations**: Mock `framer-motion` to avoid async issues with transitions.

## Example: Mocking Zustand & RTL

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UserProfile } from './UserProfile';
import { useUserStore } from '@/core/store/userStore';
import { vi } from 'vitest';

vi.mock('@/core/store/userStore');

describe('UserProfile', () => {
  it('renders user name from store', () => {
    (useUserStore as any).mockReturnValue({
      user: { name: 'John Doe' },
      loading: false
    });

    render(<UserProfile />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useUserStore as any).mockReturnValue({
      user: null,
      loading: true
    });

    render(<UserProfile />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });
});
```

## Framer Motion Mocking

In your `vitest.setup.ts`, include:

```ts
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    // Add other elements as needed
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));
```
