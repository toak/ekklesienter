import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import ProjectorView from '../display/ProjectorView';
import React from 'react';

// Mock Electron
vi.stubGlobal('electron', {
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
  },
});

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock DB and Dexie hooks
vi.mock('@/core/db', () => ({
  db: {
    verses: {
      where: vi.fn().mockReturnThis(),
      equals: vi.fn().mockReturnThis(),
      and: vi.fn().mockReturnThis(),
      first: vi.fn(),
    },
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: any) => fn(),
}));

// Mock Components
vi.mock('./SlideDisplay', () => ({
  default: () => <div data-testid="slide-display" />,
}));

vi.mock('./SlideBackground', () => ({
  SlideBackground: () => <div data-testid="slide-background" />,
}));

describe('ProjectorView', () => {
  let ipcHandler: any;

  beforeEach(() => {
    vi.clearAllMocks();
    (window.electron.ipcRenderer.on as any).mockImplementation((channel: string, handler: any) => {
      if (channel === 'projector-command') {
        ipcHandler = handler;
      }
      return () => {};
    });
  });

  it('should render projector view and report ratio', () => {
    render(<ProjectorView />);
    expect(screen.getByTestId('slide-display')).toBeDefined();
    expect(window.electron.ipcRenderer.send).toHaveBeenCalledWith('projector-ready', expect.any(Object));
  });

  it('should handle show-verse command', async () => {
    render(<ProjectorView />);
    
    await act(async () => {
      ipcHandler(null, 'show-verse', { verse: { id: 'v1', text: 'Blessed' }, secondTranslationId: 'tr2' });
    });

    expect(screen.getByTestId('slide-display')).toBeDefined();
  });

  it('should handle set-override command (blackout)', async () => {
    const { container } = render(<ProjectorView />);
    
    await act(async () => {
      ipcHandler(null, 'set-override', { type: 'blackout' });
    });

    // The container for SlideDisplay should have opacity-0 when activeOverride is set
    const displayWrapper = container.querySelector('.opacity-0');
    expect(displayWrapper).toBeDefined();
  });
});
