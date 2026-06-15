import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { rewriteMediaUrls } from '../utils/mediaUrlRewriter';
import { RemoteSlideState } from '../types';

const getWsUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:3211`;
};

export const useRemoteSocket = () => {
    const { i18n } = useTranslation();
    const [connected, setConnected] = useState(false);
    const [authError, setAuthError] = useState('');
    const [slideState, setSlideState] = useState<RemoteSlideState | null>(null);
    
    const wsRef = useRef<WebSocket | null>(null);
    const pendingRequestsRef = useRef<Record<string, (results: unknown[]) => void>>({});

    // Reconnection & backoff state refs
    const targetPinRef = useRef<string>('');
    const reconnectCountRef = useRef(0);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const maxReconnectAttempts = 5;
    const isManualDisconnectRef = useRef(false);

    const cleanupReconnect = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
    }, []);

    const connect = useCallback((pin: string) => {
        cleanupReconnect();
        isManualDisconnectRef.current = false;
        targetPinRef.current = pin;

        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
        }
        
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
                    reconnectCountRef.current = 0;
                    localStorage.setItem('remote_token', data.token);
                    localStorage.setItem('remote_pin', pin);
                    ws.send(JSON.stringify({ type: 'COMMAND', command: 'GET_STATE' }));
                } else if (data.type === 'AUTH_ERROR') {
                    setAuthError(data.message);
                    setConnected(false);
                    isManualDisconnectRef.current = true;
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

        ws.onclose = () => {
            setConnected(false);
            
            // Auto reconnect if not manually disconnected and attempts remain
            if (!isManualDisconnectRef.current && targetPinRef.current && reconnectCountRef.current < maxReconnectAttempts) {
                const delay = Math.min(10000, 1000 * Math.pow(2, reconnectCountRef.current));
                
                reconnectCountRef.current += 1;
                reconnectTimerRef.current = setTimeout(() => {
                    connect(targetPinRef.current);
                }, delay);
            }
        };
        wsRef.current = ws;
    }, [cleanupReconnect]);

    const sendCommand = useCallback((command: string, payload?: unknown) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'COMMAND', command, payload }));
        }
    }, []);

    const handleBibleQuery = useCallback((type: string, payload: Record<string, unknown>): Promise<unknown[]> => {
        return new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            pendingRequestsRef.current[requestId] = resolve as (results: unknown[]) => void;
            sendCommand(type, { ...payload, requestId });
        });
    }, [sendCommand]);

    const disconnect = useCallback(() => {
        isManualDisconnectRef.current = true;
        targetPinRef.current = '';
        reconnectCountRef.current = 0;
        cleanupReconnect();

        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }
        setConnected(false);
    }, [cleanupReconnect]);

    // Theme & Language Sync
    useEffect(() => {
        const theme = slideState?.themeAccent || 
            slideState?.settings?.background?.[0]?.color || 
            ((slideState?.settings as unknown as Record<string, unknown>)?.appearance as Record<string, unknown>)?.themeAccent as string;
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

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isManualDisconnectRef.current = true;
            cleanupReconnect();
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
            }
        };
    }, [cleanupReconnect]);

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
