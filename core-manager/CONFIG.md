# Manager MFE — Configuración

## Archivos de configuración Vite

| Archivo | Propósito |
|---------|-----------|
| `vite.dev.config.ts` | Desarrollo standalone como SPA normal (puerto 4200, sin single-spa) |
| `vite.single-spa.config.ts` | Build y dev como microfrontend single-spa (puerto 4201, salida en `dist-spa/`) |

### `vite.dev.config.ts`

Configuración mínima: plugins de Angular y Tailwind, servidor en puerto 4200 con `open: true`. No produce artefacto MFE.

### `vite.single-spa.config.ts`

- **Entry:** `src/main.single-spa.ts`
- **Formato:** ES module (`formats: ['es']`)
- **Salida:** `dist-spa/manager-mfe.js` (todo bundleado, sin externos)
- **Assets:** `assetsInlineLimit: 1_000_000` — imágenes y fuentes se inlinean en el bundle para evitar dependencias de rutas relativas cross-origin
- **Plugin `emitDeployFiles`:** al finalizar el build genera automáticamente `index.html` (standalone), `_headers` (CORS) y `_redirects` (SPA fallback), inyectando `AUTH_API_URL` del entorno

## Scripts

| Script | Comando subyacente | Descripción |
|--------|--------------------|-------------|
| `start` | `vite serve --config vite.dev.config.ts` | Dev standalone, SPA en puerto 4200 |
| `build` | `vite build --config vite.single-spa.config.ts` | Build de producción MFE → `dist-spa/` |
| `single-spa:serve` | `vite serve --config vite.single-spa.config.ts` | Dev como MFE en puerto 4201 con CORS habilitado |
| `single-spa:serve:static` | `vite build --watch` + `serve dist-spa` | Watch + servidor estático del bundle en puerto 4201 |
| `single-spa:build` | `vite build --config vite.single-spa.config.ts` | Alias explícito de `build` |
| `format` | `prettier --write` | Formatea `src/**/*.ts` y `test/**/*.ts` |

## Variables de entorno

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| `AUTH_API_URL` | `https://auth.tu-dominio.com` | URL base del authenticator. Se embebe en el `index.html` standalone al buildear. En modo MFE real, el shell la inyecta vía props. |
| `VITE_CORE_API_URL` | `https://api.tu-dominio.com` | URL base de core-backend. Se embebe en el bundle al buildear (`import.meta.env`). Sin definir usa `http://localhost:8080`. |
| `VITE_AUTH_API_URL` | `https://auth.tu-dominio.com` | URL base de core-authenticator para el login standalone. Si el shell inyecta `authApiUrl`, gana esa. Sin definir usa `http://localhost:8081`. |

Copiar `.env.example` → `.env` antes de buildear.

## Paquetes relevantes

### Runtime

| Paquete | Versión | Rol |
|---------|---------|-----|
| `@angular/*` | ^22 | Framework principal |
| `rxjs` | ~7.8 | Reactividad |
| `tailwindcss` | ^4.3 | Estilos utilitarios |
| `daisyui` | ^5.5 | Componentes UI sobre Tailwind |
| `bootstrap-icons` | ^1.13 | Iconografía (inyectada en Shadow DOM) |
| `@germanmacchia/angular-ui` | ^1.0.3 | Librería de componentes interna |

### Dev / build

| Paquete | Rol |
|---------|-----|
| `@analogjs/vite-plugin-angular` | Integra Angular con Vite (compilador, HMR) |
| `@tailwindcss/vite` | Plugin Vite para Tailwind v4 |
| `vite` | ^6 — bundler y dev server |
| `concurrently` | Ejecuta watch + serve en paralelo (`single-spa:serve:static`) |
| `serve` | Servidor estático para `dist-spa/` en dev |
| `typescript` | ~6.0 |

## Integración con el shell (single-spa)

El shell carga el artefacto como ES module y llama al ciclo de vida:

```js
import { bootstrap, mount, unmount } from 'https://cdn.ejemplo.com/manager-mfe.js'
```

### Props que acepta `mount`

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `authApiUrl` | `string` | `http://localhost:8081` | URL del authenticator |
| `domElementGetter` | `() => Element` | `#shell-content` | Elemento donde montar el MFE |
| `basePath` | `string` | `/manager` | `APP_BASE_HREF` para el router Angular |
| `serviceId` | `string` | — | Activar modo "dentro del shell" en el auth guard |

El shell también puede exponer estas props vía `window.__SHELL_CONTEXT__`; `mount` hace merge dando prioridad a las props directas.

## CSS y Shadow DOM

Los estilos (Tailwind + Bootstrap Icons) se importan con `?inline` y se inyectan en el Shadow DOM del componente raíz mediante `adoptedStyleSheets`. El shell no necesita cargar ningún CSS del MFE.

Las `@font-face` de Bootstrap Icons se registran en `document.head` (fuera del Shadow DOM) para evitar restricciones cross-origin en la resolución de URLs de fuentes, prefijando la URL con el origen del MFE.

## CORS

El MFE se sirve siempre desde un origen distinto al shell. Todos los modos lo contemplan:

- **Dev (`single-spa:serve`):** Vite incluye `Access-Control-Allow-Origin: *` en las respuestas del servidor
- **Producción:** el build genera `dist-spa/_headers` con `Access-Control-Allow-Origin: *`

## Despliegue en Netlify

`netlify.toml` preconfigurado:

```toml
[build]
  command   = "npm run build"
  publish   = "dist-spa"

[[headers]]
  for = "/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

Los archivos `_headers` y `_redirects` generados por el build son equivalentes y funcionan también en Cloudflare Pages.
