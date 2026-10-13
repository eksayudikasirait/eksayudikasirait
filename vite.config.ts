import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { attachBackendMiddlewares } from './backendMiddlewares.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export { attachBackendMiddlewares };

function permanentPhotoSyncPlugin(): Plugin {
  return {
    name: 'permanent-photo-sync',
    configureServer(server) {
      attachBackendMiddlewares(server.middlewares);
    },
  };
}

function viteClientHmrFixPlugin(): Plugin {
  return {
    name: 'vite-client-hmr-fix',
    apply: 'serve',
    transform(code, id) {
      if (id.includes('@vite/client') || id.includes('client.mjs') || id.includes('bundledDevClient.mjs')) {
        let transformed = code;
        // Catch unhandled rejection from transport.connect so it never raises an uncaught exception
        transformed = transformed.replace(
          /transport\.connect\(createHMRHandler\(handleMessage\)\);?/g,
          'transport.connect(createHMRHandler(handleMessage)).catch(() => {});'
        );
        // Replace reject on WebSocket close without opened with a graceful resolve
        transformed = transformed.replace(
          /reject\(\/\* @__PURE__ \*\/ new Error\("WebSocket closed without opened\."\)\);?/g,
          'resolve();'
        );
        return transformed;
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      permanentPhotoSyncPlugin(),
      viteClientHmrFixPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'apple-touch-icon.png',
          'icon.svg',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'manifest.json',
        ],
        manifest: {
          id: '/',
          name: 'ANBK Informatika - UPTD SMP Negeri 7 Kisaran',
          short_name: 'ANBK SMPN 7',
          description:
            'Aplikasi Soal Ujian Kurikulum Merdeka (Deep Learning) Fase D Tingkat SMP Tahun Ajaran 2026/2027, Soal ini Dibuat oleh Eksa Yudika Sirait - UPTD SMP Negeri 7 Kisaran.',
          theme_color: '#020617',
          background_color: '#020617',
          display: 'standalone',
          display_override: ['standalone', 'fullscreen', 'minimal-ui'],
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webp,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /.*(?:essay-questions|questions|soal|student-dashboard-sync|student-dashboard-state|action=get.*Questions).*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'exam-questions-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      chunkSizeWarningLimit: 10000,
    },
  };
});
