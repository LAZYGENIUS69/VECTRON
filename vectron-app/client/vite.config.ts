import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    // SPA now owns routing:
    // - /      -> Landing
    // - /app   -> VECTRON UI
    // So Vite should be served from root in both dev + prod.
    base: '/',
    plugins: [react()],
    server: {
        proxy: {
            '/health': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
});
