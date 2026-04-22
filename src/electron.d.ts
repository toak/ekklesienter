export { };

declare global {
    interface Window {
        electron?: {
            ipcRenderer: {
                send: (channel: string, ...args: any[]) => void;
                on: (channel: string, func: (...args: any[]) => void) => () => void;
                invoke: (channel: string, ...args: any[]) => Promise<any>;
                selectFile: (options: any) => Promise<string[] | null>;
                selectFolder: () => Promise<string | null>;
                readDirectoryRecursive: (path: string) => Promise<string[]>;
                readFileData: (path: string) => Promise<Uint8Array | { data: Uint8Array; mimeType: string } | null>;
                onAspectRatioChanged: (callback: (ratio: number) => void) => () => void;
                templates: {
                    list: () => Promise<string[]>;
                    read: (filename: string) => Promise<Uint8Array | null>;
                    write: (filename: string, data: Uint8Array) => Promise<boolean | void>;
                    delete: (filename: string) => Promise<boolean | void>;
                    getPath: () => Promise<string>;
                    seedBundled: () => Promise<boolean | void>;
                };
                export: {
                    saveFile: (options: any) => Promise<string | null>;
                    saveCollection: (options: any) => Promise<string | null>;
                };
                power: {
                    setWakeLock: (enabled: boolean) => Promise<boolean>;
                };
                remote: {
                    start: () => Promise<any>;
                    stop: () => Promise<boolean>;
                    getInfo: () => Promise<any>;
                    updateState: (payload: any) => void;
                    onCommand: (callback: (command: string, payload?: any) => void) => () => void;
                    sendResults: (requestId: string, results: any) => void;
                };
            };
        };
        showSaveFilePicker?: (options?: any) => Promise<any>;
        showOpenFilePicker?: (options?: any) => Promise<any[]>;
    }
}
