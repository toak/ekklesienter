import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PresentationSelector from '../library/PresentationSelector';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { useLiveQuery } from 'dexie-react-hooks';

// Mock dependencies
vi.mock('@/features/presenter/store/presentationStore', () => ({
  usePresentationStore: vi.fn(),
}));

vi.mock('@/core/store/modalStore', () => ({
  useModalStore: vi.fn().mockReturnValue({ openModal: vi.fn() }),
  ModalType: { CONFIRM: 'CONFIRM' },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn(),
}));

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      bulkGet: vi.fn(),
      get: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
    },
    serviceFiles: {
      get: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('PresentationSelector', () => {
  const mockSetActivePresentation = vi.fn();
  const mockCreatePresentation = vi.fn();

  const defaultStoreState = {
    activeService: { id: 's1', presentationIds: ['p1'] },
    activeServiceId: 's1',
    activePresentation: { id: 'p1', name: 'Pres 1', slides: [] },
    activePresentationId: 'p1',
    setActivePresentation: mockSetActivePresentation,
    createPresentation: mockCreatePresentation,
    renamePresentation: vi.fn(),
    removePresentation: vi.fn(),
    setActiveService: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (usePresentationStore as any).mockReturnValue(defaultStoreState);
    (useLiveQuery as any).mockReturnValue([
      { id: 'p1', name: 'Pres 1', slides: [] },
      { id: 'p2', name: 'Another Pres', slides: [{}, {}] },
    ]);
  });

  it('renders trigger button with active presentation name', () => {
    render(<PresentationSelector />);
    // There should be exactly one 'Pres 1' (in the trigger)
    expect(screen.getAllByText('Pres 1')).toHaveLength(1);
    expect(screen.getByText(/0 slides/i)).toBeTruthy();
  });

  it('opens dropdown on click', async () => {
    render(<PresentationSelector />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByPlaceholderText('search_presentations')).toBeTruthy();
    // One in trigger, one in list
    expect(screen.getAllByText('Pres 1')).toHaveLength(2);
    expect(screen.getByText('Another Pres')).toBeTruthy();
  });

  it('filters presentations by search', async () => {
    render(<PresentationSelector />);
    fireEvent.click(screen.getByRole('button'));

    const input = screen.getByPlaceholderText('search_presentations');
    fireEvent.change(input, { target: { value: 'Another' } });

    // 'Pres 1' should only be in trigger now
    expect(screen.getAllByText('Pres 1')).toHaveLength(1);
    expect(screen.getByText('Another Pres')).toBeTruthy();
  });

  it('calls setActivePresentation when a presentation is clicked', async () => {
    render(<PresentationSelector />);
    fireEvent.click(screen.getByRole('button'));

    const presItem = screen.getByText('Another Pres');
    fireEvent.click(presItem);

    expect(mockSetActivePresentation).toHaveBeenCalledWith('p2');
  });

  it('shows "Select Service First" when no active service', () => {
    (usePresentationStore as any).mockReturnValue({
      ...defaultStoreState,
      activeService: null,
      activeServiceId: null,
    });
    (useLiveQuery as any).mockReturnValue([]);

    render(<PresentationSelector />);
    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('select_service_first')).toBeDefined();
  });
});
