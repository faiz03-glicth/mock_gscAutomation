import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
// The dashboard talks to the Node/Express backend only through `/api/*`
// (and reads static artifacts from `/artifacts/*`) - this proxy is what
// lets the frontend call relative paths like `fetch('/api/tests')` in dev
// without hardcoding `http://localhost:3000`, and without needing CORS
// beyond what the backend already sets.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
            '/artifacts': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
