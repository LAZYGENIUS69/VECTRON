import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// DEBUG: Catch all errors and send to local node server
const sendError = (err: any) => {
    try {
        fetch('http://localhost:9999', {
            method: 'POST',
            body: JSON.stringify({ error: err ? err.toString() : 'Unknown Error', stack: err?.stack || '' })
        }).catch(() => console.log('Telemetry failed'));
    } catch (e) { }
};
window.addEventListener('error', e => sendError(e.error));
window.addEventListener('unhandledrejection', e => sendError(e.reason));
const oldError = console.error;
console.error = (...args) => {
    sendError(args.join(' '));
    oldError(...args);
};

createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
