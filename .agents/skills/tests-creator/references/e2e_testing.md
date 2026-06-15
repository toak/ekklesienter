# E2E Testing Patterns

Use Playwright for end-to-end testing across Web, TMA, and Electron.

## Core Principles

- **User-Centric**: Only interact with elements users can see.
- **Traceability**: Record traces/videos for debugging.
- **Environment Isolation**: use `test.use({ colorScheme: 'dark' })` and specific viewports.

## Web/TMA Testing

```typescript
import { test, expect } from '@playwright/test';

test('completes onboarding flow', async ({ page }) => {
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Get Started' }).click();
  await page.getByLabel('User Name').fill('Tester');
  await page.getByRole('button', { name: 'Submit' }).click();
  
  await expect(page.getByText('Welcome, Tester')).toBeVisible();
});
```

## Electron Testing

Playwright supports Electron out of the box:

```typescript
import { _electron as electron } from '@playwright/test';
import { test, expect } from '@playwright/test';

test('opens main window', async () => {
  const electronApp = await electron.launch({ args: ['main.js'] });
  const window = await electronApp.firstWindow();
  
  expect(await window.title()).toBe('Ekklesia Enter');
  await electronApp.close();
});
```

## TMA Mocking in E2E

Since TMA relies on `window.Telegram`, you can inject a mock script during `page.goto`:

```ts
await page.addInitScript(() => {
  window.Telegram = {
    WebApp: {
      ready: () => {},
      close: () => {},
      // ...
    }
  };
});
```
