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
│       ├── admin.service.ts   # HTTP calls al Core API
│       └── mfe-loader.service.ts  # Dynamic script injection
├── pages/
│   ├── dashboard/             # Lista MFEs habilitados del portal
│   ├── login-page/            # Carga y monta <login-mfe>
│   ├── services/              # Catálogo de servicios (superadmin)
│   ├── tenant-detail/         # Detalle de tenant + usuarios + servicios
│   └── tenants/               # Lista de tenants (superadmin)
└── shell/
    ├── shell.component.ts     # Layout base con navbar y router-outlet
    └── shell.component.html
```
