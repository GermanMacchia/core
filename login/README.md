# Login MFE

Micro-frontend de login compilado como Web Component (`<login-mfe>`). El Shell Angular lo carga dinámicamente inyectando el bundle IIFE. Completamente personalizable por tenant a través de un atributo `config` JSON.

**Stack:** Svelte 5 · Vite 6 · TypeScript  
**Dev:** `http://localhost:5173`  
**Preview (IIFE):** `http://localhost:4174`  
**Build output:** `dist/login-mfe.iife.js`

---

## Uso del Web Component

El Shell inyecta el script y luego monta el elemento:

```html
<script src="http://localhost:4174/login-mfe.iife.js"></script>

<login-mfe config='{"name":"Acme Corp","logo_url":"https://cdn.acme.com/logo.png","primary_color":"#6366f1","auth_url":"http://localhost:8081"}'></login-mfe>
```

### Atributo `config`

```ts
interface Config {
  name?: string;          // Nombre del tenant (aparece en el subtítulo)
  logo_url?: string;      // URL del logo — si está vacío muestra ícono generado
  primary_color?: string; // Color hex para botón e inputs (#6366f1 por defecto)
  auth_url?: string;      // Base URL del Authenticator (http://localhost:8081 por defecto)
}
```

### Eventos emitidos

El componente emite `CustomEvent` con `composed: true` para cruzar el shadow DOM:

| Evento | `detail` | Cuándo |
|---|---|---|
| `loginsuccess` | `{ access_token, refresh_token, expires_at, user }` | Login exitoso |
| `loginerror` | `{ message, status? }` | Credenciales incorrectas o error de red |

```ts
document.querySelector('login-mfe')?.addEventListener('loginsuccess', (e) => {
  const { access_token, refresh_token, user } = (e as CustomEvent).detail;
  // guardar tokens, navegar al dashboard
});
```

---

## Desarrollo local

```bash
npm install
npm run dev
# → http://localhost:5173  (HMR activo)
```

Para previsualizar como IIFE (igual que en producción):

```bash
npm run build
npm run preview
# → http://localhost:4174/login-mfe.iife.js
```

---

## Build de producción

```bash
npm run build
# Output: dist/login-mfe.iife.js  (~55 kB, ~21 kB gzip)
```

El bundle es un único archivo IIFE auto-contenido. Servirlo desde un CDN o servidor estático y apuntar el Shell a esa URL.

---

## Estructura

```
login/
├── src/
│   ├── Login.svelte   # Componente principal — define <login-mfe>
│   └── main.ts        # Entry point del bundle
├── dist/
│   └── login-mfe.iife.js  # Bundle final (generado por `npm run build`)
├── vite.config.ts     # Configuración IIFE build
├── tsconfig.json
└── package.json
```
