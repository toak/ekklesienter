import { useState } from 'react';
import { TFunction } from 'i18next';
import { db } from '@/core/db';
import { toast } from 'sonner';
import { LibraryImportService } from '../services/LibraryImportService';

interface UseLibraryInteractionProps {
    currentBinId: string | null;
    t: TFunction;
    createPresentationBin: (name: string) => void;
}

export const useLibraryInteraction = ({
    currentBinId,
    t,
    createPresentationBin
}: UseLibraryInteractionProps) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleImportClick = async () => {
        await LibraryImportService.selectAndImport({ 
            t, 
            currentBinId: currentBinId || undefined 
        });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        // Check for internal drag-and-drop JSON payload to move presentation
        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (dataStr) {
                const data = JSON.parse(dataStr);
                if (data.source === 'presentation-library' && data.presentationId) {
                    const pres = await db.presentationFiles.get(data.presentationId);
                    if (pres) {
                        if (pres.serviceId) {
                            // Dragged from active service selector -> Create a standalone copy in GraceLib
                            const cloneId = crypto.randomUUID();
                            const clone = {
                                ...pres,
                                id: cloneId,
                                serviceId: undefined,
                                isMaster: false,
                                binId: currentBinId || undefined,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };
                            await db.presentationFiles.add(clone);
                            toast.success(t('added_to_gracelib', 'Added presentation to GraceLib'));
                        } else {
                            // Dragged from within GraceLib -> Move to current viewed bin
                            await db.presentationFiles.update(data.presentationId, { binId: currentBinId || undefined });
                            toast.success(t('moved_presentation', 'Moved presentation to bin'));
                        }
                    }
                    return;
                }
            }
        } catch (err) { }

        const files = Array.from(e.dataTransfer.files);
        await LibraryImportService.importFiles(files, currentBinId || undefined, t);
    };

    return {
        isDragging,
        handleImportClick,
        handleDragOver,
        handleDragLeave,
        handleDrop
    };
};
