import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    angular({ tsconfig: './tsconfig.app.json' }),
    tailwindcss(),
  ],
  server: {
    port: 4201,
    origin: 'http://localhost:4201',
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
  // Vite needs to pre-bundle Angular packages for the dev server
  optimizeDeps: {
    include: ['@angular/core', '@angular/common', '@angular/router', '@angular/platform-browser'],
  },
  build: {
    lib: {
      entry: 'src/main.single-spa.ts',
      formats: ['es'],
      fileName: 'manager-mfe',
    },
    outDir: 'dist-spa',
    sourcemap: true,
    assetsInlineLimit: 1_000_000,
    rollupOptions: {
      // Bundle everything — shell imports this as a standalone ES module
      external: [],
    },
  },
})
