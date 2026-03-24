import { vi } from 'vitest';

// STUBS MUST BE FIRST
vi.stubGlobal('electron', {
  ipcRenderer: {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
  }
});

import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Use vi.hoisted to ensure the mock object is available for vi.mock
const { mockPresentationStore } = vi.hoisted(() => ({
  mockPresentationStore: {
    activePresentationId: 'p1',
    presentation: { id: 'p1', slides: [] },
    selectedSlideIds: [],
    setSelectedSlideIds: vi.fn(),
    setPreviewSlide: vi.fn(),
    toggleSlideSelection: vi.fn(),
    activePresentation: { id: 'p1', slides: [] },
    previewSlideId: null,
    selectedPresentationId: 'p1',
    liveSlideId: null,
    copySlides: vi.fn(),
    pasteSlides: vi.fn(),
    selectAudioScope: vi.fn(),
    duplicateSlide: vi.fn(),
    duplicateSlides: vi.fn(),
    removeSlides: vi.fn(),
    removeSlide: vi.fn(),
    moveSlide: vi.fn(),
    toggleSlideExpansion: vi.fn(),
  }
}));

vi.mock('@/features/presenter/store/presentationStore', () => ({
  usePresentationStore: vi.fn((selector: any) => selector ? selector(mockPresentationStore) : mockPresentationStore),
}));

vi.mock('@/features/presenter/store/presenterStore', () => ({
  usePresenterStore: vi.fn(() => ({})),
  DEFAULT_SETTINGS: {},
}));

vi.mock('@/core/store/modalStore', () => ({
  useModalStore: vi.fn(() => ({
    openModal: vi.fn(),
  })),
  ModalType: {
    BIBLE_SELECTION: 'BIBLE_SELECTION',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
    i18n: { language: 'en' },
  }),
}));

vi.mock('jotai', () => ({
  atom: vi.fn((val) => ({ initialValue: val })),
  useAtom: vi.fn((atom) => [atom?.initialValue, vi.fn()]),
  useSetAtom: vi.fn(() => vi.fn()),
  useAtomValue: vi.fn((atom) => atom?.initialValue),
}));

vi.mock('@/core/store/uiAtoms', () => ({
  appModeAtom: { initialValue: 'presentation' },
  isTimelineHoveredAtom: { initialValue: false },
  slideDesignPanelOpenAtom: { initialValue: false },
  slideDesignTabAtom: { initialValue: 'design' },
  selectedTransitionSlideIdAtom: { initialValue: null },
  selectedCanvasItemIdsAtom: { initialValue: [] },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: vi.fn((fn) => {
    try {
      const res = fn();
      if (res && typeof res.then === 'function') return [];
      return res || [];
    } catch {
      return [];
    }
  }),
}));

vi.mock('@/core/db', () => ({
  db: {
    presentationFiles: {
      get: vi.fn(),
      toArray: vi.fn().mockReturnValue([]),
    },
    blocks: {
      toArray: vi.fn().mockReturnValue([]),
    },
    templates: {
      toArray: vi.fn().mockReturnValue([]),
    },
  },
}));

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
  PointerSensor: {},
  DragOverlay: ({ children }: any) => <div>{children}</div>,
  useDroppable: vi.fn(() => ({ isOver: false, setNodeRef: vi.fn() })),
  closestCenter: vi.fn(),
  closestCorners: vi.fn(),
  defaultDropAnimationSideEffects: vi.fn(() => ({})),
  MeasuringStrategy: { Always: 0 },
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  horizontalListSortingStrategy: {},
}));

vi.mock('../slide-editor/SlideContentRenderer', () => ({
  default: () => <div data-testid="slide-renderer" />,
}));

vi.mock('./TrackContainer', () => {
  const React = require('react');
  return {
    default: React.forwardRef(({ children }: any, ref: any) => <div ref={ref}>{children}</div>),
  };
});

// Now import the component
import SlideTimeline from '../timeline/SlideTimeline';
import { db } from '@/core/db';

describe('SlideTimeline', () => {
  const mockSlides = [
    { id: 's1', order: 0, blockId: 'b1', templateId: 't1', type: 'normal', content: { variables: {} } },
    { id: 's2', order: 1, blockId: 'b1', templateId: 't1', type: 'normal', content: { variables: {} } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPresentationStore, {
      activePresentationId: 'p1',
      presentation: { id: 'p1', slides: mockSlides },
      selectedSlideIds: [],
      setSelectedSlideIds: vi.fn(),
      setPreviewSlide: vi.fn(),
      toggleSlideSelection: vi.fn(),
      activePresentation: { id: 'p1', slides: mockSlides },
      liveSlideId: null,
      previewSlideId: null,
      selectedPresentationId: 'p1',
    });
  });

  it('should render slides in the timeline', async () => {
    render(<SlideTimeline />);
    // Wait for the slides to be rendered after the useEffect
    const slideItems = await screen.findAllByTestId('slide-renderer');
    expect(slideItems.length).toBe(mockSlides.length);
  });

  it('should select a slide on click', async () => {
    const setPreviewSlide = vi.fn();
    Object.assign(mockPresentationStore, {
      setPreviewSlide,
    });

    render(<SlideTimeline />);
    const slideItems = await screen.findAllByTestId('slide-renderer');
    const slide = slideItems[0].closest('div[data-slide-id]');
    if (slide) {
      fireEvent.click(slide);
    }
    
    expect(setPreviewSlide).toHaveBeenCalledWith(mockSlides[0].id, 'p1');
  });

  it('should render "LIVE" badge for the live slide', async () => {
    Object.assign(mockPresentationStore, {
      presentation: { id: 'p1', slides: mockSlides },
      activePresentation: { id: 'p1', slides: mockSlides },
      liveSlideId: 's1',
    });

    render(<SlideTimeline />);
    expect(await screen.findByText('LIVE')).toBeDefined();
  });

  it('should call addPresentationToTimeline when a presentation is dropped from library', async () => {
    const addPresentationToTimeline = vi.fn();
    Object.assign(mockPresentationStore, {
      addPresentationToTimeline,
    });

    const { container } = render(<SlideTimeline />);
    
    // The first child of data-timeline-root is the TimelineDroppableZone
    const root = container.querySelector('[data-timeline-root]');
    const droppable = root?.querySelector('.absolute.inset-0.z-40'); // Selector for TimelineDroppableZone
    
    if (!droppable) throw new Error('Droppable zone not found');

    const dropData = {
      source: 'presentation-library',
      presentationId: 'new-p1'
    };

    fireEvent.drop(droppable, {
      dataTransfer: {
        getData: (type: string) => type === 'application/json' ? JSON.stringify(dropData) : '',
        types: ['application/json']
      },
      clientX: 50,
    });

    expect(addPresentationToTimeline).toHaveBeenCalledWith('new-p1', expect.any(Number));
  });

  it('should render "Sync" badge when nested presentation is out of sync', async () => {
    const lastSyncedAt = '2026-01-01T00:00:00Z';
    const newerUpdatedAt = new Date('2026-01-02T00:00:00Z');
    
    const masterSlide = { 
      id: 's-master', 
      order: 0, 
      blockId: 'master-presentation', 
      templateId: 't1', 
      type: 'normal',
      content: { variables: {} },
      masterPresentationId: 'snap-p1',
      linkedPresentationId: 'lib-p1',
      lastSyncedAt
    };

    Object.assign(mockPresentationStore, {
      presentation: { id: 'p1', slides: [masterSlide] },
      activePresentation: { id: 'p1', slides: [masterSlide] },
    });

    // Mock db.presentationFiles.toArray to include the library presentation
    (db.presentationFiles.toArray as any).mockReturnValue([{
      id: 'lib-p1',
      updatedAt: newerUpdatedAt
    }]);

    render(<SlideTimeline />);
    
    expect(await screen.findByText('Sync')).toBeDefined();
  });
});
