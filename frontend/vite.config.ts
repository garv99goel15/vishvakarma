import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3100,
    host: true,               // listen on 0.0.0.0 — LAN accessible
    allowedHosts: 'all',      // allow tunnels (ngrok, localtunnel, etc.)
    proxy: {
      '/api': {
        target: 'http://localhost:4600',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4600',
        ws: true,
      },
    },
  },
});
