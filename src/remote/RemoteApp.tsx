import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { BibleBrowser } from './components/BibleBrowser';
import { useRemoteSocket } from './hooks/useRemoteSocket';
import { RemoteLogin } from './components/RemoteLogin';
import { RemoteSlides } from './components/RemoteSlides';
import { RemoteHeader } from './components/RemoteHeader';
import { RemoteFooter } from './components/RemoteFooter';

export const RemoteApp = () => {
    const { t, i18n } = useTranslation();
    const [pin, setPin] = useState('');
    const [mode, setMode] = useState<'slides' | 'bible'>('slides');

    const {
        connected,
        authError,
        slideState,
        setSlideState,
        connect,
        disconnect,
        sendCommand,
        handleBibleQuery
    } = useRemoteSocket();

    // Initial restore from cache & auto-login
    useEffect(() => {
        const cachedTheme = localStorage.getItem('remote-theme');
        const cachedLang = localStorage.getItem('remote-lang');
        if (cachedTheme) document.documentElement.setAttribute('data-theme', cachedTheme);
        if (cachedLang) i18n.changeLanguage(cachedLang);

        const savedPin = localStorage.getItem('remote_pin');
        if (savedPin && savedPin.length === 4) {
            connect(savedPin);
        }
    }, [connect, i18n]);

    const handleMediaToggle = () => {
        if (!slideState) return;
        setSlideState((prev: any) => prev ? ({ ...prev, playing: !prev.playing }) : prev);
        sendCommand('MEDIA_TOGGLE');
    };

    const handleOverrideToggle = (type: 'blackout' | 'whiteout' | 'logo') => {
        if (!slideState) return;
        setSlideState((prev: any) => prev ? ({
            ...prev,
            activeOverride: prev.activeOverride === type ? null : type
        }) : prev);

        const commandMap = {
            blackout: 'OVERRIDE_BLACK',
            whiteout: 'OVERRIDE_WHITE',
            logo: 'OVERRIDE_LOGO'
        };
        sendCommand(commandMap[type]);
    };

    if (!connected) {
        return (
            <RemoteLogin
                pin={pin}
                setPin={setPin}
                onConnect={connect}
                authError={authError}
            />
        );
    }

    return (
        <div className="flex flex-col h-dvh bg-stone-950 text-white px-6 pt-2 pb-1 safe-area overscroll-none overflow-hidden transition-all duration-700">
            <RemoteHeader
                isActive={!!slideState?.active}
                onToggleProjector={() => sendCommand(slideState?.active ? 'PROJECTOR_STOP' : 'PROJECTOR_START')}
                onLogout={disconnect}
            />

            <div className="flex-1 flex flex-col min-h-0 relative z-10">
                {mode === 'slides' ? (
                    <RemoteSlides
                        slideState={slideState}
                        onMediaToggle={handleMediaToggle}
                        onMediaStop={() => sendCommand('MEDIA_STOP')}
                        onOverrideToggle={handleOverrideToggle}
                        onCommand={sendCommand}
                    />
                ) : (
                    <div className="flex-1 min-h-0 flex flex-col h-full animate-in fade-in slide-in-from-left-4 duration-300">
                        <BibleBrowser
                            onQuery={handleBibleQuery}
                            onSelect={(data) => {
                                sendCommand('BIBLE_SELECT', Array.isArray(data) ? { verses: data } : { verse: data });
                            }}
                        />
                    </div>
                )}
            </div>

            <RemoteFooter mode={mode} setMode={setMode} />
        </div>
    );
};

