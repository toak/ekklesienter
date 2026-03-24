import { app, BrowserWindow, screen, ipcMain, dialog, protocol, net, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register custom protocol as privileged before app is ready
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'local-resource',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            stream: true
        }
    }
]);

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js
// │ ├─┬ preload
// │ │ └── index.js
// │ └─┬ renderer
// │   └── index.html

process.env.DIST_ELECTRON = path.join(__dirname, '../dist-electron');
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, '../public');

let mainWindow: BrowserWindow | null;
let projectorWindow: BrowserWindow | null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

const TEMPLATES_DIR = path.join(app.getPath('userData'), 'templates');

// Bundled templates: in production they live inside the app's Resources,
// in dev they live in the project root folder.
const BUNDLED_TEMPLATES_DIR = app.isPackaged
    ? path.join(process.resourcesPath, 'bundled-templates')
    : path.join(__dirname, '..', 'bundled-templates');

// Ensure templates directory exists
if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

/**
 * Copies bundled .ektmp files into the user's templates directory
 * if they don't already exist there. This runs on every launch so
 * new templates added in app updates get picked up automatically.
 */
function seedBundledTemplates() {
    try {
        if (!fs.existsSync(BUNDLED_TEMPLATES_DIR)) {
            console.log('No bundled-templates directory found, skipping seed.');
            return;
        }

        const bundledFiles = fs.readdirSync(BUNDLED_TEMPLATES_DIR)
            .filter(f => f.endsWith('.ektmp'));

        if (bundledFiles.length === 0) return;

        for (const file of bundledFiles) {
            const dest = path.join(TEMPLATES_DIR, file);
            if (!fs.existsSync(dest)) {
                fs.copyFileSync(
                    path.join(BUNDLED_TEMPLATES_DIR, file),
                    dest
                );
                console.log(`Seeded bundled template: ${file}`);
            }
        }
    } catch (error) {
        console.error('Failed to seed bundled templates:', error);
    }
}

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createMenu() {
    const template: Electron.MenuItemConstructorOptions[] = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'GraceLib',
                    submenu: [
                        {
                            label: 'Export GraceLib...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-gracelib');
                            }
                        },
                        {
                            label: 'Export GraceLib Presentations...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-presentations');
                            }
                        },
                        {
                            label: 'Export GraceLib Templates...',
                            click: () => {
                                mainWindow?.webContents.send('menu:export-templates');
                            }
                        },
                    ]
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                { type: 'separator' },
                { role: 'front' },
                { type: 'separator' },
                { role: 'window' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
    });

    console.log('Main Process: Main Window Created');
    console.log('Main Process: Preload Path:', path.join(__dirname, 'preload.cjs'));

    if (VITE_DEV_SERVER_URL) {
        mainWindow.webContents.openDevTools();
    }

    // Test active push message to Renderer-process
    mainWindow.webContents.on('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('main-process-message', (new Date).toLocaleString());
        }
    });

    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL);
    } else {
        // win.loadFile('dist/index.html')
        mainWindow.loadFile(path.join(process.env.DIST, 'index.html'));
    }

    mainWindow.on('close', () => {
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.close();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}


function createProjectorWindow(displaySettings?: any) {
    if (projectorWindow) {
        if (!projectorWindow.isDestroyed()) {
            projectorWindow.focus();
        } else {
            projectorWindow = null;
        }
        return;
    }

    // ... (rest of creation logic is okay) ...


    // ... Skipping to IPC handlers ...





    const displays = screen.getAllDisplays();
    let display = displays[0];

    if (displaySettings && !displaySettings.autoDefine && displaySettings.presenterDisplayId !== undefined) {
        const targetDisplay = displays.find(d => d.id === displaySettings.presenterDisplayId);
        if (targetDisplay) {
            display = targetDisplay;
        }
    } else {
        const externalDisplay = displays.find((d) => {
            return d.bounds.x !== 0 || d.bounds.y !== 0; // Simple check for secondary
        });
        display = externalDisplay || displays[0]; // Fallback to primary if no secondary
    }

    projectorWindow = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        fullscreen: true,
        autoHideMenuBar: true,
        frame: false,
        alwaysOnTop: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false
        },
    });

    console.log('Main Process: Projector Window Created');
    console.log('Main Process: Preload Path:', path.join(__dirname, 'preload.cjs'));

    if (VITE_DEV_SERVER_URL) {
        projectorWindow.loadURL(`${VITE_DEV_SERVER_URL}/projector.html`);
    } else {
        projectorWindow.loadFile(path.join(process.env.DIST, 'projector.html'));
    }

    // Reliably notify main window when projector page is loaded (Electron-level event)
    projectorWindow.webContents.on('did-finish-load', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-ready');
        }
    });

    projectorWindow.on('closed', () => {
        projectorWindow = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-closed');
        }
    });
}

// Quit when all windows are closed, except on macOS.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
        mainWindow = null;
        projectorWindow = null;
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

app.whenReady().then(() => {
    createMenu();
    // Error logging for Main Process
    process.on('uncaughtException', (error) => {
        console.error('CRITICAL MAIN PROCESS ERROR:', error);
    });

    process.on('unhandledRejection', (reason) => {
        console.error('UNHANDLED MAIN PROCESS REJECTION:', reason);
    });

    console.log('Main Process: Error Logging Initialized');

    // Register custom protocol for local resources
    protocol.handle('local-resource', async (request) => {
        try {
            const url = new URL(request.url);
            let filePath = decodeURIComponent(url.pathname);

            // Handle dummy 'localhost' host or absolute paths correctly
            // On Windows, url.host might be 'c:'
            if (url.host && url.host !== 'localhost' && !/^[a-zA-Z]:$/.test(url.host)) {
                filePath = url.host + filePath;
            }

            // Ensure leading slash on Unix systems if missing
            if (process.platform !== 'win32' && !filePath.startsWith('/')) {
                filePath = '/' + filePath;
            }

            // Robust Windows path handling
            if (process.platform === 'win32' && filePath.startsWith('/') && /^\/[a-zA-Z]:/.test(filePath)) {
                filePath = filePath.slice(1);
            }

            console.log(`[Protocol] Loading: ${filePath}`);

            const { pathToFileURL } = await import('url');
            const fileUrl = pathToFileURL(filePath).href;

            return await net.fetch(fileUrl);
        } catch (error) {
            console.error('[Protocol] Error:', error);
            return new Response('Not Found', { status: 404 });
        }
    });

    createMainWindow();

    ipcMain.handle('open-projector', (event, displaySettings) => {
        createProjectorWindow(displaySettings);
        return true;
    });

    ipcMain.handle('get-displays', () => {
        return screen.getAllDisplays().map(d => ({
            id: d.id,
            label: d.label,
            bounds: d.bounds,
            size: d.size,
            scaleFactor: d.scaleFactor
        }));
    });

    const broadcastAspectRatio = () => {
        const displays = screen.getAllDisplays();
        const external = displays.find(d => d.bounds.x !== 0 || d.bounds.y !== 0);
        const target = external || displays[0];

        if (target) {
            const ratio = target.bounds.width / target.bounds.height;

            // Send ratio to main window
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('on-aspect-ratio-changed', ratio);
            }

            // Fix: Send ratio to projector window as well
            if (projectorWindow && !projectorWindow.isDestroyed()) {
                projectorWindow.webContents.send('on-aspect-ratio-changed', ratio);
            }
        }
    };

    screen.on('display-added', broadcastAspectRatio);
    screen.on('display-removed', broadcastAspectRatio);
    screen.on('display-metrics-changed', broadcastAspectRatio);

    ipcMain.on('projector-command', (event, command, payload) => {
        // Relay command from Controller to Projector
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.webContents.send('projector-command', command, payload);
        }
    });

    ipcMain.on('projector-ready', (event, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('projector-ready', payload);
        }
    });

    ipcMain.on('relay-keydown', (event, payload) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('relay-keydown', payload);
        }
    });

    ipcMain.on('navigate-verse', (event, direction) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('navigate-verse', direction);
        }
    });

    ipcMain.handle('close-projector', () => {
        if (projectorWindow && !projectorWindow.isDestroyed()) {
            projectorWindow.close();
            projectorWindow = null;
        }
        return true;
    });

    ipcMain.handle('select-file', async (event, options) => {
        console.log('IPC: select-file called');
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile'],
                filters: [
                    { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'] }
                ],
                ...options
            });
            
            if (result.canceled) return null;
            
            // Always return the array; let the frontend decide whether to use index 0 or the whole array.
            return result.filePaths;
        } catch (error) {
            console.error('IPC: select-file error:', error);
            return null;
        }
    });

    ipcMain.handle('select-folder', async () => {
        console.log('IPC: select-folder called');
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory']
            });
            console.log('IPC: select-folder result:', result.filePaths[0]);
            return result.filePaths[0];
        } catch (error) {
            console.error('IPC: select-folder error:', error);
            return null;
        }
    });

    ipcMain.handle('read-directory-recursive', async (event, dirPath) => {
        console.log('IPC: read-directory-recursive called for:', dirPath);

        async function getFiles(dir: string): Promise<string[]> {
            const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(dirents.map((dirent: any) => {
                const res = path.resolve(dir, dirent.name);
                return dirent.isDirectory() ? getFiles(res) : res;
            }));
            return files.flat();
        }

        try {
            const allFiles = await getFiles(dirPath);
            const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
            const imageFiles = allFiles.filter((f: string) =>
                validExtensions.includes(path.extname(f).toLowerCase())
            );

            console.log(`IPC: found ${imageFiles.length} images`);
            return imageFiles.map(f => ({
                id: crypto.randomUUID(),
                name: path.basename(f),
                url: `local-resource://localhost${f.startsWith('/') ? '' : '/'}${f}`
            }));
        } catch (err) {
            console.error('Error reading directory:', err);
            return [];
        }
    });

    ipcMain.handle('read-file-data', async (event, filePath) => {
        console.log('IPC: read-file-data called for:', filePath);
        try {
            const buffer = await fs.promises.readFile(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeMap: Record<string, string> = {
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.webp': 'image/webp'
            };
            return {
                data: buffer,
                mimeType: mimeMap[ext] || 'application/octet-stream'
            };
        } catch (error) {
            console.error('IPC: read-file-data error:', error);
            return null;
        }
    });

    // --- Template Management IPCs ---

    ipcMain.handle('templates:list', async () => {
        try {
            const files = await fs.promises.readdir(TEMPLATES_DIR);
            return files.filter(f => f.endsWith('.ektmp'));
        } catch (error) {
            console.error('Error listing templates:', error);
            return [];
        }
    });

    ipcMain.handle('templates:read', async (event, filename) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            const buffer = await fs.promises.readFile(filePath);
            return buffer;
        } catch (error) {
            console.error('Error reading template:', error);
            return null;
        }
    });

    ipcMain.handle('templates:write', async (event, filename, data) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            await fs.promises.writeFile(filePath, Buffer.from(data));
            return true;
        } catch (error) {
            console.error('Error writing template:', error);
            return false;
        }
    });

    ipcMain.handle('templates:delete', async (event, filename) => {
        try {
            const filePath = path.join(TEMPLATES_DIR, filename);
            await fs.promises.unlink(filePath);
            return true;
        } catch (error) {
            console.error('Error deleting template:', error);
            return false;
        }
    });

    ipcMain.handle('templates:get-path', () => TEMPLATES_DIR);

    ipcMain.handle('templates:seed-bundled', () => {
        seedBundledTemplates();
        return true;
    });

    // --- Export IPCs ---

    ipcMain.handle('export:save-file', async (event, { filename, data, title, filters }) => {
        try {
            const result = await dialog.showSaveDialog(mainWindow!, {
                title: title || 'Save File',
                defaultPath: filename,
                filters: filters || []
            });

            if (!result.canceled && result.filePath) {
                await fs.promises.writeFile(result.filePath, Buffer.from(data));
                return true;
            }
            return false;
        } catch (error) {
            console.error('IPC: export:save-file error:', error);
            return false;
        }
    });

    ipcMain.handle('export:save-collection', async (event, { folderPath, files }) => {
        try {
            for (const file of files) {
                const filePath = path.join(folderPath, file.filename);
                await fs.promises.writeFile(filePath, Buffer.from(file.data));
            }
            return true;
        } catch (error) {
            console.error('IPC: export:save-collection error:', error);
            return false;
        }
    });

    ipcMain.handle('get-file-stats', async (event, filePath) => {
        try {
            const stats = await fs.promises.stat(filePath);
            return {
                size: stats.size,
                mtime: stats.mtimeMs
            };
        } catch (error) {
            return null;
        }
    });
});
