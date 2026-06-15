import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/core/db';
import { useBibleStore } from '@/features/bible-browser/store/bibleStore';
import { useShallow } from 'zustand/react/shallow';
import BibleManager from './BibleManager';
import { AlertCircle, Database, Trash2, Info, Layers, Cpu } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import DropdownSelector from '@/shared/ui/DropdownSelector';

const DataSettings: React.FC = () => {
    const { t } = useTranslation();
    const openModal = useModalStore(state => state.openModal);
    const { secondTranslationId, setSecondTranslation } = useBibleStore(useShallow(state => ({
        secondTranslationId: state.secondTranslationId,
        setSecondTranslation: state.setSecondTranslation
    })));
    const translations = useLiveQuery(() => db.translations.toArray()) || [];

    const reindexProgress = useLiveQuery(
        () => db.settings.get('reindex_progress').then(s => s?.value as { indexed: number; total: number } | undefined),
        []
    );

    const progressPercent = reindexProgress
        ? Math.round((reindexProgress.indexed / reindexProgress.total) * 100)
        : 0;

    const handleReset = async () => {
        openModal(ModalType.CONFIRM, {
            title: t('reset_database'),
            message: t('reset_db_confirm'),
            variant: 'danger',
            onSelection: async (confirmed: boolean) => {
                if (confirmed) {
                    await db.delete();
                    window.location.reload();
                }
            }
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Verse Indexing Progress Banner */}
            {reindexProgress && (
                <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-accent/15 rounded-xl shrink-0">
                            <Cpu className="w-4 h-4 text-accent animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-accent">
                                {t('indexing_verses', 'Indexing verses for search…')}
                            </p>
                            <p className="text-[10px] text-stone-500 font-medium mt-0.5">
                                {reindexProgress.indexed.toLocaleString()} / {reindexProgress.total.toLocaleString()} {t('verses_processed', { count: reindexProgress.total, defaultValue: 'verses processed' })}
                            </p>
                        </div>
                        <span className="text-xs font-black text-accent tabular-nums shrink-0">
                            {progressPercent}%
                        </span>
                    </div>
                    <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Main Data Section */}
            <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-2 bg-stone-800 rounded-xl">
                        <Database className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('bible_translations')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('data_management_desc')}</p>
                    </div>
                </div>

                {/* Bible Manager Content */}
                <BibleManager />
            </div>

            {/* Multi-translation Selection */}
            <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-stone-800 rounded-xl">
                        <Layers className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('secondary_translation')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('secondary_translation_desc')}</p>
                    </div>
                </div>

                <div className="relative z-10">
                    <DropdownSelector
                        value={secondTranslationId || ''}
                        onChange={(val) => setSecondTranslation(val || null)}
                        options={[
                            { value: '', label: t('none') },
                            ...translations.map(tr => ({
                                value: tr.id,
                                label: `${tr.name} (${tr.id})`
                            }))
                        ]}
                    />
                </div>
            </div>

            {/* Danger Zone Card */}
            <div className="bg-red-950/10 border border-red-900/20 rounded-3xl p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-red-500/10 transition-colors" />

                <div className="flex items-start justify-between gap-6 relative z-10">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-900/20 rounded-xl shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-lg font-bold text-red-100 tracking-tight">{t('danger_zone')}</h3>
                            <p className="text-xs text-red-900/80 font-medium mt-1 leading-relaxed">
                                {t('reset_database_desc')}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleReset}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-900/40 flex items-center gap-2 shrink-0 active:scale-95"
                    >
                        <Trash2 className="w-4 h-4" />
                        {t('reset_database')}
                    </button>
                </div>

                <div className="mt-6 p-3 bg-red-950/30 rounded-xl border border-red-900/20 flex items-center gap-3 relative z-10">
                    <Info className="w-4 h-4 text-red-400 shrink-0" />
                    <p className="text-[10px] text-red-300/70 font-medium italic">
                        {t('data_reset_warning')}
                    </p>
                </div>
            </div>

        </div>
    );
};

export default DataSettings;
