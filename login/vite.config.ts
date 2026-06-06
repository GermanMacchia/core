import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig(({ command }) => ({
  plugins: [svelte()],

  server: {
    port: 5173,
    cors: true
  },

  ...(command === 'build' && {
    build: {
      lib: {
        entry:    'src/main.ts',
        name:     'LoginMFE',
        fileName: 'login-mfe',
        formats:  ['es']
      },
      rollupOptions: {
        output: {
          // single self-contained file — no code splitting
          inlineDynamicImports: true
        }
      },
      cssCodeSplit: false,
      outDir: 'dist'
    }
  })
}));
