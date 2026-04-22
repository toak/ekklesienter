import JSZip from 'jszip';
import { IPresentationFile, ISlide, ICanvasSlide } from '@/core/types';

/**
 * Service for importing PowerPoint (.pptx) files and converting them to Ekklesia Presentation (.ektp) format.
 * Currently implemented as a robust placeholder for future XML parsing.
 */
export const PptxImportService = {
    async convert(file: File): Promise<IPresentationFile> {
        const objectUrls: string[] = [];
        try {
            const zip = await JSZip.loadAsync(file);

            // Basic validation of pptx structure
            const presentationXml = zip.file('ppt/presentation.xml');
            if (!presentationXml) {
                throw new Error('Not a valid PowerPoint (.pptx) file');
            }

            // --- Pre-process Media Batch ---
            // Find all media files in the zip and import them in one go
            const mediaFiles = zip.filter((path) => path.startsWith('ppt/media/'));
            const { MediaPersistenceService } = await import('./MediaPersistenceService');
            
            const batchItems: { file: Blob; path: string; type: 'image' | 'audio' | 'video' }[] = [];
            
            for (const mediaFile of mediaFiles) {
                const blob = await mediaFile.async('blob');
                const path = mediaFile.name;
                let type: 'image' | 'audio' | 'video' = 'image';
                const ext = path.split('.').pop()?.toLowerCase();
                if (['mp4', 'webm', 'mov'].includes(ext || '')) type = 'video';
                if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext || '')) type = 'audio';
                
                batchItems.push({ file: blob, path, type });
            }

            const mediaMap = new Map<string, { id: string; blob: Blob }>(); // path -> {id, blob}
            if (batchItems.length > 0) {
                const ids = await MediaPersistenceService.importMediaBatch(
                    batchItems.map(b => ({ file: b.file, path: b.path, type: b.type })),
                    { forceBackground: true }
                );
                
                for (let i = 0; i < batchItems.length; i++) {
                    const id = ids[i];
                    if (id) mediaMap.set(batchItems[i].path, { id, blob: batchItems[i].file });
                }
            }

            // Create a skeleton presentation
            const presentation: IPresentationFile = {
                id: `pptx-${crypto.randomUUID()}`,
                name: file.name.replace('.pptx', ''),
                createdAt: new Date(),
                updatedAt: new Date(),
                slides: [],
                metadata: {
                    speaker: 'Imported from PPTX'
                }
            };

            // 1. Get slide size and slide list from presentation.xml
            const presXmlContent = await presentationXml.async('string');
            const parser = new DOMParser();
            const presDoc = parser.parseFromString(presXmlContent, 'application/xml');

            // Slide size
            const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
            const slideWidth = parseInt(sldSz?.getAttribute('cx') || '12192000');
            const slideHeight = parseInt(sldSz?.getAttribute('cy') || '6858000');

            // Slide IDs
            const sldIdList = presDoc.getElementsByTagName('p:sldId');
            const sldIds = Array.from(sldIdList).map(el => ({
                id: el.getAttribute('r:id'),
                slideId: el.getAttribute('id')
            }));

            // 2. Resolve slide file paths from presentation.xml.rels
            const presRelsXml = zip.file('ppt/_rels/presentation.xml.rels');
            if (!presRelsXml) throw new Error('Missing ppt/_rels/presentation.xml.rels');
            const presRelsContent = await presRelsXml.async('string');
            const presRelsDoc = parser.parseFromString(presRelsContent, 'application/xml');
            const presRelationships = Array.from(presRelsDoc.getElementsByTagName('Relationship'));

            const slideFiles = sldIds.map(sld => {
                const rel = presRelationships.find(r => r.getAttribute('Id') === sld.id);
                return rel ? `ppt/${rel.getAttribute('Target')}` : null;
            }).filter(Boolean) as string[];

            // 3. Coordinate conversion helper (EMU to percentage 0-100)
            const emuToPercentX = (emu: number) => (emu / slideWidth) * 100;
            const emuToPercentY = (emu: number) => (emu / slideHeight) * 100;
            const BASE_WIDTH = 1920;
            const BASE_HEIGHT = 1080;
            const slideHeightPt = slideHeight / 12700;

            // 4. Resolve Theme Colors
            const themeColors: Record<string, string> = {};
            const themeRel = presRelationships.find(r => r.getAttribute('Type')?.endsWith('theme'));
            const themePath = themeRel ? `ppt/${themeRel.getAttribute('Target')}` : 'ppt/theme/theme1.xml';
            const themeFile = zip.file(themePath);
            if (themeFile) {
                const themeXml = await themeFile.async('string');
                const themeDoc = parser.parseFromString(themeXml, 'application/xml');
                const clrScheme = themeDoc.getElementsByTagName('a:clrScheme')[0];
                if (clrScheme) {
                    const colorTags = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
                    for (const tag of colorTags) {
                        const el = clrScheme.getElementsByTagName(`a:${tag}`)[0];
                        if (el) {
                            const srgb = el.getElementsByTagName('a:srgbClr')[0];
                            const sys = el.getElementsByTagName('a:sysClr')[0];
                            if (srgb) themeColors[tag] = `#${srgb.getAttribute('val')}`;
                            else if (sys) themeColors[tag] = `#${sys.getAttribute('lastClr') || (tag.startsWith('lt') ? 'ffffff' : '000000')}`;
                        }
                    }
                }
            }

                // 5. Caches for Layouts and Masters
                const docCache = new Map<string, Document>();
                const getCachedDoc = async (path: string): Promise<Document | null> => {
                    if (docCache.has(path)) return docCache.get(path)!;
                    const file = zip.file(path);
                    if (!file) return null;
                    const content = await file.async('string');
                    const doc = parser.parseFromString(content, 'application/xml');
                    docCache.set(path, doc);
                    return doc;
                };

                const getRels = async (path: string): Promise<Record<string, string>> => {
                    const parts = path.split('/');
                    const fileName = parts.pop();
                    const dir = parts.join('/');
                    const relPath = `${dir}/_rels/${fileName}.rels`;
                    
                    const file = zip.file(relPath);
                    const rels: Record<string, string> = {};
                    if (file) {
                        const content = await file.async('string');
                        const doc = parser.parseFromString(content, 'application/xml');
                        const relEls = doc.getElementsByTagName('Relationship');
                        for (let r = 0; r < relEls.length; r++) {
                            rels[relEls[r].getAttribute('Id') || ''] = relEls[r].getAttribute('Target') || '';
                        }
                    }
                    return rels;
                };

                const resolveColor = (element: Element | undefined | null): string | null => {
                    if (!element) return null;
                    const solidFill = element.getElementsByTagName('a:solidFill')[0];
                    if (!solidFill) return null;

                    const srgbClr = solidFill.getElementsByTagName('a:srgbClr')[0];
                    const schemeClr = solidFill.getElementsByTagName('a:schemeClr')[0];

                    if (srgbClr) {
                        const val = srgbClr.getAttribute('val');
                        return val ? `#${val}` : null;
                    } else if (schemeClr) {
                        const val = schemeClr.getAttribute('val');
                        if (!val) return null;
                        if (themeColors[val]) return themeColors[val];
                        // Hardcoded fallbacks
                        const fallbacks: Record<string, string> = {
                            'bg1': '#ffffff', 'lt1': '#ffffff', 'lt2': '#ffffff',
                            'tx1': '#000000', 'dk1': '#000000', 'dk2': '#000000',
                            'accent1': '#4472c4', 'accent2': '#ed7d31'
                        };
                        return fallbacks[val] || null;
                    }
                    return null;
                };

                const resolveShapeStyleColor = (sp: Element): string | null => {
                    const style = sp.getElementsByTagName('p:style')[0];
                    if (!style) return null;
                    const fontRef = style.getElementsByTagName('a:fontRef')[0];
                    return fontRef ? resolveColor(fontRef) : null;
                };

                // 6. Iterate over slides
            for (let i = 0; i < slideFiles.length; i++) {
                const slidePath = slideFiles[i];
                const slideXml = zip.file(slidePath);
                if (!slideXml) continue;

                const slideContent = await slideXml.async('string');
                const slideDoc = parser.parseFromString(slideContent, 'application/xml');

                const slide: ICanvasSlide = {
                    id: crypto.randomUUID(),
                    type: 'normal',
                    order: i,
                    blockId: 'presentation', // Standard presentation slide type
                    templateId: 'blank',
                    content: {
                        variables: {},
                        canvasItems: []
                    }
                };

                // 5. Handle Relationships for this slide (to find images, layouts)
                const slideRelationships = await getRels(slidePath);

                // Find Layout and Master for inheritance
                let layoutDoc: Document | null = null;
                let masterDoc: Document | null = null;

                const layoutRel = Object.values(slideRelationships).find(t => t.includes('slideLayout'));
                if (layoutRel) {
                    const layoutPath = `ppt/${layoutRel.replace('../', '')}`;
                    layoutDoc = await getCachedDoc(layoutPath);
                    if (layoutDoc) {
                        const layoutRels = await getRels(layoutPath);
                        const masterRel = Object.values(layoutRels).find(t => t.includes('slideMaster'));
                        if (masterRel) {
                            const masterPath = `ppt/${masterRel.replace('../', '')}`;
                            masterDoc = await getCachedDoc(masterPath);
                        }
                    }
                }

                // --- Helpers for this slide ---

                // 1. Resolve Relationship
                const resolveRel = (rId: string | null) => {
                    if (!rId) return null;
                    const target = slideRelationships[rId];
                    if (!target) return null;
                    const mediaPath = target.startsWith('..') ? `ppt/${target.substring(3)}` : `ppt/${target}`;
                    let mediaFile = zip.file(mediaPath);
                    if (!mediaFile) {
                        const fileName = target.split('/').pop();
                        mediaFile = zip.file(`ppt/media/${fileName}`);
                    }
                    if (!mediaFile) return null;
                    return mediaMap.get(mediaPath) || null;
                };

                // 2. Hierarchical Style Inheritor
                const getInheritedShape = (phType: string | null, phIdx: string | null, doc: Document | null): Element | null => {
                    if (!doc) return null;
                    const shapes = doc.getElementsByTagName('p:sp');
                    for (let s = 0; s < shapes.length; s++) {
                        const ph = shapes[s].getElementsByTagName('p:ph')[0];
                        if (ph) {
                            if (phType && ph.getAttribute('type') === phType) return shapes[s];
                            if (phIdx && ph.getAttribute('idx') === phIdx) return shapes[s];
                        }
                    }
                    return null;
                };

                // 3. Image Processor
                const processPic = async (pic: Element, index: number) => {
                    const blip = pic.getElementsByTagName('a:blip')[0];
                    const media = resolveRel(blip?.getAttribute('r:embed'));
                    if (!media) return;

                    const url = URL.createObjectURL(media.blob);
                    objectUrls.push(url);

                    const spPr = pic.getElementsByTagName('p:spPr')[0];
                    const xfrm = spPr?.getElementsByTagName('a:xfrm')[0];
                    const off = xfrm?.getElementsByTagName('a:off')[0];
                    const ext = xfrm?.getElementsByTagName('a:ext')[0];
                    if (!off || !ext) return;

                    const x = emuToPercentX(parseInt(off.getAttribute('x') || '0'));
                    const y = emuToPercentY(parseInt(off.getAttribute('y') || '0'));
                    const w = emuToPercentX(parseInt(ext.getAttribute('cx') || '0'));
                    const h = emuToPercentY(parseInt(ext.getAttribute('cy') || '0'));
                    const rot = parseInt(xfrm?.getAttribute('rot') || '0');

                    slide.content.canvasItems = slide.content.canvasItems || [];
                    slide.content.canvasItems.push({
                        id: crypto.randomUUID(),
                        type: 'image',
                        x: x + w / 2, y: y + h / 2,
                        width: w, height: h,
                        rotation: rot / 60000,
                        zIndex: index,
                        pivotX: 50, pivotY: 50,
                        locked: false, visible: true,
                        fills: [{
                            id: crypto.randomUUID(),
                            type: 'image',
                            opacity: 1, visible: true, blendMode: 'normal',
                            image: { id: media.id, url, source: 'local', isFromDb: true }
                        }],
                        strokes: []
                    });
                };

                // 4. Shape Processor (Text + Backfills)
                const processShape = async (sp: Element, index: number) => {
                    const blipFill = sp.getElementsByTagName('p:blipFill')[0] || sp.getElementsByTagName('a:blipFill')[0];
                    if (blipFill) {
                        await processPic(sp, index);
                        return;
                    }

                    const spPr = sp.getElementsByTagName('p:spPr')[0];
                    const xfrm = spPr?.getElementsByTagName('a:xfrm')[0];
                    const off = xfrm?.getElementsByTagName('a:off')[0];
                    const ext = xfrm?.getElementsByTagName('a:ext')[0];
                    if (!off || !ext) return;

                    const x = emuToPercentX(parseInt(off.getAttribute('x') || '0'));
                    const y = emuToPercentY(parseInt(off.getAttribute('y') || '0'));
                    const w = emuToPercentX(parseInt(ext.getAttribute('cx') || '0'));
                    const h = emuToPercentY(parseInt(ext.getAttribute('cy') || '0'));
                    const rot = parseInt(xfrm?.getAttribute('rot') || '0');

                    const nvPr = sp.getElementsByTagName('p:nvPr')[0];
                    const ph = nvPr?.getElementsByTagName('p:ph')[0];
                    const phType = ph?.getAttribute('type');
                    const phIdx = ph?.getAttribute('idx');

                    const txBody = sp.getElementsByTagName('p:txBody')[0];
                    if (txBody) {
                        const paragraphs = Array.from(txBody.getElementsByTagName('a:p'));
                        let fullText = '';
                        let fontFamily = 'Inter';
                        let ptSize = 18;
                        let textColor: string | null = null;
                        
                        // Vertical Anchor
                        const bodyPr = txBody.getElementsByTagName('a:bodyPr')[0];
                        const anchor = bodyPr?.getAttribute('anchor');
                        let alignVertical: 'top' | 'middle' | 'bottom' = 'middle';
                        if (anchor === 't') alignVertical = 'top';
                        if (anchor === 'b') alignVertical = 'bottom';

                        // Horizontal Alignment (from 1st para)
                        const firstAlgn = paragraphs[0]?.getElementsByTagName('a:pPr')[0]?.getAttribute('algn');
                        let alignHorizontal: 'left' | 'center' | 'right' | 'justify' = 'center';
                        if (firstAlgn === 'l') alignHorizontal = 'left';
                        if (firstAlgn === 'r') alignHorizontal = 'right';
                        if (firstAlgn === 'just') alignHorizontal = 'justify';

                        const lines: string[] = [];
                        for (const para of paragraphs) {
                            let line = '';
                            const runs = Array.from(para.childNodes);
                            for (const node of runs) {
                                const el = node as Element;
                                if (el.tagName === 'a:r') {
                                    const t = el.getElementsByTagName('a:t')[0]?.textContent || '';
                                    line += t;
                                    
                                    // Extract style from the first meaningful run
                                    if (!textColor && t.trim()) {
                                        const rPr = el.getElementsByTagName('a:rPr')[0];
                                        const defRPr = para.getElementsByTagName('a:pPr')[0]?.getElementsByTagName('a:defRPr')[0];
                                        const endParaRPr = para.getElementsByTagName('a:endParaRPr')[0];
                                        
                                        // A. Run/Para Level
                                        textColor = resolveColor(rPr) || resolveColor(defRPr) || resolveColor(endParaRPr);
                                        
                                        // B. Shape Style Level
                                        if (!textColor) textColor = resolveShapeStyleColor(sp);

                                        // C. Placeholder Inheritance (Layout -> Master)
                                        if (!textColor && ph) {
                                            const layoutSp = getInheritedShape(phType, phIdx, layoutDoc);
                                            if (layoutSp) textColor = resolveColor(layoutSp.getElementsByTagName('p:txBody')[0]) || resolveShapeStyleColor(layoutSp);
                                            
                                            if (!textColor) {
                                                const masterSp = getInheritedShape(phType, phIdx, masterDoc);
                                                if (masterSp) textColor = resolveColor(masterSp.getElementsByTagName('p:txBody')[0]) || resolveShapeStyleColor(masterSp);
                                            }
                                        }

                                        // Font sizing and face
                                        const fontEl = rPr || defRPr;
                                        if (fontEl) {
                                            const sz = fontEl.getAttribute('sz');
                                            if (sz) ptSize = parseInt(sz) / 100;
                                            const typeface = fontEl.getElementsByTagName('a:latin')[0]?.getAttribute('typeface');
                                            if (typeface && !typeface.startsWith('+')) fontFamily = typeface;
                                        }
                                    }
                                } else if (el.tagName === 'a:br') {
                                    line += '\n';
                                }
                            }
                            if (line.trim() || line === '') lines.push(line);
                        }
                        fullText = lines.join('\n');

                        if (fullText.trim()) {
                            const scaledFontSize = Math.round(ptSize * (BASE_HEIGHT / slideHeightPt));
                            
                            // Ultimate Fallback for Text Color
                            if (!textColor) textColor = themeColors['tx1'] || themeColors['dk1'] || '#000000';

                            slide.content.canvasItems = slide.content.canvasItems || [];
                            
                            // Check for shape background fill
                            const spFill = resolveColor(spPr);
                            const fills: any[] = [];
                            if (spFill) {
                                fills.push({ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: spFill });
                            }

                            slide.content.canvasItems.push({
                                id: crypto.randomUUID(),
                                type: 'text',
                                x: x + w / 2, y: y + h / 2,
                                width: w, height: h,
                                rotation: rot / 60000,
                                zIndex: index,
                                pivotX: 50, pivotY: 50,
                                locked: false, visible: true,
                                fills, strokes: [],
                                text: {
                                    content: fullText,
                                    fontFamily, fontWeight: 'normal',
                                    fontSize: scaledFontSize || 32,
                                    color: textColor,
                                    textFills: [{ id: crypto.randomUUID(), type: 'color', visible: true, opacity: 1, blendMode: 'normal', color: textColor }],
                                    resizingMode: 'fixed',
                                    alignHorizontal, alignVertical
                                }
                            });
                        }
                    }
                };

                // Handle Background with Hierarchical Inheritance (Slide -> Layout -> Master)
                const resolveBackground = () => {
                    const bgs = [
                        slideDoc.getElementsByTagName('p:bg')[0],
                        layoutDoc?.getElementsByTagName('p:bg')[0],
                        masterDoc?.getElementsByTagName('p:bg')[0]
                    ].filter(Boolean);

                    for (const bg of bgs) {
                        if (!bg) continue;
                        
                        // Check for Image Background
                        const blipFill = bg.getElementsByTagName('p:bgPicProps')[0] || bg.getElementsByTagName('a:blipFill')[0];
                        const blip = blipFill?.getElementsByTagName('a:blip')[0];
                        const rId = blip?.getAttribute('r:embed');
                        if (rId) {
                            // Note: slideRelationships might not have layout/master relations, 
                            // but usually backgrounds are in media folder or relative to the original slide
                            const target = slideRelationships[rId];
                            if (target) {
                                let mediaPath = target.startsWith('..') ? `ppt/${target.substring(3)}` : `ppt/${target}`;
                                let mediaFile = zip.file(mediaPath) || zip.file(`ppt/media/${target.split('/').pop()}`);

                                if (mediaFile) {
                                    const media = mediaMap.get(mediaPath);
                                    if (media) {
                                        const url = URL.createObjectURL(media.blob);
                                        objectUrls.push(url);

                                        slide.content.canvasItems = slide.content.canvasItems || [];
                                        slide.content.canvasItems.unshift({
                                            id: crypto.randomUUID(),
                                            type: 'image',
                                            x: 50, y: 50,
                                            width: 100, height: 100,
                                            rotation: 0,
                                            zIndex: 0,
                                            pivotX: 50, pivotY: 50,
                                            locked: true,
                                            visible: true,
                                            fills: [{
                                                id: crypto.randomUUID(),
                                                type: 'image',
                                                opacity: 1, visible: true, blendMode: 'normal',
                                                image: { id: media.id, url: url, source: 'local', isFromDb: true }
                                            }],
                                            strokes: []
                                        });
                                        return true; // Found and applied image background
                                    }
                                }
                            }
                        }

                        // Check for Solid Color Background
                        const bgPr = bg.getElementsByTagName('p:bgPr')[0];
                        const color = resolveColor(bgPr || bg);
                        if (color) {
                            slide.backgroundOverride = [{
                                id: crypto.randomUUID(),
                                type: 'color',
                                visible: true,
                                opacity: 1,
                                blendMode: 'normal',
                                color,
                            }];
                            return true; // Found and applied color background
                        }
                    }
                    return false;
                };

                resolveBackground();

                // Unified traversal to preserve layering
                const spTree = slideDoc.getElementsByTagName('p:spTree')[0];
                if (spTree) {
                    const children = Array.from(spTree.children);
                    for (let j = 0; j < children.length; j++) {
                        const child = children[j];
                        const tagName = child.tagName;
                        if (tagName === 'p:sp') {
                            await processShape(child, j + 1);
                        } else if (tagName === 'p:pic') {
                            await processPic(child, j + 1);
                        } else if (tagName === 'p:grpSp') {
                            const grpPics = Array.from(child.getElementsByTagName('p:pic'));
                            const grpShapes = Array.from(child.getElementsByTagName('p:sp'));
                            for (const pic of grpPics) await processPic(pic, j + 1);
                            for (const sp of grpShapes) await processShape(sp, j + 1);
                        }
                    }
                }

                presentation.slides.push(slide);
            }

            return presentation;
        } catch (error) {
            console.error('PowerPoint import failed:', error);
            throw error;
        } finally {
            objectUrls.forEach(url => URL.revokeObjectURL(url));
        }
    }
};
