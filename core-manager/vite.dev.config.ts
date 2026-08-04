import { defineConfig } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    angular({ tsconfig: './tsconfig.app.json' }),
    tailwindcss(),
  ],
  server: {
    port: 4200,
    open: true,
  },
  optimizeDeps: {
    include: ['@angular/core', '@angular/common', '@angular/router', '@angular/platform-browser'],
  },
  build: {
    assetsInlineLimit: 1_000_000,
  },
})
