import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';
import { Smartphone, ServerCrash, Check, Copy, Wifi, ShieldCheck, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const RemoteSettings: React.FC = () => {
    const { t } = useTranslation();

    const [serverInfo, setServerInfo] = useState<{ ip: string, port: number, pin: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const cleanupRemoteState = () => {
        setServerInfo(null);
        setError(null);
        setLoading(true);
    };

    /**
     * Refreshes the server network info.
     * Tries getInfo() first — if the server is already running and Wi-Fi hasn't
     * changed, the PIN and URL remain stable (no reconnect needed).
     * Falls back to a full start() only when the server is unreachable.
     */
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        try {
            if (window.electron?.ipcRenderer?.remote) {
                const info = await window.electron.ipcRenderer.remote.getInfo();
                if (info?.success) {
                    setServerInfo({ ip: info.ip, port: info.port, pin: info.pin });
                    setError(null);
                } else {
                    // Server not running — do a full restart
                    await startServer();
                }
            }
        } catch {
            await startServer();
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        startServer();
        return () => {
            cleanupRemoteState();
        };
    }, []);

    const startServer = async () => {
        setLoading(true);
        setError(null);
        try {
            if (window.electron?.ipcRenderer?.remote) {
                const info = await window.electron.ipcRenderer.remote.start();
                if (info.success) {
                    setServerInfo({ ip: info.ip, port: info.port, pin: info.pin });
                } else {
                    setError(info.error || 'Failed to start server.');
                }
            } else {
                setError('IPC Bridge not available.');
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Server start failed.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyUrl = () => {
        if (serverInfo) {
            const url = `http://${serverInfo.ip}:${serverInfo.port}/remote.html`;
            navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success(t('remote_copied_url'));
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Header Info */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center text-accent shadow-inner">
                    <Smartphone size={24} strokeWidth={1.5} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white tracking-tight leading-none bg-clip-text text-transparent bg-linear-to-b from-white to-white/70">
                        {t('remote_control_title')}
                    </h2>
                    <p className="text-sm font-medium text-stone-500 mt-1">
                        {t('remote_control_desc')}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-6 bg-stone-900/40 border border-white/5 rounded-3xl">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-[3px] border-accent/10 rounded-full" />
                        <div className="absolute inset-0 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-accent/50">
                            <Smartphone size={20} />
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-white font-medium text-lg leading-none">{t('remote_starting_server')}</p>
                        <p className="text-stone-500 text-sm font-medium">{t('remote_initializing_bridge')}</p>
                    </div>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center px-4 bg-stone-900/40 border border-white/5 rounded-3xl">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2 border border-red-500/20">
                        <ServerCrash size={36} strokeWidth={1.5} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-xl font-bold text-white tracking-tight">{t('remote_connection_failed')}</h3>
                        <p className="text-red-400/80 font-medium text-sm">{error}</p>
                    </div>
                    <button 
                        onClick={startServer} 
                        className="mt-6 px-8 py-3.5 bg-white hover:bg-stone-200 text-black rounded-2xl text-sm font-bold transition-all active:scale-95 shadow-xl cursor-pointer"
                    >
                        {t('remote_try_again')}
                    </button>
                </div>
            ) : serverInfo ? (
                <div className="flex flex-col gap-6">
                    {/* Bento Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-6 items-stretch">
                        
                        {/* Left Side: QR Code Panel */}
                        <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden group transition-colors">
                            <div className="relative z-10 flex flex-col items-center gap-6 w-full">
                                <div className="p-4 sm:p-5 bg-white rounded-3xl shadow-xl relative transform group-hover:scale-105 transition-transform duration-500 ease-out">
                                    <QRCodeSVG 
                                        value={`http://${serverInfo.ip}:${serverInfo.port}/remote.html`}
                                        size={180}
                                        level="H"
                                        includeMargin={false}
                                        className="rounded-xl mix-blend-multiply"
                                    />
                                </div>
                                
                                <div className="flex items-center gap-2.5 bg-accent/10 border border-accent/20 px-4 py-2 rounded-full backdrop-blur-md">
                                    <div className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
                                    </div>
                                    <span className="text-accent text-xs font-bold uppercase tracking-wider">{t('remote_scan_to_connect')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Info Panel */}
                        <div className="flex flex-col gap-6">
                            
                            {/* Passcode Box */}
                            <div className="bg-stone-900/60 border border-white/5 rounded-3xl p-6 sm:p-8 flex-1 flex flex-col justify-center relative group overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                                    <ShieldCheck size={120} strokeWidth={0.5} className="text-accent -mt-10 -mr-10" />
                                </div>
                                
                                <div className="relative z-10 flex flex-col gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-xl bg-stone-800 border border-white/5 flex items-center justify-center">
                                            <QrCode size={12} className="text-stone-400" />
                                        </div>
                                        <h3 className="text-xs font-bold text-stone-500 uppercase tracking-widest">{t('remote_auth_pin')}</h3>
                                    </div>
                                    
                                    <div className="text-[3rem] sm:text-[3.5rem] leading-none tracking-[0.2em] font-mono font-black text-white">
                                        {serverInfo.pin}
                                    </div>
                                    
                                    <p className="text-sm text-stone-400 font-medium max-w-sm mt-1">
                                        {t('remote_auth_pin_desc')}
                                    </p>
                                </div>
                            </div>

                            {/* Network Status / Tip */}
                            <div className="bg-emerald-500/5 mt-auto border border-emerald-500/10 rounded-2xl p-4 sm:p-5 flex items-start gap-4">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/20">
                                    <Wifi size={14} className="text-emerald-400" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-bold text-emerald-400">{t('remote_same_network')}</span>
                                    <span className="text-sm text-emerald-300/70 leading-snug">
                                        {t('remote_same_network_desc')}
                                    </span>
                                </div>
                            </div>
                            
                        </div>
                    </div>
                    
                    {/* URL Entry Footer */}
                    <div className="mt-2 group">
                        <div className="flex items-center justify-between mb-2 px-1">
                            <label className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">{t('remote_enter_url_manually')}</label>
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-500 hover:text-accent transition-colors disabled:opacity-40 cursor-pointer"
                                title={t('remote_refresh_network')}
                            >
                                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                                <span>{t('remote_refresh_network')}</span>
                            </button>
                        </div>
                        <div className="flex items-center pl-4 pr-1.5 py-1.5 bg-stone-900/40 border border-white/5 hover:border-white/10 hover:bg-stone-900/60 rounded-2xl transition-all duration-300 focus-within:border-white/10 focus-within:bg-stone-900/60">
                            <div className="flex-1 text-[13px] font-mono text-stone-400 select-all overflow-hidden text-ellipsis whitespace-nowrap md:min-w-0 min-w-0 pr-4 my-2">
                                <span className="text-stone-600">http://</span>
                                <span className="text-white">{serverInfo.ip}:{serverInfo.port}</span>
                                <span className="text-stone-500">/remote.html</span>
                            </div>
                            
                            <button
                                onClick={handleCopyUrl}
                                className="shrink-0 h-10 px-5 bg-white/10 hover:bg-white text-stone-300 hover:text-black rounded-xl transition-all duration-300 flex items-center gap-2 font-bold text-xs cursor-pointer shadow-sm disabled:opacity-50"
                            >
                                {copied ? <Check size={14} className="text-black" /> : <Copy size={14} />}
                                <span className="hidden sm:inline">{copied ? t('remote_copied_url') : t('remote_copy_url')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default RemoteSettings;
