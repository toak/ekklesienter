# Framer Motion Precision Testing

Handling animations and staggered layouts in Vitest.

## Global Motion Mock

Mocking `framer-motion` to run synchronously avoids flakey tests caused by animation timings.

```tsx
import { vi } from 'vitest';

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
      // Add more as needed
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useAnimation: () => ({
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    }),
  };
});
```

## Testing Staggered Layouts

If you need to test that items appear sequentially:

```tsx
it('renders items in order', async () => {
  render(<AnimatedList items={['A', 'B']} />);
  
  // Use findByText to wait for items if they are delayed
  expect(await screen.findByText('A')).toBeInTheDocument();
  expect(await screen.findByText('B')).toBeInTheDocument();
});
```

## Accessibility and Labels

Animations often hide content. Ensure your tests verify that `aria-hidden` is correctly toggled if relevant.

```tsx
expect(screen.getByRole('dialog')).toHaveAttribute('aria-hidden', 'false');
```
