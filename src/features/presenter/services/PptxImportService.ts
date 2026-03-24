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

            // 4. Iterate over slides
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

                // 5. Handle Relationships for this slide (to find images)
                const relPath = `ppt/slides/_rels/${slidePath.split('/').pop()}.rels`;
                const relXml = zip.file(relPath);
                const slideRelationships: Record<string, string> = {};
                if (relXml) {
                    const relContent = await relXml.async('string');
                    const relDoc = parser.parseFromString(relContent, 'application/xml');
                    const rels = relDoc.getElementsByTagName('Relationship');
                    for (let r = 0; r < rels.length; r++) {
                        slideRelationships[rels[r].getAttribute('Id') || ''] = rels[r].getAttribute('Target') || '';
                    }
                }

                // Helper to process an image element or fill
                const processPic = async (pic: Element, index: number) => {
                    const blip = pic.getElementsByTagName('a:blip')[0];
                    const rId = blip?.getAttribute('r:embed');
                    if (!rId) return;

                    const target = slideRelationships[rId];
                    if (!target) return;

                    // Targets are relative to the slides folder usually, e.g. ../media/image1.png
                    // We try to find the file in several possible locations within the zip
                    let mediaPath = target.startsWith('..') ? `ppt/${target.substring(3)}` : `ppt/${target}`;
                    let mediaFile = zip.file(mediaPath);

                    if (!mediaFile) {
                        // Fallback: search for the filename in the entire media folder
                        const fileName = target.split('/').pop();
                        mediaPath = `ppt/media/${fileName}`;
                        mediaFile = zip.file(mediaPath);
                    }

                    if (!mediaFile) return;

                    const blob = await mediaFile.async('blob');
                    const mediaId = `pptx-media-${crypto.randomUUID()}`;

                    const { db } = await import('@/core/db');
                    await db.backgrounds.add({
                        id: mediaId,
                        name: `PPTX Image (${mediaPath.split('/').pop()})`,
                        data: blob,
                        mimeType: blob.type
                    });

                    const spPr = pic.getElementsByTagName('p:spPr')[0];
                    const xfrmEl = spPr?.getElementsByTagName('a:xfrm')[0];
                    const offEl = xfrmEl?.getElementsByTagName('a:off')[0] || xfrmEl?.getElementsByTagName('a:chOff')[0];
                    const extEl = xfrmEl?.getElementsByTagName('a:ext')[0] || xfrmEl?.getElementsByTagName('a:chExt')[0];

                    const x = parseInt(offEl?.getAttribute('x') || '0');
                    const y = parseInt(offEl?.getAttribute('y') || '0');
                    const w = parseInt(extEl?.getAttribute('cx') || '0');
                    const h = parseInt(extEl?.getAttribute('cy') || '0');
                    const rot = parseInt(xfrmEl?.getAttribute('rot') || '0');
                    const rotation = rot / 60000;

                    const url = URL.createObjectURL(blob);
                    objectUrls.push(url);

                    const xPct = emuToPercentX(x);
                    const yPct = emuToPercentY(y);
                    const wPct = emuToPercentX(w);
                    const hPct = emuToPercentY(h);

                    slide.content.canvasItems!.push({
                        id: crypto.randomUUID(),
                        type: 'image',
                        x: xPct + wPct / 2,
                        y: yPct + hPct / 2,
                        width: wPct,
                        height: hPct,
                        rotation: rotation,
                        zIndex: index,
                        pivotX: 50,
                        pivotY: 50,
                        locked: false,
                        visible: true,
                        fills: [
                            {
                                id: crypto.randomUUID(),
                                type: 'image',
                                opacity: 1,
                                visible: true,
                                blendMode: 'normal',
                                image: {
                                    id: mediaId,
                                    url: url,
                                    source: 'local',
                                    isFromDb: true
                                }
                            }
                        ],
                        strokes: []
                    });
                };

                const processShape = async (sp: Element, index: number) => {
                    // Check for image fill (blipFill) in shape
                    const blipFill = sp.getElementsByTagName('a:blipFill')[0];
                    if (blipFill) {
                        await processPic(sp, index);
                        return;
                    }

                    // Geometry
                    const spPr = sp.getElementsByTagName('p:spPr')[0];
                    const xfrmEl = spPr?.getElementsByTagName('a:xfrm')[0];
                    const offEl = xfrmEl?.getElementsByTagName('a:off')[0] || xfrmEl?.getElementsByTagName('a:chOff')[0];
                    const extEl = xfrmEl?.getElementsByTagName('a:ext')[0] || xfrmEl?.getElementsByTagName('a:chExt')[0];

                    if (!offEl || !extEl) return;

                    const x = parseInt(offEl.getAttribute('x') || '0');
                    const y = parseInt(offEl.getAttribute('y') || '0');
                    const w = parseInt(extEl.getAttribute('cx') || '0');
                    const h = parseInt(extEl.getAttribute('cy') || '0');
                    const rot = parseInt(xfrmEl?.getAttribute('rot') || '0');
                    const rotation = rot / 60000;

                    // Text body properties for vertical alignment
                    const bodyPr = sp.getElementsByTagName('p:txBody')[0]?.getElementsByTagName('a:bodyPr')[0];
                    const anchor = bodyPr?.getAttribute('anchor'); // ctr, t, b
                    let alignVertical: 'top' | 'middle' | 'bottom' = 'middle';
                    if (anchor === 't') alignVertical = 'top';
                    if (anchor === 'b') alignVertical = 'bottom';

                    // Text content
                    const paragraphs = sp.getElementsByTagName('a:p');
                    let text = '';
                    let fontFamily = 'Inter';
                    let ptSize = 18;
                    let textColor = '#ffffff';
                    let alignHorizontal: 'left' | 'center' | 'right' | 'justify' = 'center';

                    // Extact alignment from the first paragraph
                    const firstPPr = paragraphs[0]?.getElementsByTagName('a:pPr')[0];
                    const algn = firstPPr?.getAttribute('algn');
                    if (algn === 'ctr') alignHorizontal = 'center';
                    if (algn === 'l') alignHorizontal = 'left';
                    if (algn === 'r') alignHorizontal = 'right';
                    if (algn === 'just') alignHorizontal = 'justify';

                    let styleExtracted = false;
                    for (const para of Array.from(paragraphs)) {
                        for (const run of Array.from(para.getElementsByTagName('a:r'))) {
                            if (!styleExtracted && run.textContent?.trim()) {
                                const rPr = run.getElementsByTagName('a:rPr')[0];
                                const defRPr = para.getElementsByTagName('a:pPr')[0]?.getElementsByTagName('a:defRPr')[0];
                                const effectiveRPr = rPr || defRPr;
                                
                                if (effectiveRPr) {
                                    const latin = effectiveRPr.getElementsByTagName('a:latin')[0];
                                    const ea = effectiveRPr.getElementsByTagName('a:ea')[0];
                                    const cs = effectiveRPr.getElementsByTagName('a:cs')[0];
                                    const typeface = latin?.getAttribute('typeface') || ea?.getAttribute('typeface') || cs?.getAttribute('typeface');

                                    if (typeface) {
                                        let normalizedFace = typeface;
                                        if (typeface.startsWith('+mj') || typeface.startsWith('+mn')) {
                                            normalizedFace = 'Inter';
                                        } else {
                                            normalizedFace = typeface.replace(/\s+(Pro|Std|Light|Regular|Bold|Italic|OTF|TTF)$|^(MS\s+)/gi, '').trim();
                                            const mappings: Record<string, string> = {
                                                'Trajan Pro': 'Trajan',
                                                'Times New Roman': 'Times New Roman',
                                                'ArialMT': 'Arial'
                                            };
                                            normalizedFace = mappings[normalizedFace] || normalizedFace;
                                        }
                                        fontFamily = normalizedFace;
                                    }

                                    const sz = effectiveRPr.getAttribute('sz');
                                    if (sz) ptSize = parseInt(sz) / 100;

                                    const solidFill = effectiveRPr.getElementsByTagName('a:solidFill')[0];
                                    const srgbClr = solidFill?.getElementsByTagName('a:srgbClr')[0];
                                    if (srgbClr) {
                                        textColor = `#${srgbClr.getAttribute('val')}`;
                                    }
                                }
                                styleExtracted = true;
                            }
                        }
                    }

                    const lines: string[] = [];
                    for (const para of Array.from(paragraphs)) {
                        let line = '';
                        for (const node of Array.from(para.childNodes)) {
                            if ((node as Element).tagName === 'a:r') {
                                line += (node as Element).getElementsByTagName('a:t')[0]?.textContent || '';
                            } else if ((node as Element).tagName === 'a:br') {
                                line += '\n'; // явный перенос внутри абзаца
                            }
                        }
                        if (line.trim()) lines.push(line);
                    }
                    text = lines.join('\n');

                    if (text.trim()) {
                        const scaledFontSize = Math.round(ptSize * (BASE_HEIGHT / slideHeightPt));

                        const xPct = emuToPercentX(x);
                        const yPct = emuToPercentY(y);
                        const wPct = emuToPercentX(w);
                        const hPct = emuToPercentY(h);

                        slide.content.canvasItems!.push({
                            id: crypto.randomUUID(),
                            type: 'text',
                            x: xPct + wPct / 2,
                            y: yPct + hPct / 2,
                            width: wPct,
                            height: hPct,
                            rotation: rotation,
                            zIndex: index,
                            pivotX: 50,
                            pivotY: 50,
                            locked: false,
                            visible: true,
                            fills: [],
                            strokes: [],
                            text: {
                                content: text,
                                fontFamily,
                                fontWeight: 'normal',
                                fontSize: scaledFontSize || 32,
                                color: textColor,
                                resizingMode: 'fixed',
                                alignHorizontal,
                                alignVertical
                            }
                        });
                    }
                };

                // Extract Background (p:bg)
                const bg = slideDoc.getElementsByTagName('p:bg')[0];
                if (bg) {
                    const blipFill = bg.getElementsByTagName('p:bgPicProps')[0] || bg.getElementsByTagName('a:blipFill')[0];
                    const blip = blipFill?.getElementsByTagName('a:blip')[0];
                    const rId = blip?.getAttribute('r:embed');
                    if (rId) {
                        const target = slideRelationships[rId];
                        if (target) {
                            let mediaPath = target.startsWith('..') ? `ppt/${target.substring(3)}` : `ppt/${target}`;
                            let mediaFile = zip.file(mediaPath) || zip.file(`ppt/media/${target.split('/').pop()}`);

                            if (mediaFile) {
                                const blob = await mediaFile.async('blob');
                                const mediaId = `pptx-bg-${crypto.randomUUID()}`;
                                const { db } = await import('@/core/db');
                                await db.backgrounds.add({ id: mediaId, name: `PPTX Background`, data: blob, mimeType: blob.type });

                                const url = URL.createObjectURL(blob);
                                objectUrls.push(url);

                                slide.content.canvasItems!.unshift({
                                    id: crypto.randomUUID(),
                                    type: 'image',
                                    x: 50, y: 50, // Center of the slide
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
                                        image: { id: mediaId, url: url, source: 'local', isFromDb: true }
                                    }],
                                    strokes: []
                                });
                            }
                        }
                    }

                    const solidFill = bg.getElementsByTagName('a:solidFill')[0];
                    const srgbClr = solidFill?.getElementsByTagName('a:srgbClr')[0];
                    if (srgbClr) {
                        const color = `#${srgbClr.getAttribute('val')}`;
                        slide.backgroundOverride = [{
                            id: crypto.randomUUID(),
                            type: 'color',
                            visible: true,
                            opacity: 1,
                            blendMode: 'normal',
                            color,
                        }];
                    }
                }

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
