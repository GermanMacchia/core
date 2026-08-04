import { defineConfig, loadEnv, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import fs from 'node:fs';
import path from 'node:path';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  function emitStandaloneHtml(): Plugin {
    return {
      name: 'emit-standalone-html',
      closeBundle() {
        const config = JSON.stringify({
          name:          env.TENANT_NAME          ?? 'Platform',
          logo_url:      env.TENANT_LOGO_URL      ?? '',
          primary_color: env.TENANT_PRIMARY_COLOR ?? '#6366f1',
          auth_url:      env.AUTH_URL             ?? '',
        });
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${env.TENANT_NAME ?? 'Login'}</title>
  <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { background: #f1f5f9; }</style>
</head>
<body>
  <login-mfe config='${config.replace(/'/g, '&apos;')}'></login-mfe>
  <script type="module" src="./login-mfe.js"></script>
</body>
</html>`;
        const distDir = path.resolve(__dirname, 'dist');
        fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf-8');
        fs.writeFileSync(path.join(distDir, '_headers'), `/*\n  Access-Control-Allow-Origin: *\n`, 'utf-8');
        fs.writeFileSync(path.join(distDir, '_redirects'), `/*  /index.html  200\n`, 'utf-8');
      }
    };
  }

  return {
    plugins: [svelte(), ...(command === 'build' ? [emitStandaloneHtml()] : [])],

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
            inlineDynamicImports: true
          }
        },
        cssCodeSplit: false,
        outDir: 'dist'
      }
    })
  };
});
