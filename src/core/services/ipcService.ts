/**
 * Centralized IPC Service to handle all communication between Renderer and Main process.
 * Provides a type-safe wrapper around the Electron bridge.
 */
export const ipcService = {
    /**
     * Checks if the application is running in an Electron environment.
     */
    isElectron(): boolean {
        return !!window.electron?.ipcRenderer;
    },

    /**
     * Sends an asynchronous message to the main process via channel.
     */
    send(channel: string, ...args: any[]): void {
        if (this.isElectron()) {
            window.electron?.ipcRenderer?.send(channel, ...args);
        } else {
            console.warn(`[IpcService] Attempted to send to channel "${channel}" in non-electron environment.`);
        }
    },

    /**
     * Listens to channel, when a new message arrives func would be called with func(event, args...).
     * Returns an unsubscribe function.
     */
    on(channel: string, func: (...args: any[]) => void): () => void {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.on(channel, func) || (() => {});
        }
        return () => {};
    },

    /**
     * Sends a message to the main process via channel and expects a result asynchronously.
     */
    async invoke<T = any>(channel: string, ...args: any[]): Promise<T> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.invoke(channel, ...args) as Promise<T>;
        }
        throw new Error(`[IpcService] Attempted to invoke channel "${channel}" in non-electron environment.`);
    },

    /**
     * Opens a system file dialog to select files.
     */
    async selectFile(options: any): Promise<string[] | null> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.selectFile(options) || Promise.resolve(null);
        }
        return null;
    },

    /**
     * Opens a system dialog to select a folder.
     */
    async selectFolder(): Promise<string | null> {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.selectFolder() || Promise.resolve(null);
        }
        return null;
    },

    /**
     * Template-related IPC operations.
     */
    templates: {
        list: () => ipcService.invoke<string[]>('templates:list'),
        read: (filename: string) => ipcService.invoke<Uint8Array | null>('templates:read', filename),
        write: (filename: string, data: Uint8Array) => ipcService.invoke<boolean | void>('templates:write', filename, data),
        delete: (filename: string) => ipcService.invoke<boolean | void>('templates:delete', filename),
        getPath: () => ipcService.invoke<string>('templates:get-path'),
        seedBundled: () => ipcService.invoke<boolean | void>('templates:seed-bundled'),
    },

    /**
     * Export-related IPC operations.
     */
    export: {
        saveFile: (options: any) => ipcService.invoke<string | null>('export:save-file', options),
        saveCollection: (options: any) => ipcService.invoke<string | null>('export:save-collection', options),
    },

    /**
     * Power-related IPC operations.
     */
    power: {
        setWakeLock: (enabled: boolean) => ipcService.invoke<boolean>('power:set-wake-lock', enabled),
    },

    /**
     * Specialized listener for aspect ratio changes.
     */
    onAspectRatioChanged(callback: (ratio: number) => void): () => void {
        if (this.isElectron()) {
            return window.electron?.ipcRenderer?.onAspectRatioChanged(callback) || (() => {});
        }
        return () => {};
    }
};

/** @deprecated Use ipcService instead. */
export const IpcService = ipcService;
