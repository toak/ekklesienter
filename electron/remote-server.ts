import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { networkInterfaces } from 'os';
import * as http from 'http';
import path from 'path';
import { BrowserWindow, ipcMain } from 'electron';
import crypto from 'crypto';

export class RemoteServer {
    private app = express();
    private server: http.Server | null = null;
    private wss: WebSocketServer | null = null;
    private clients: Set<WebSocket> = new Set();
    private pendingMediaRequests: Map<string, express.Response> = new Map();
    
    private port: number = 3211;
    private currentIp: string = '127.0.0.1';
    public currentPin: string = '0000';

    private mainWindow: BrowserWindow | null = null;

    constructor() {}

    private getLocalIp(): string {
        const nets = networkInterfaces();
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]!) {
                // Return the first non-internal IPv4 address
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        return '127.0.0.1';
    }

    private setupExpress() {
        this.app.use(express.json());
        
        // Disable CORS restrictions since it's a local utility server
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
        
        // --- MEDIA PROXY ROUTE ---
        // This allows the remote controller (mobile) to fetch images directly from the desktop's DB
        this.app.get('/media/:id', (req, res) => {
            if (!this.mainWindow || this.mainWindow.isDestroyed()) {
                console.error('[RemoteServer] Media Proxy: Main window not available');
                return res.status(503).send('Main window not available');
            }

            const mediaId = req.params.id;
            const requestId = crypto.randomUUID();
            
            console.log(`[RemoteServer] Media Request: ${mediaId} (RID: ${requestId})`);
            
            // Register this request so we can respond when the renderer sends data back
            this.pendingMediaRequests.set(requestId, res);

            // Ask the renderer to fetch this blob from IndexedDB
            this.mainWindow.webContents.send('remote:request-media', { id: mediaId, requestId });

            // Safety timeout: cleanup if renderer doesn't respond
            setTimeout(() => {
                if (this.pendingMediaRequests.has(requestId)) {
                    console.warn(`[RemoteServer] Media Request Timeout: ${mediaId}`);
                    this.pendingMediaRequests.get(requestId)?.status(408).send('Media request timeout');
                    this.pendingMediaRequests.delete(requestId);
                }
            }, 10000);
        });

        const viteDevUrl = process.env['VITE_DEV_SERVER_URL'];

        if (viteDevUrl) {
            // DEV MODE: Redirect to Vite dev server to prevent proxy/CORS issues
            console.log(`[RemoteServer] Dev mode — redirecting HTTP to Vite server`);
            this.app.use((req, res) => {
                try {
                    const url = new URL(viteDevUrl);
                    const targetPort = url.port || 3210;
                    res.redirect(`http://${this.currentIp}:${targetPort}${req.url}`);
                } catch(e) {
                    res.status(500).send('Vite Dev URL error');
                }
            });
        } else {
            // PRODUCTION: Serve built files from dist/
            const publicPath = path.join(process.env.DIST || path.join(__dirname, '../dist'));
            console.log(`[RemoteServer] Production mode — serving from ${publicPath}`);
            this.app.use(express.static(publicPath));
            this.app.use((req, res) => {
                res.sendFile(path.join(publicPath, 'remote.html'));
            });
        }
    }

    private setupWebSocket() {
        if (!this.server) {
            console.error('[RemoteServer] Cannot setup WebSocket: HTTP server not created yet');
            return;
        }
        this.wss = new WebSocketServer({ 
            server: this.server
        });

        this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
            console.log(`[RemoteServer] New WebSocket connection from ${req.socket.remoteAddress}`);
            let isAuthenticated = false;

            ws.on('message', (message: string) => {
                try {
                    const data = JSON.parse(message.toString());

                    // Handshake Authentication
                    if (data.type === 'AUTH') {
                        if (data.pin === this.currentPin) {
                            isAuthenticated = true;
                            this.clients.add(ws);
                            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS', token: crypto.randomUUID() })); // Simple token for now
                            console.log('[RemoteServer] Client authenticated');
                        } else {
                            ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Invalid PIN' }));
                            ws.close();
                        }
                        return;
                    }

                    if (!isAuthenticated) {
                        ws.send(JSON.stringify({ type: 'AUTH_ERROR', message: 'Not authenticated' }));
                        return;
                    }

                    // Forward authorized commands to the Electron main window
                    if (data.type === 'COMMAND') {
                        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                            this.mainWindow.webContents.send('remote:command-received', data.command, data.payload);
                        }
                    }

                } catch (err) {
                    console.error('[RemoteServer] WS Message Error:', err);
                }
            });

            ws.on('close', () => {
                this.clients.delete(ws);
                console.log('[RemoteServer] Client disconnected');
            });
        });
    }

    private setupIpcListeners() {
        // Allow Desktop app to push updates (current slide text, etc) to Remote clients
        ipcMain.on('remote:update-state', (event, payload) => {
            this.broadcast({ type: 'STATE_UPDATE', payload });
        });

        // Handle Bible/Data query results from the desktop app
        ipcMain.on('remote:bible-results', (event, { requestId, results }) => {
            this.broadcast({ type: 'BIBLE_RESULTS', requestId, results });
        });

        // Handle Media data response from the desktop app (for the proxy route)
        ipcMain.on('remote:media-response', (event, { requestId, data, mimeType, error }) => {
            const res = this.pendingMediaRequests.get(requestId);
            if (!res) return;

            if (error) {
                console.error(`[RemoteServer] Media Proxy Error for RID ${requestId}: ${error}`);
                res.status(404).send(error);
            } else if (data) {
                // 'data' is expected to be a Buffer (sent from renderer via IPC)
                const buffer = Buffer.from(data);
                
                if (mimeType) res.setHeader('Content-Type', mimeType);
                res.setHeader('Cache-Control', 'public, max-age=3600');
                res.setHeader('Accept-Ranges', 'bytes');

                // Support partial content (streaming) for videos if client asks
                const range = res.req.headers.range;
                if (range) {
                    const totalSize = buffer.length;
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
                    const chunksize = (end - start) + 1;

                    res.status(206).set({
                        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
                        'Content-Length': chunksize,
                    });
                    res.send(buffer.slice(start, end + 1));
                } else {
                    res.setHeader('Content-Length', buffer.length);
                    res.send(buffer);
                }
            } else {
                res.status(404).send('Not found');
            }

            this.pendingMediaRequests.delete(requestId);
        });
    }

    public broadcast(message: object) {
        const msgStr = JSON.stringify(message);
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(msgStr);
            }
        });
    }

    public start(mainWindow: BrowserWindow): Promise<{ ip: string; port: number; pin: string }> {
        return new Promise((resolve, reject) => {
            if (this.server) {
                return resolve({ ip: this.currentIp, port: this.port, pin: this.currentPin });
            }

            this.mainWindow = mainWindow;
            this.currentIp = this.getLocalIp();
            this.currentPin = Math.floor(1000 + Math.random() * 9000).toString(); // Generate 4-digit PIN

            this.setupExpress();
            this.server = http.createServer(this.app);
            this.setupIpcListeners();

            this.server.listen(this.port, '0.0.0.0', () => {
                // Setup WebSocket AFTER server is listening
                this.setupWebSocket();
                const viteDevUrl = process.env['VITE_DEV_SERVER_URL'];
                let displayPort = this.port;
                
                if (viteDevUrl) {
                    try {
                        const url = new URL(viteDevUrl);
                        displayPort = parseInt(url.port) || 80;
                    } catch (e) {}
                }

                console.log(`[RemoteServer] Started on http://${this.currentIp}:${this.port}`);
                console.log(`[RemoteServer] Display URL Port: ${displayPort}`);
                console.log(`[RemoteServer] Active PIN: ${this.currentPin}`);
                resolve({ ip: this.currentIp, port: displayPort, pin: this.currentPin });
            });

            this.server.on('error', (err: any) => {
                if (err.code === 'EADDRINUSE') {
                    // Try next port if 3000 is occupied
                    this.port++;
                    this.server?.listen(this.port, '0.0.0.0');
                } else {
                    console.error('[RemoteServer] Startup Error:', err);
                    reject(err);
                }
            });
        });
    }

    public stop() {
        if (this.wss) {
            this.wss.clients.forEach(c => c.close());
            this.wss.close();
            this.wss = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
        this.clients.clear();
        console.log('[RemoteServer] Stopped');
    }
}

// Export singleton instance
export const remoteServerInfo = new RemoteServer();
