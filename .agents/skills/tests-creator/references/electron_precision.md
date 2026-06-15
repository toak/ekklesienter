# Electron Precision Testing

Techniques for mocking IPC, main process logic, and hardware abstractions in a Vitest environment.

## IPC Bridge Mocking (Renderer Side)

Mock the `window.electron` object injected by `preload.ts`.

```typescript
import { vi, beforeEach } from 'vitest';

export const setupElectronMocks = () => {
  const electronMock = {
    ipcRenderer: {
      send: vi.fn(),
      on: vi.fn(() => vi.fn()), // Return unsubscribe function
      off: vi.fn(),
      invoke: vi.fn(),
    }
  };
  
  vi.stubGlobal('electron', electronMock);
  return electronMock;
};
```

## Main Process Testing (Node Side)

Test logic in `electron/main.ts` or related services without starting the full Electron app.

### Mocking Electron Modules

```typescript
import { vi, describe, it, expect } from 'vitest';

// Must mock before importing the target file if it uses these at top-level
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/mock/user/data'),
    isPackaged: false,
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadURL: vi.fn(),
    loadFile: vi.fn(),
    webContents: {
      send: vi.fn(),
      on: vi.fn(),
    },
    on: vi.fn(),
  })),
  screen: {
    getAllDisplays: vi.fn().mockReturnValue([{ id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1080 } }]),
    on: vi.fn(),
  },
  protocol: {
    registerSchemesAsPrivileged: vi.fn(),
    handle: vi.fn(),
  }
}));

import { seedBundledTemplates } from '../main';
import fs from 'fs';

vi.mock('fs');

it('seeds templates if they do not exist', () => {
  (fs.existsSync as any).mockReturnValue(false);
  seedBundledTemplates();
  expect(fs.copyFileSync).toHaveBeenCalled();
});
```

## Advanced IPC Relay Pattern

Test patterns where Renderer A sends to Main, and Main broadcasts to Renderer B.

```typescript
it('relays projector-command to projectorWindow', () => {
  const { ipcMain } = require('electron');
  const commandHandler = ipcMain.on.mock.calls.find(call => call[0] === 'projector-command')[1];
  
  const mockEvent = {};
  commandHandler(mockEvent, 'slide-change', { id: '123' });
  
  // Verify main process sends to projector window
  expect(mockProjectorWindow.webContents.send).toHaveBeenCalledWith('projector-command', 'slide-change', { id: '123' });
});
```

## Protocol & Resource Testing

Mock `protocol.handle` or `net.fetch` for custom schemes.

```typescript
vi.mock('electron', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    net: {
      fetch: vi.fn().mockResolvedValue(new Response('mock-data')),
    }
  };
});
```
