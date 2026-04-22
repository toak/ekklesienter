import React from 'react';
import { createRoot } from 'react-dom/client';
import { RemoteApp } from './RemoteApp';
import '../core/styles/globals.css';
import '../core/styles/fonts';
import '../core/i18n';

const container = document.getElementById('remote-root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <RemoteApp />
  </React.StrictMode>
);
