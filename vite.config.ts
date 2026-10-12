import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves the app from /<repo>/ — keep it overridable for forks.
export default defineConfig(({ command, isPreview, mode }) => ({
  // the desktop app serves the build from app://mockuplab/ (mode "desktop")
  base: mode === 'desktop' ? '/' : command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/MockupLab/') : '/',
  // a new id per build: the app can tell which version runs (update checks, tests)
  define: { __BUILD_ID__: JSON.stringify(process.env.BUILD_ID ?? Date.now().toString(36)) },
  plugins: [
    react(),
    tailwindcss(),
    // installable app: the code is cached at install, textures and photos when first used;
    // a new version is only applied when the user accepts it
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'MockupLab',
        short_name: 'MockupLab',
        description: 'Tes designs, mis en scène : mock-ups 3D et photo, gratuits, dans ton navigateur.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f5f5f7',
        theme_color: '#f5f5f7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2}', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/(assets\/(light|materials|photo)|samples)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'mockuplab-media', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // loaded on demand (video export): pre-bundled so the dev server never reloads mid-session
  optimizeDeps: { include: ['mediabunny', 'gifenc'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // stable vendor chunks: an app update does not invalidate the cached 3D engine
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]three[\\/]/.test(id)) return 'three';
          if (/@react-three|three-stdlib|maath|camera-controls/.test(id)) return 'r3f';
          if (/[\\/](react|react-dom|scheduler|zustand|zundo|radix-ui|@radix-ui)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
}));
