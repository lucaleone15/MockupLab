import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// GitHub Pages serves the app from /<repo>/ — keep it overridable for forks.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/MockupLab/') : '/',
  plugins: [react(), tailwindcss()],
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
