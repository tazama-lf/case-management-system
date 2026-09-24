import { defineConfig, loadEnv } from 'vite';
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

const BACKEND_ROUTE_PREFIXES = [
  '/api',
  '/v1',
  '/voila-proxy',
  '/voila',
  '/admin',
  '/async-tasks',
  '/ingest-alert',
  '/socket.io',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5175,
      host: '0.0.0.0',
      allowedHosts,
      proxy: proxyTarget
        ? Object.fromEntries(
            BACKEND_ROUTE_PREFIXES.map((prefix) => [
              prefix,
              { target: proxyTarget, changeOrigin: true, ws: true },
            ]),
          )
        : undefined,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
