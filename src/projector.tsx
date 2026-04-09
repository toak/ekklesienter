import './core/utils/blobDebugger';
import React from 'react';
import ReactDOM from 'react-dom/client';
import ProjectorView from '@/features/presenter/components/display/ProjectorView';

import './core/styles/globals.css';
import './core/i18n';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <ProjectorView />
    </React.StrictMode>
);
