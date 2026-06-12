# Manager — Shell Angular

Aplicación host que orquesta la carga dinámica de Micro-Frontends para la plataforma multi-tenant. Al iniciar, intenta resolver la configuración del portal activo desde el Core API y carga dinámicamente los MFEs habilitados para ese portal.

**Stack:** Angular 22 · Tailwind CSS v4 · DaisyUI v5 · TypeScript  
**Puerto:** 4200  
**Patrón MFE:** Web Components (Custom Elements) + inyección dinámica de `<script>`

---

## Requisitos

| Herramienta | Versión |
|---|---|
| Node.js | 20+ |
| npm | 9+ |
| Angular CLI | 22+ |

---

## Inicio rápido

```bash
npm install
npx ng serve
# → http://localhost:4200
```

La app asume los siguientes servicios corriendo localmente:

| Servicio | URL |
|---|---|
| Core API | `http://localhost:8080` |
| Authenticator | `http://localhost:8081` |
| Login MFE (IIFE preview) | `http://localhost:4174` |

---

## Rutas

| Ruta | Componente | Guard |
|---|---|---|
| `/login` | `LoginPageComponent` | — |
| `/` | `DashboardComponent` (dentro de `ShellComponent`) | `authGuard` |
| `/tenants` | `TenantsComponent` | `authGuard` + `superAdminGuard` |
| `/tenants/:id` | `TenantDetailComponent` | `authGuard` |
| `/services` | `ServicesComponent` | `authGuard` + `superAdminGuard` |

---

## Servicios principales

### `AuthService`
Gestión de tokens con Angular Signals. Persiste en `sessionStorage`.

```ts
authService.isAuthenticated  // computed signal<boolean>
authService.currentUser      // signal<AuthUser | null>
authService.setTokens(tokens)
authService.clearTokens()
authService.getRefreshToken()
```

### `TenantService`
Carga la configuración pública del portal desde el Core API en el arranque (`APP_INITIALIZER`).

```ts
tenantService.config  // signal<TenantConfig>
tenantService.loadConfig()  // GET /api/v1/public/config
```

### `AdminService`
Llamadas HTTP autenticadas al Core API para la gestión de tenants, servicios y usuarios.

```ts
adminService.listTenants()
adminService.createTenant(body)
adminService.getTenant(id)
adminService.updateTenant(id, body)
adminService.deleteTenant(id)
adminService.listServices()
adminService.createService(body)
adminService.getTenantServices(tenantId)
adminService.enableService(tenantId, serviceId)
adminService.disableService(tenantId, serviceId)
adminService.getTenantUsers(tenantId)
adminService.createTenantUser(tenantId, body)
```

### `MfeLoaderService`
Inyecta `<script>` tags dinámicamente para cargar bundles IIFE de MFEs. Evita cargar el mismo bundle dos veces.

```ts
mfeLoaderService.load(url: string): Promise<void>
mfeLoaderService.isLoaded(url: string): boolean
```

---

## Flujo de arranque

```
1. APP_INITIALIZER llama TenantService.loadConfig()
       ↓ GET /api/v1/public/config  (falla silenciosamente si no está disponible)
2. authGuard verifica token en sessionStorage
       ├── token válido → Shell + Dashboard
       └── sin token   → redirect /login
3. LoginPageComponent carga <login-mfe> via MfeLoaderService
       ↓ POST /auth/login al Authenticator
       ↓ evento 'loginsuccess' (CustomEvent, composed: true)
       ↓ NgZone.run() → authService.setTokens() → navigate('/')
```

---

## Build

```bash
npx ng build
# Output: dist/manager/
```

---

## Tests

```bash
npx ng test    # Vitest
npx ng e2e     # E2E (requiere configurar framework)
```

---

## Estructura

```
manager/src/app/
├── app.config.ts              # HTTP client, router, APP_INITIALIZER
├── app.routes.ts              # Lazy routes con guards
├── core/
│   ├── guards/
│   │   ├── auth.guard.ts      # Verifica authService.isAuthenticated
│   │   └── role.guard.ts      # superAdminGuard — verifica role === 'superadmin'
│   ├── models/
│   │   └── tenant.model.ts    # Interfaces: Tenant, Service, TenantConfig, AuthUser, etc.
│   └── services/
│       ├── auth.service.ts    # Signals + sessionStorage
│       ├── tenant.service.ts  # Signal config + loadConfig()
│       └── admin.service.ts   # HTTP calls al Core API
├── layout/
│   └── layout.component.ts    # lib-drawer-bar + router-outlet (rutas autenticadas)
└── pages/
    ├── dashboard/
    ├── login-page/
    ├── services/
    ├── tenant-detail/
    └── tenants/
```

---

## CSS y estilos

### Paquetes

| Paquete | Versión | Rol |
|---|---|---|
| `tailwindcss` | v4 | Utilidades CSS — configurado vía `@tailwindcss/vite` |
| `daisyui` | v5 | Componentes UI — registrado como `@plugin "daisyui"` en `styles.css` |
| `bootstrap-icons` | v1.13+ | Iconos font-based (`bi bi-xxx`) |
| `@germanmacchia/angular-ui` | v1.0+ | Librería de componentes Angular compartida |

### Configuración de Tailwind (`src/styles.css`)

```css
@import 'tailwindcss';

/* Escanea el bundle compilado de la librería para incluir las clases que usa */
@source '../node_modules/@germanmacchia/angular-ui/fesm2022/*.mjs';

@plugin "daisyui" {
  themes: corporate --default, light, dark;
}
```

> **Por qué `@source`:** Tailwind v4 detecta automáticamente archivos del proyecto pero no siempre escanea dependencias en `node_modules`. Sin esta línea, las clases de DaisyUI usadas por componentes de `@germanmacchia/angular-ui` no se generan y los componentes aparecen sin estilo.

### Shadow DOM y inyección de CSS (`src/main.single-spa.ts`)

El componente raíz usa `ViewEncapsulation.ShadowDom`. Esto aísla los estilos del manager del shell que lo carga, pero requiere inyectar el CSS manualmente dentro del shadow root:

```
styles.css?inline  ──────────────────────────────┐
                                                  ▼
bootstrap-icons.css?inline  ──►  adoptedStyleSheets  ──►  shadow root de <app-root>
```

#### Por qué `?inline` y no `<link>`

Un build de tipo `lib` en Vite extrae el CSS a un archivo separado que el shell nunca carga. Con `?inline` el CSS queda embebido en el bundle JS y se inyecta programáticamente en el `mount()` del ciclo de vida de single-spa.

#### Problema de URLs de fuentes en dev

En modo dev, Vite resuelve los `url()` de `@font-face` a paths relativos al servidor MFE (ej. `/node_modules/bootstrap-icons/font/fonts/...`). Cuando el CSS se inyecta vía `adoptedStyleSheets` desde el shell (distinto puerto), el browser resuelve esos paths contra el origin del shell → la fuente no carga.

**Solución:** Los bloques `@font-face` se inyectan en `document.head` con las URLs prefijadas por el origin del MFE (`new URL(import.meta.url).origin`). La fuente queda registrada globalmente y los elementos dentro del shadow root la pueden usar. En producción esto no aplica porque `assetsInlineLimit: 1_000_000` en `vite.single-spa.config.ts` inlinea las fuentes como base64.

### Componentes de `@germanmacchia/angular-ui` en uso

| Componente | Selector | Dónde |
|---|---|---|
| `DrawerBar` | `lib-drawer-bar` | `LayoutComponent` — sidebar colapsable con tema y logout |
