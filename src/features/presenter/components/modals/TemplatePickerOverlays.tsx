import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, Trash2, FolderPlus } from 'lucide-react';
import { ITemplate, IBlock } from '@/core/types';
import { ConfirmState, EMPTY_CONFIRM } from '../../hooks/useTemplatePickerActions';

interface TemplatePickerOverlaysProps {
  isDev: boolean;
  isRu: boolean;
  allBlocks: IBlock[];
  allTemplates: ITemplate[];
  // Naming
  isNamingTemplate: boolean;
  setIsNamingTemplate: (v: boolean) => void;
  namingTargetTemplate: ITemplate | null;
  newName: string;
  setNewName: (v: string) => void;
  newNameRu: string;
  setNewNameRu: (v: string) => void;
  targetBlockId: string | undefined;
  setTargetBlockId: (v: string | undefined) => void;
  confirmSaveTemplate: () => void;
  // Edit Template
  editingTemplate: ITemplate | null;
  setEditingTemplate: (v: ITemplate | null) => void;
  editName: string;
  setEditName: (v: string) => void;
  editNameRu: string;
  setEditNameRu: (v: string) => void;
  editId: string;
  setEditId: (v: string) => void;
  editBackgroundColor: string;
  setEditBackgroundColor: (v: string) => void;
  editCategoryId: string | undefined;
  setEditCategoryId: (v: string | undefined) => void;
  handleUpdateTemplateProperties: () => void;
  // Edit Layout
  editingLayout: { template: ITemplate; slide: { name?: string; nameRu?: string; categoryId?: string } } | null;
  setEditingLayout: (v: null) => void;
  editParentTemplateId: string | undefined;
  setEditParentTemplateId: (v: string | undefined) => void;
  handleUpdateLayoutProperties: () => void;
  // Move Bunch
  movingBunch: { template: ITemplate; sourceBlockId: string } | null;
  setMovingBunch: (v: null) => void;
  handleMoveBunch: (targetBId: string) => void;
  // Block Manager
  showBlockManager: boolean;
  setShowBlockManager: (v: boolean) => void;
  editingBlock: IBlock | null;
  setEditingBlock: (v: IBlock | null) => void;
  isAddingBlock: boolean;
  setIsAddingBlock: (v: boolean) => void;
  blockFormName: string;
  setBlockFormName: (v: string) => void;
  blockFormNameRu: string;
  setBlockFormNameRu: (v: string) => void;
  blockFormColor: string;
  setBlockFormColor: (v: string) => void;
  blockFormIcon: string;
  setBlockFormIcon: (v: string) => void;
  openBlockForm: (block?: IBlock) => void;
  saveBlock: () => void;
  requestDeleteBlock: (block: IBlock) => void;
}

export const TemplatePickerOverlays: React.FC<TemplatePickerOverlaysProps> = (props) => {
  const { t } = useTranslation();

  return (
    <>
      {/* ── Naming Template/Layout Overlay ── */}
      {props.isNamingTemplate && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase mb-4">{props.namingTargetTemplate ? t('name_layout') : t('name_template')}</h3>
            <div className="space-y-3">
              <input autoFocus type="text" value={props.newName} onChange={(e) => props.setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') props.confirmSaveTemplate(); if (e.key === 'Escape') props.setIsNamingTemplate(false); }} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name..." />
              {props.isDev && <input type="text" value={props.newNameRu} onChange={(e) => props.setNewNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название..." />}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('select_block_category')}</label>
                <select value={props.targetBlockId || ''} onChange={(e) => props.setTargetBlockId(e.target.value || undefined)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer">
                  <option value="">{t('no_block')}</option>
                  {props.allBlocks.map(b => (<option key={b.id} value={b.id}>{b.icon} {props.isRu ? b.nameRu : b.name}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => props.setIsNamingTemplate(false)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
              <button type="button" onClick={props.confirmSaveTemplate} disabled={!props.newName.trim()} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer disabled:opacity-50">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Template Properties Overlay ── */}
      {props.editingTemplate && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase mb-4">{t('edit_properties')}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('template_name', 'Name')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <input autoFocus type="text" value={props.editName} onChange={(e) => props.setEditName(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name" />
                  <input type="text" value={props.editNameRu} onChange={(e) => props.setEditNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('template_id', 'File Name / ID')}</label>
                <input type="text" value={props.editId} onChange={(e) => props.setEditId(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-stone-400 focus:border-accent/40 outline-hidden font-mono" placeholder="template-id" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('category', 'Category')}</label>
                  <select value={props.editCategoryId || ''} onChange={(e) => props.setEditCategoryId(e.target.value || undefined)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer">
                    <option value="">{t('no_block')}</option>
                    {props.allBlocks.map(b => (<option key={b.id} value={b.id}>{b.icon} {props.isRu ? b.nameRu : b.name}</option>))}
                  </select>
                </div>
                <div className="shrink-0">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('background', 'Background')}</label>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 min-h-[44px]">
                    <input type="color" value={props.editBackgroundColor} onChange={(e) => props.setEditBackgroundColor(e.target.value)} className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer overflow-hidden p-0" />
                    <span className="text-[10px] font-mono text-stone-500 pr-2">{props.editBackgroundColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => props.setEditingTemplate(null)} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
              <button type="button" onClick={props.handleUpdateTemplateProperties} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Layout Properties Overlay ── */}
      {props.editingLayout && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-stone-800 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase mb-4">{t('edit_layout')}</h3>
            <div className="space-y-3">
              <input autoFocus type="text" value={props.editName} onChange={(e) => props.setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') props.handleUpdateLayoutProperties(); }} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Name" />
              <input type="text" value={props.editNameRu} onChange={(e) => props.setEditNameRu(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden" placeholder="Название" />
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('select_block_category')}</label>
                <select value={props.editCategoryId || ''} onChange={(e) => props.setEditCategoryId(e.target.value || undefined)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer">
                  <option value="">{t('no_block')}</option>
                  {props.allBlocks.map(b => (<option key={b.id} value={b.id}>{b.icon} {props.isRu ? b.nameRu : b.name}</option>))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1 block">{t('move_layout_to_template')}</label>
                <select value={props.editParentTemplateId || props.editingLayout.template.id} onChange={(e) => props.setEditParentTemplateId(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-accent/40 outline-hidden cursor-pointer">
                  {props.allTemplates.filter(t => t.id !== 'blank-dark').map(tmpl => (<option key={tmpl.id} value={tmpl.id}>{props.isRu ? tmpl.nameRu : tmpl.name}{tmpl.id === props.editingLayout!.template.id ? ' ●' : ''}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => { props.setEditingLayout(null); props.setEditParentTemplateId(undefined); }} className="flex-1 px-4 py-2 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
              <button type="button" onClick={props.handleUpdateLayoutProperties} className="flex-1 px-4 py-2 rounded-xl bg-accent text-stone-900 font-bold uppercase text-[10px] cursor-pointer">{t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move Bunch Overlay ── */}
      {props.movingBunch && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-stone-800 border border-white/10 rounded-[24px] w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase mb-4 text-center">{t('move_to_block')}</h3>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar">
              {props.allBlocks.map(block => (
                <button type="button" key={block.id} onClick={() => props.handleMoveBunch(block.id)} className="px-3 py-3 rounded-xl bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/20 transition-all text-left cursor-pointer">
                  <span className="text-[10px] font-black uppercase text-stone-400 hover:text-accent tracking-wider">{block.icon} {props.isRu ? block.nameRu : block.name}</span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => props.setMovingBunch(null)} className="w-full mt-4 px-4 py-2.5 rounded-xl bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
          </div>
        </div>
      )}

      {/* ── Block Manager Overlay ── */}
      {props.showBlockManager && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <div className="bg-stone-800 border border-white/10 rounded-[24px] w-full max-w-md p-6 shadow-2xl max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">{t('manage_blocks')}</h3>
              <button type="button" onClick={() => { props.setShowBlockManager(false); props.setIsAddingBlock(false); props.setEditingBlock(null); }} className="p-1.5 rounded-xl hover:bg-white/5 text-stone-500 hover:text-white transition-colors cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4">
              {props.allBlocks.map(block => (
                <div key={block.id} className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl border border-white/5 group">
                  <span className="text-base shrink-0">{block.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{props.isRu ? block.nameRu : block.name}</p>
                    <p className="text-[9px] text-stone-500 font-medium">{block.id}</p>
                  </div>
                  <div className="w-4 h-4 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: block.color }} />
                  <button type="button" onClick={() => props.openBlockForm(block)} className="p-1.5 rounded-lg hover:bg-white/10 text-stone-500 hover:text-accent opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label={t('edit_block')}><Pencil className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => props.requestDeleteBlock(block)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-stone-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer" aria-label={t('delete_block')}><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {(props.isAddingBlock || props.editingBlock) ? (
              <div className="bg-black/20 rounded-xl border border-white/5 p-4 space-y-3 shrink-0">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-wider">{props.editingBlock ? t('edit_block') : t('add_block')}</h4>
                <div className="flex gap-2">
                  <input type="text" value={props.blockFormName} onChange={(e) => props.setBlockFormName(e.target.value)} placeholder={t('block_name')} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden" autoFocus />
                  <input type="text" value={props.blockFormNameRu} onChange={(e) => props.setBlockFormNameRu(e.target.value)} placeholder={t('block_name_ru')} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">{t('block_icon')}</label>
                    <input type="text" value={props.blockFormIcon} onChange={(e) => props.setBlockFormIcon(e.target.value)} className="w-full min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden text-center" maxLength={4} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">{t('block_color')}</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={props.blockFormColor} onChange={(e) => props.setBlockFormColor(e.target.value)} className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer bg-transparent" />
                      <input type="text" value={props.blockFormColor} onChange={(e) => props.setBlockFormColor(e.target.value)} className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-accent/40 outline-hidden font-mono" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { props.setIsAddingBlock(false); props.setEditingBlock(null); }} className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-stone-400 font-bold uppercase text-[10px] cursor-pointer">{t('cancel')}</button>
                  <button type="button" onClick={props.saveBlock} disabled={!props.blockFormName.trim()} className="flex-1 px-3 py-2 rounded-lg bg-accent text-stone-900 font-bold uppercase text-[10px] disabled:opacity-50 cursor-pointer">{t('save')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => props.openBlockForm()} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-accent/10 border border-dashed border-white/10 hover:border-accent/20 text-stone-400 hover:text-accent text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer">
                <FolderPlus className="w-4 h-4" /> {t('add_block')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
