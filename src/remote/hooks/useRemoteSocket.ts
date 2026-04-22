import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rewriteMediaUrls } from '../utils/mediaUrlRewriter';

const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:3211`;
};

export const useRemoteSocket = () => {
    const { i18n } = useTranslation();
    const [connected, setConnected] = useState(false);
    const [authError, setAuthError] = useState('');
    const [slideState, setSlideState] = useState<any>(null);
    
    const wsRef = useRef<WebSocket | null>(null);
    const pendingRequestsRef = useRef<Record<string, (results: any[]) => void>>({});

    const connect = useCallback((pin: string) => {
        if (wsRef.current) wsRef.current.close();
        
        setAuthError('');
        const ws = new WebSocket(getWsUrl());

        ws.onopen = () => {
            const token = localStorage.getItem('remote_token');
            ws.send(JSON.stringify({
                type: 'AUTH',
                pin,
                token
            }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);

                if (data.type === 'AUTH_SUCCESS') {
                    setConnected(true);
                    localStorage.setItem('remote_token', data.token);
                    localStorage.setItem('remote_pin', pin);
                    ws.send(JSON.stringify({ type: 'COMMAND', command: 'GET_STATE' }));
                } else if (data.type === 'AUTH_ERROR') {
                    setAuthError(data.message);
                    setConnected(false);
                    localStorage.removeItem('remote_pin');
                    localStorage.removeItem('remote_token');
                } else if (data.type === 'STATE_UPDATE') {
                    const transformed = rewriteMediaUrls(data.payload);
                    setSlideState(transformed);
                } else if (data.type === 'BIBLE_RESULTS') {
                    const resolve = pendingRequestsRef.current[data.requestId];
                    if (resolve) {
                        resolve(data.results);
                        delete pendingRequestsRef.current[data.requestId];
                    }
                }
            } catch (err) {
                console.error('WS Message Parse Error:', err);
            }
        };

        ws.onclose = () => setConnected(false);
        wsRef.current = ws;
    }, []);

    const sendCommand = useCallback((command: string, payload?: any) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'COMMAND', command, payload }));
        }
    }, []);

    const handleBibleQuery = useCallback((type: string, payload: any): Promise<any[]> => {
        return new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            pendingRequestsRef.current[requestId] = resolve;
            sendCommand(type, { ...payload, requestId });
        });
    }, [sendCommand]);

    const disconnect = useCallback(() => {
        wsRef.current?.close();
        setConnected(false);
    }, []);

    // Theme & Language Sync
    useEffect(() => {
        const theme = slideState?.themeAccent || slideState?.settings?.appearance?.themeAccent;
        if (theme) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('remote-theme', theme);
        }

        const targetLang = slideState?.language;
        if (targetLang && !i18n.language.startsWith(targetLang)) {
            i18n.changeLanguage(targetLang);
            localStorage.setItem('remote-lang', targetLang);
        }
    }, [slideState, i18n]);

    return {
        connected,
        authError,
        slideState,
        setSlideState,
        connect,
        disconnect,
        sendCommand,
        handleBibleQuery
    };
};
