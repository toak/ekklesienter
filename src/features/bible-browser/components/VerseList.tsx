import React, { useMemo, useEffect, useRef, useState } from 'react';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { Verse } from '@/core/types';
import { List, Edit, CheckCircle2, Trash2, Plus } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import VerseEditor from './VerseEditor';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import TranslationPicker from '@/shared/ui/TranslationPicker';
import { getBookName } from '@/core/data/bookData';
import { cn } from '@/core/utils/cn';
import { processChildren } from '@/core/utils/markdownUtils';

interface VerseItemProps {
  verse: Verse;
  isActive: boolean;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: (verse: Verse, event: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: (verse: Verse) => void;
  onContextMenu: (e: React.MouseEvent, verseId: number) => void;
}

const VerseItem = React.memo(({
  verse, isActive, isSelected, isDragging,
  onSelect, onMouseDown, onMouseEnter, onContextMenu,
}: VerseItemProps) => {
  const itemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [isActive]);

  return (
    <button
      ref={itemRef}
      onMouseDown={onMouseDown}
      onClick={(e) => onSelect(verse, e)}
      onMouseEnter={() => onMouseEnter(verse)}
      onContextMenu={(e) => { if (verse.id) onContextMenu(e, verse.id); }}
      className={cn(
        'group w-full text-left p-4 transition-all duration-300 relative focus:outline-none border-b border-white/5 select-none',
        isActive && !isSelected && 'bg-accent/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
        isSelected && !isActive && 'bg-accent/20',
        isSelected && isActive && 'bg-accent/25',
        !isActive && !isSelected && !isDragging && 'hover:bg-white/5',
      )}
    >
      <div className="flex gap-4 pointer-events-none">
        <div className={cn(
          'flex flex-col items-center min-w-8 pt-1 transition-colors duration-300',
          isActive || isSelected ? 'text-accent' : 'text-stone-600 group-hover:text-stone-400',
        )}>
          <span className="text-[10px] font-black font-sans tracking-tighter opacity-80 mb-1">
            {verse.verseNumber}
          </span>
          {(isActive || isSelected) && (
            <div className={cn(
              'w-1.5 h-1.5 rounded-full bg-accent shadow-glow transition-all',
              isSelected && !isActive && 'opacity-60 scale-75',
            )} />
          )}
        </div>
        <div className={cn(
          'flex-1 font-serif text-lg leading-relaxed transition-colors duration-300',
          isActive || isSelected ? 'text-stone-100' : 'text-stone-400 group-hover:text-stone-200',
        )}>
          <ReactMarkdown
            components={{
              strong: ({ children }) => (
                <span className={cn('font-bold', isActive ? 'text-accent/90' : 'text-stone-200')}>
                  {processChildren(children)}
                </span>
              ),
              p: ({ children }) => <span>{processChildren(children)}</span>,
              em: ({ children }) => <em className="italic opacity-90">{processChildren(children)}</em>,
            }}
          >
            {verse.text}
          </ReactMarkdown>
        </div>
      </div>
      <div className={cn(
        'absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all duration-300',
        isActive ? 'bg-accent opacity-100 scale-y-100 shadow-glow'
          : isSelected ? 'bg-accent opacity-60 scale-y-90'
            : 'bg-accent opacity-0 scale-y-50',
      )} />
    </button>
  );
}, (prev, next) =>
  prev.verse.id === next.verse.id &&
  prev.verse.text === next.verse.text &&
  prev.isActive === next.isActive &&
  prev.isSelected === next.isSelected &&
  prev.isDragging === next.isDragging
);

const VerseList: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    activeVerse,
    clickVerse,
    commitToProjector,
    currentBookId,
    currentChapter,
    updateVerseText,
    currentTranslationId,
    secondTranslationId,
    setSecondTranslation,
    navigateNext,
    navigatePrev,
    selectedVerses,
    setSelectedVerses,
    toggleVerseSelection,
    selectVerseRange,
    isMultiVerseMode,
    projectorIsLive,
    exitMultiVerseMode,
    lastClickedVerseId,
    setLastClickedVerseId,
  } = useBibleStore();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; verseId: number } | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartVerse, setDragStartVerse] = useState<Verse | null>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const verses = useLiveQuery(
    () => db.verses
      .where('[translationId+bookId+chapter]')
      .equals([currentTranslationId, currentBookId, currentChapter])
      .sortBy('verseNumber'),
    [currentTranslationId, currentBookId, currentChapter]
  ) || [];

  const lang = useMemo(() => i18n.language?.substring(0, 2) || 'en', [i18n.language]);

  // ─── Keyboard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId !== null) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        commitToProjector();
        return;
      }

      if (isMultiVerseMode || selectedVerses.length >= 2) {
        if (e.key.startsWith('Arrow')) return;
      }

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNext();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePrev();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editingId, selectedVerses, isMultiVerseMode, commitToProjector, navigateNext, navigatePrev]);

  // ─── Clicks ───────────────────────────────────────────────────────────────
  const handleSelect = (verse: Verse, e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      toggleVerseSelection(verse);
      setLastClickedVerseId(verse.id || null);
      return;
    }
    if (e.shiftKey && lastClickedVerseId) {
      const lastVerse = verses.find(v => v.id === lastClickedVerseId);
      if (lastVerse) selectVerseRange(lastVerse, verse, verses);
      return;
    }

    // Plain click — exits multiverse if needed, updates preview (and projector if live)
    if (isMultiVerseMode) exitMultiVerseMode();
    clickVerse(verse);
    setLastClickedVerseId(verse.id || null);
  };

  // ─── Drag ─────────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent, verse: Verse) => {
    if (e.button !== 0) return;

    // Clear any existing timeout
    if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);

    // Only start dragging if the user holds the button for more than 100ms.
    // This prevents accidental dragging during simple clicks.
    dragTimeoutRef.current = setTimeout(() => {
      setDragStartVerse(verse);
      setIsDragging(true);
      dragTimeoutRef.current = null;
    }, 100);

    // We do NOT call e.preventDefault() here anymore because it prevents 
    // the 'onClick' event from firing, which we use for selection.
  };

  const handleMouseEnter = (verse: Verse) => {
    if (isDragging && dragStartVerse) {
      selectVerseRange(dragStartVerse, verse, verses);
    }
  };

  useEffect(() => {
    const up = () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      setIsDragging(false);
      setDragStartVerse(null);
    };
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mouseup', up);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
    };
  }, []);

  const handleSave = async (newText: string) => {
    if (editingId !== null) {
      const verse = verses.find(v => v.id === editingId);
      if (verse) await updateVerseText(verse, newText);
      setEditingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-900/40 backdrop-blur-xl border-r border-white/5 overflow-hidden">
      <div className="p-4 border-b border-white/5 flex justify-between items-center bg-stone-950/20 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-accent/20 rounded-lg">
            <List className="w-4 h-4 text-accent" />
          </div>
          <h2 className="font-bold text-stone-200 text-sm uppercase">{t('verses')}</h2>
        </div>
        <div className="px-2 py-0.5 bg-white/5 rounded-full">
          <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">{verses.length}</span>
        </div>
      </div>

      <div className={cn('flex-1 overflow-y-auto no-scrollbar relative', isDragging && 'select-none')}>
        {verses.map((verse) =>
          editingId === verse.id ? (
            <VerseEditor
              key={`editor-${verse.id}`}
              verse={verse}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <VerseItem
              key={`${verse.bookId}-${verse.chapter}-${verse.verseNumber}`}
              verse={verse}
              isActive={activeVerse?.id === verse.id}
              isSelected={selectedVerses.some(v => v.id === verse.id)}
              isDragging={isDragging}
              onSelect={handleSelect}
              onMouseDown={(e) => handleMouseDown(e, verse)}
              onMouseEnter={handleMouseEnter}
              onContextMenu={(e, id) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, verseId: id }); }}
            />
          )
        )}

        {verses.length === 0 && (
          <div className="py-20 text-center space-y-3">
            <List className="w-10 h-10 text-stone-800 mx-auto" strokeWidth={1} />
            <p className="text-sm text-stone-600 italic">{t('no_verses_found', 'No verses found for this chapter')}</p>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/5 bg-stone-950/40 relative z-30">
        {secondTranslationId ? (
          <div className="group relative">
            <button
              ref={triggerRef}
              onClick={() => { if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect()); setIsPickerOpen(true); }}
              className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 transition-all group active:scale-95 shadow-xl shadow-black/20"
            >
              <div className="min-w-10 h-8 px-2 rounded-xl bg-accent flex items-center justify-center border border-accent/20 shadow-lg shadow-accent/10 shrink-0">
                <span className="text-[10px] font-black text-accent-foreground uppercase">{secondTranslationId}</span>
              </div>
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-[10px] font-bold text-stone-300 uppercase leading-none truncate group-hover:text-white transition-colors">
                  {currentBookId ? getBookName(currentBookId, lang) : '-'}
                </span>
                <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest mt-1 truncate group-hover:text-stone-400">
                  {currentChapter ? `${t('chapter')} ${currentChapter}` : '-'}
                </span>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setSecondTranslation(null); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-stone-950/50 hover:bg-red-500/20 text-stone-600 hover:text-red-400 rounded-lg transition-all opacity-0 group-hover:opacity-100 shadow-xl"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            ref={triggerRef}
            onClick={() => { if (triggerRef.current) setTriggerRect(triggerRef.current.getBoundingClientRect()); setIsPickerOpen(true); }}
            className="w-full h-[60px] flex items-center gap-3 p-3 rounded-2xl bg-stone-900/40 border border-dashed border-white/10 hover:border-accent/40 hover:bg-accent/5 transition-all group active:scale-95"
          >
            <div className="w-10 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0 group-hover:bg-accent/10 group-hover:border-accent/20 transition-all">
              <Plus className="w-4 h-4 text-stone-600 group-hover:text-accent" />
            </div>
            <div className="text-left">
              <span className="text-[10px] font-bold text-stone-600 uppercase tracking-widest leading-none group-hover:text-stone-400 transition-colors">
                {t('multi_translation', 'Multi-Translation')}
              </span>
              <p className="text-[9px] text-stone-700 uppercase tracking-wider font-bold mt-1">
                {t('multi_select_hint', 'Show side-by-side')}
              </p>
            </div>
          </button>
        )}
        {isPickerOpen && (
          <TranslationPicker
            title={t('select_second_translation', 'Second Translation')}
            currentTranslationId={secondTranslationId}
            onSelect={setSecondTranslation}
            onClose={() => setIsPickerOpen(false)}
            triggerRect={triggerRect}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          <ContextMenuItem
            icon={<Edit className="w-4 h-4" />}
            label={t('edit_verse', 'Edit Verse')}
            onClick={() => { setEditingId(contextMenu.verseId); setContextMenu(null); }}
          />
        </ContextMenu>
      )}
    </div>
  );
};

export default VerseList;
