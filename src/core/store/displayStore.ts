import { create } from 'zustand';

interface DisplayState {
    aspectRatio: number;
    setAspectRatio: (ratio: number) => void;
    initElectronListener: () => void;
}

export const useDisplayStore = create<DisplayState>((set) => ({
    aspectRatio: 16 / 9,

    setAspectRatio: (ratio) => set({ aspectRatio: ratio }),

    initElectronListener: () => {
        if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
            const electron = (window as any).electron;

            // Initial aspect ratio fetch if possible
            electron.ipcRenderer.invoke('get-displays').then((displays: any[]) => {
                const external = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
                const target = external || displays[0];
                if (target) {
                    set({ aspectRatio: target.bounds.width / target.bounds.height });
                }
            });

            // Listen for changes
            const removeListener = electron.ipcRenderer.on('on-aspect-ratio-changed', (ratio: number) => {
                set({ aspectRatio: ratio });
            });

            return removeListener;
        }
    },
}));
