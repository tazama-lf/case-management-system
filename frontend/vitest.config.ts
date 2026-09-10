import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    // Stops happy-dom from actually navigating <iframe src="..."> in tests
    // (e.g. VoilaFrame) - that real request always fails here and surfaces
    // as unrelated unhandled-rejection noise, sometimes failing the run.
    environmentOptions: {
      happyDOM: {
        settings: {
          navigation: {
            disableChildFrameNavigation: true,
          },
        },
      },
    },
    testTimeout: 20000,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
