import { ipcRenderer, contextBridge } from 'electron';

console.log('⚡️ Preload script initialized');

// --------- Expose some API to the Renderer process ---------
console.log('⚡️ Exposing electron bridge to window...');
contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send(channel: string, ...args: any[]) {
            ipcRenderer.send(channel, ...args);
        },
        on(channel: string, func: (...args: any[]) => void) {
            const subscription = (_event: any, ...args: any[]) => func(...args);
            ipcRenderer.on(channel, subscription);
            return () => ipcRenderer.removeListener(channel, subscription);
        },
        invoke(channel: string, ...args: any[]) {
            return ipcRenderer.invoke(channel, ...args);
        },
        selectFile(options: any) {
            return ipcRenderer.invoke('select-file', options);
        },
        selectFolder() {
            return ipcRenderer.invoke('select-folder');
        },
        readDirectoryRecursive(path: string) {
            return ipcRenderer.invoke('read-directory-recursive', path);
        },
        readFileData(path: string) {
            return ipcRenderer.invoke('read-file-data', path);
        },
        templates: {
            list: () => ipcRenderer.invoke('templates:list'),
            read: (filename: string) => ipcRenderer.invoke('templates:read', filename),
            write: (filename: string, data: Uint8Array) => ipcRenderer.invoke('templates:write', filename, data),
            delete: (filename: string) => ipcRenderer.invoke('templates:delete', filename),
            getPath: () => ipcRenderer.invoke('templates:get-path'),
            seedBundled: () => ipcRenderer.invoke('templates:seed-bundled'),
        },
        export: {
            saveFile: (options: any) => ipcRenderer.invoke('export:save-file', options),
            saveCollection: (options: any) => ipcRenderer.invoke('export:save-collection', options),
        },
        onAspectRatioChanged(callback: (ratio: number) => void) {
            const sub = (_event: any, ratio: number) => callback(ratio);
            ipcRenderer.on('on-aspect-ratio-changed', sub);
            return () => ipcRenderer.removeListener('on-aspect-ratio-changed', sub);
        },
        remote: {
            start: () => ipcRenderer.invoke('remote:start'),
            stop: () => ipcRenderer.invoke('remote:stop'),
            getInfo: () => ipcRenderer.invoke('remote:get-info'),
            updateState: (payload: any) => ipcRenderer.send('remote:update-state', payload),
            onCommand: (callback: (command: string, payload?: any) => void) => {
                const sub = (_event: any, command: string, payload: any) => callback(command, payload);
                ipcRenderer.on('remote:command-received', sub);
                return () => ipcRenderer.removeListener('remote:command-received', sub);
            },
            sendResults: (requestId: string, results: any) => ipcRenderer.send('remote:bible-results', { requestId, results }),
        },
        power: {
            setWakeLock: (enabled: boolean) => ipcRenderer.invoke('power:set-wake-lock', enabled),
        }
    },
});
