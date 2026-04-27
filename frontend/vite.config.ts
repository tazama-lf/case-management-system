import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

const rawAllowedHosts = process.env.VITE_ALLOWED_HOSTS;
const allowedHosts: true | string[] =
  rawAllowedHosts === 'all'
    ? true
    : rawAllowedHosts
      ? rawAllowedHosts.split(',').map((h) => h.trim())
      : [];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    host: '0.0.0.0',
    allowedHosts,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
