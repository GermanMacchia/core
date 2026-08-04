import { defineConfig, loadEnv, type Plugin } from 'vite'
import angular from '@analogjs/vite-plugin-angular'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  function emitDeployFiles(): Plugin {
    return {
      name: 'emit-deploy-files',
      closeBundle() {
        const distDir = path.resolve(__dirname, 'dist-spa')
        const authApiUrl = env.AUTH_API_URL ?? ''

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Manager</title>
</head>
<body>
  <div id="shell-content" style="min-height:100vh"></div>
  <script type="module">
    import { bootstrap, mount } from './manager-mfe.js'
    await bootstrap({})
    await mount({ authApiUrl: '${authApiUrl}', domElementGetter: () => document.getElementById('shell-content') })
  </script>
</body>
</html>`

        fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf-8')
        fs.writeFileSync(path.join(distDir, '_headers'), `/*\n  Access-Control-Allow-Origin: *\n`, 'utf-8')
        fs.writeFileSync(path.join(distDir, '_redirects'), `/*  /index.html  200\n`, 'utf-8')
      }
    }
  }

  return {
    plugins: [
      angular({ tsconfig: './tsconfig.app.json' }),
      tailwindcss(),
      emitDeployFiles(),
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
  }
})
