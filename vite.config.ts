import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// Served from the site root (Netlify); BASE_PATH overrides it (e.g. a fork served from a sub-folder).
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/') : '/',
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
      includeAssets: ['app-icons/favicon-48.png', 'app-icons/favicon-32.png', 'app-icons/apple-touch-icon.png'],
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
          { src: 'app-icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'app-icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'app-icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,woff2}', 'app-icons/*.png'],
        globIgnores: ['prerender.html', 'assets/prerender-*.js', 'assets/server.browser-*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: 'index.html',
        // English addresses get the English page (prerendered after the build; prerender.mjs adds it to the
        // precache): from the network when online, else that page
        navigateFallbackDenylist: [/^\/en(\/|$)/],
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate' && /^\/en(\/|$)/.test(url.pathname),
            handler: 'NetworkFirst',
            options: { cacheName: 'mockuplab-pages', networkTimeoutSeconds: 4, precacheFallback: { fallbackURL: 'en/index.html' } },
          },
          {
            urlPattern: ({ url }) => /\/(assets\/(light|materials|photo)|samples|showcase)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'mockuplab-media', expiration: { maxEntries: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // the build output is not a source: never reload the dev page for it
  server: { watch: { ignored: ['**/dist/**'] } },
  // loaded on demand (video export): pre-bundled so the dev server never reloads mid-session
  optimizeDeps: { entries: ['index.html'], include: ['mediabunny', 'gifenc', 'three/examples/jsm/exporters/GLTFExporter.js'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      // prerender.html: build-time only (scripts/prerender.mjs renders the landing with it, then deletes it)
      input: { main: 'index.html', prerender: 'prerender.html' },
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
