import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, LayoutTemplate, Presentation, Music } from 'lucide-react';
import { GraceLibBin } from '@/features/presenter/components/library/GraceLibBin';

interface GraceLibPanelProps {
  graceLibSection: 'templates' | 'presentations' | 'media';
  onSetGraceLibSection: (section: 'templates' | 'presentations' | 'media') => void;
}

export const GraceLibPanel: React.FC<GraceLibPanelProps> = React.memo(({
  graceLibSection,
  onSetGraceLibSection
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-stone-900/40">
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar px-3 py-4 space-y-4">
        <div className="px-1 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-widest flex items-center gap-1.5">
            <Layout className="w-3 h-3" />
            {t('grace_lib', 'GraceLib')}
          </span>
        </div>
        <div className="grid grid-cols-1 gap-2 shrink-0">
          <GraceLibBin
            id="templates"
            name={t('templates', 'Templates')}
            icon={LayoutTemplate}
            isActive={graceLibSection === 'templates'}
            onClick={() => onSetGraceLibSection('templates')}
            description={t('templates_desc', 'Reusable Slide Layouts')}
          />
          <GraceLibBin
            id="presentations"
            name={t('presentations', 'Presentations')}
            icon={Presentation}
            isActive={graceLibSection === 'presentations'}
            onClick={() => onSetGraceLibSection('presentations')}
            description={t('presentations_desc', 'Global .ekt Library')}
          />
          <GraceLibBin
            id="media"
            name={t('media', 'Media')}
            icon={Music}
            isActive={graceLibSection === 'media'}
            onClick={() => onSetGraceLibSection('media')}
            description={t('media_desc', 'Local Assets & Bins')}
          />
        </div>
      </div>
    </div>
  );
});

GraceLibPanel.displayName = 'GraceLibPanel';
