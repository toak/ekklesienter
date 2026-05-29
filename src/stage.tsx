import './core/utils/blobDebugger';
import React from 'react';
import ReactDOM from 'react-dom/client';
import StageView from '@/features/presenter/components/display/StageView';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

import './core/styles/globals.css';
import './core/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ErrorBoundary fallback={<div className="w-full h-full min-h-screen bg-black" />}>
            <StageView />
        </ErrorBoundary>
    </React.StrictMode>
);
