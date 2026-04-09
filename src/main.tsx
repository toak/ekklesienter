import './core/utils/blobDebugger';
import React from 'react';
import { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './core/styles/globals.css';
import './core/i18n';
import './core/styles/fonts';
import { PerformanceMonitor } from './core/components/PerformanceMonitor';

if (import.meta.env.DEV) {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('UNHANDLED RENDERER REJECTION:', event.reason);
  });
}

import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PerformanceMonitor />
      <Suspense fallback={<div className="h-screen w-screen bg-stone-950 flex items-center justify-center text-stone-500 font-serif">Loading...</div>}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);