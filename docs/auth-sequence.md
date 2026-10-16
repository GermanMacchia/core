# Diagrama de Secuencia: Acceso Fluido entre Shell, Core, Authenticator y Microservicios

## Modelo de despliegue

**Un shell por portal de tenant.** Un tenant puede tener N portales; cada portal tiene su propio shell desplegado:

```
shell-admin   → VITE_TENANT_ID=<uuid-acme>  VITE_PORTAL_ID=<uuid-admin>
shell-ops     → VITE_TENANT_ID=<uuid-acme>  VITE_PORTAL_ID=<uuid-ops>
shell-cliente → VITE_TENANT_ID=<uuid-beta>  VITE_PORTAL_ID=<uuid-portal-beta>
```

Los UUIDs de tenant y portal se bajan al build (variables de entorno). El shell **no necesita URL pública ni subdominio** para identificarse — los UUIDs son suficientes. El bootstrap siempre ocurre antes del login. Cada servicio MFE gestiona su propio ciclo de auth — no existe un MFE de login global en el shell.

**Bootstrap tenant-direct (shells multi-tenant).** Cuando un servicio se asocia a un tenant directamente vía `tenant_services` (sin pasar por un Portal), no aplica el modo "un shell por portal" de arriba. Este modo es para apps compartidas entre muchos tenants (por ejemplo un `booking-admin` que sirve a N tenants), a diferencia del modo portal-bound, con marca propia, un shell por portal de tenant. En ese caso el shell resuelve sus servicios llamando a `GET /api/v1/public/services` — misma resolución de tenant que `/public/config` (header `X-Tenant-ID`, sin JWT) — que devuelve los servicios habilitados del tenant junto con su MFE URL y config de instancia, sin necesitar un `portal_id`.

| Servicio | Puerto | Responsabilidad |
|---|---|---|
| **Shell** (single-spa + Vite) | 9000 | Orquestador de MFEs por portal. Bootstrap, registro de servicios, routing |
| **Authenticator** | 8081 | Emisor autoritativo de JWT. Login, Refresh, Logout, Validate. Verifica acceso usuario→servicio→tenant |
| **Core** | 8080 | Gestión de tenants, portales y servicios. Valida JWT localmente (secreto compartido) |
| **Login MFE** (Svelte) | 5173 (dev) / 4174 (preview) | Custom element `<login-mfe>`. Usado por servicios que necesitan auth |
| **Manager** (Angular) | 4200 | Panel superadmin. Tenants, servicios, usuarios |
| **MFE de negocio** | N | Micro-frontend por servicio. Gestiona su propio auth |

---

## Flujo 0: Bootstrap del Shell (siempre ocurre, antes del login)

```mermaid
sequenceDiagram
    autonumber
    participant Browser
    participant Shell as Shell :9000<br/>(VITE_TENANT_ID + VITE_PORTAL_ID)
    participant Core as Core :8080
    participant Redis
    participant DB as PostgreSQL

    Browser->>Shell: Carga la app

    Shell->>Shell: tenantId = VITE_TENANT_ID<br/>portalId = VITE_PORTAL_ID
    Note over Shell: No necesita URL ni subdominio.<br/>Los UUIDs identifican el portal.

    Shell->>Core: GET /api/v1/public/portals/{portalId}<br/>X-Tenant-ID: {tenantId}
    Note over Core: Ruta pública — sin JWT.<br/>Verifica que el portal pertenezca al tenant.

    Core->>Redis: GET tenant:{tenantId}
    alt Cache miss
        Core->>DB: GetByID(tenantId)
        DB-->>Core: tenant {id, slug, name, status}
        Core->>Redis: SET tenant:{id} TTL=5min
    end

    Core->>DB: GetPortalServices(portalId)<br/>JOIN tenant_services + services<br/>WHERE is_enabled=true AND is_active=true

    DB-->>Core: [{id, slug, name, mfe_url, api_url,<br/>  config:{auth_mfe_url, auth_api_url, public}}]

    Core-->>Shell: 200 {<br/>  tenant:{id,slug,name},<br/>  portal:{id,slug,name,config},<br/>  services:[<br/>    {id,slug,name,mfe_url,auth_mfe_url,auth_api_url,public,sort_order}<br/>  ]<br/>}

    Shell->>Shell: Para cada servicio: registerApplication()<br/>customProps incluye authMfeUrl + authApiUrl
    Shell->>Shell: start() — single-spa toma el control del routing
    Note over Shell: Si pathname === "/" → navigateToUrl("/manager")<br/>Shell redirige al primer servicio del portal.<br/>Cada MFE gestiona su propio auth.
```

---

## Flujo 1: Acceso a MFE público (sin auth)

> El servicio tiene `public: true`. Se activa directo por ruta sin ningún guard.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Shell as Shell :9000
    participant MFE as MFE "home" (público)

    Usuario->>Shell: Navega a /home
    Shell->>Shell: activeWhen(["/home"]) → true
    Shell->>MFE: import(service.entry) → bootstrap/mount
    MFE-->>Shell: Componente montado en #shell-content
    Shell-->>Usuario: Contenido público

    Note over Shell,MFE: No se llama al Authenticator.<br/>No se requiere token.
```

---

## Flujo 2: Acceso a MFE protegido — el MFE gestiona su propio auth

> El servicio tiene `public: false`. El shell lo monta igual que uno público — es el MFE quien decide mostrar login si no hay sesión activa.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Shell as Shell :9000
    participant MFE as MFE "dashboard" (protegido)
    participant LoginMFE as Login MFE (Svelte)
    participant Auth as Authenticator :8081

    Usuario->>Shell: Navega a /dashboard
    Shell->>Shell: activeWhen(["/dashboard"]) → true
    Shell->>MFE: mount(customProps)<br/>{tenant, portal, serviceId,<br/> authMfeUrl, authApiUrl}
    Note over MFE: El MFE verifica si tiene token.<br/>Si no, carga su propio auth MFE.

    MFE->>LoginMFE: import(authMfeUrl) → mount
    LoginMFE->>LoginMFE: Renderiza <login-mfe>

    Usuario->>LoginMFE: email + password
    LoginMFE->>Auth: POST {authApiUrl}/auth/login {email, password}
    Note over Auth: Verifica credenciales.<br/>Verifica acceso usuario→servicio→tenant.
    Auth-->>LoginMFE: 200 {access_token, refresh_token, user}

    LoginMFE->>MFE: evento loginsuccess con tokens
    MFE->>MFE: Guarda tokens + monta su contenido
    MFE-->>Usuario: Dashboard autenticado
```

---

## Flujo 3: Acceso al Manager (superadmin)

> El Manager es un servicio registrado en el portal del superadmin. Su MFE gestiona su propio auth como cualquier otro servicio.

```mermaid
sequenceDiagram
    autonumber
    actor Superadmin
    participant Shell as Shell :9000<br/>(VITE_PORTAL_ID=admin-portal)
    participant ManagerMFE as Manager MFE :4200
    participant LoginMFE as Login MFE Svelte :5173
    participant Auth as Authenticator :8081

    Superadmin->>Shell: Navega a /manager
    Shell->>Shell: Bootstrap ya cargó el portal.<br/>El manager está en services[].
    Shell->>ManagerMFE: mount(customProps)<br/>{tenant, portal, serviceId,<br/> authMfeUrl:"http://localhost:5173/src/main.ts",<br/> authApiUrl:"http://localhost:8081"}

    ManagerMFE->>LoginMFE: import(authMfeUrl) → mount
    Superadmin->>LoginMFE: email + password
    LoginMFE->>Auth: POST /auth/login {email, password}
    Auth-->>LoginMFE: 200 {access_token, user:{role:"superadmin"}}

    LoginMFE->>ManagerMFE: tokens via loginsuccess
    ManagerMFE->>ManagerMFE: Guarda tokens + carga dashboard
    ManagerMFE-->>Superadmin: Panel — Tenants / Servicios
```

**Acceso directo al manager** (sin shell):
El Manager también expone su propia página `/login` que llama directamente a `POST http://localhost:8081/auth/login`.

---

## Flujo 4: MFE protegido llama a su backend

> El MFE ya está montado y el usuario está autenticado. El MFE valida el token con el Authenticator antes de operar.

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant MFE as MFE "dashboard" (protegido)
    participant Auth as Authenticator :8081
    participant BackendMF as Backend del MFE

    Usuario->>MFE: Interacción
    MFE->>MFE: Lee access_token del Shell<br/>(CustomEvent / shared signal / window.__shell)

    MFE->>Auth: GET /auth/validate<br/>Authorization: Bearer access_token
    alt Token inválido o expirado
        Auth-->>MFE: 401
        MFE->>MFE: Emite evento "auth:expired" → Shell hace refresh o redirige a login
    end
    Auth-->>MFE: 200 {sub, tenant_id, tenant, role, services, exp}

    MFE->>BackendMF: GET /api/recurso<br/>Authorization: Bearer access_token
    BackendMF-->>MFE: 200 {data}
    MFE-->>Usuario: Renderiza resultado
```

---

## Flujo 5: Refresh silencioso

```mermaid
sequenceDiagram
    autonumber
    participant Shell as Shell :4200
    participant Auth as Authenticator :8081
    participant DB as PostgreSQL

    Note over Shell: HTTP interceptor detecta 401<br/>o token próximo a expirar

    Shell->>Auth: POST /auth/refresh {refresh_token}
    Auth->>DB: GetRefreshToken(hash(refresh_token))
    alt No encontrado / revocado / expirado
        Auth-->>Shell: 401
        Shell->>Shell: clearTokens() → redirige a login
    end
    Auth->>DB: RevokeRefreshToken(old_hash)  ← rotación one-use
    Auth->>Auth: Nuevo JWT + nuevo refresh_token
    Auth->>DB: SaveRefreshToken(new_hash)
    Auth-->>Shell: 200 {access_token, refresh_token, expires_at}

    Shell->>Shell: setTokens() — actualiza sessionStorage
    Shell->>Shell: Reintenta request original
```

---

## Flujo 6: Logout

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Shell as Shell :4200
    participant Auth as Authenticator :8081
    participant DB as PostgreSQL

    Usuario->>Shell: "Cerrar sesión"
    Shell->>Auth: POST /auth/logout {refresh_token}
    Auth->>DB: RevokeRefreshToken(hash(refresh_token))
    Auth-->>Shell: 200 {message: "logged out"}

    Shell->>Shell: clearTokens() — limpia sessionStorage
    Shell->>Shell: Descarga MFEs protegidos
    Shell->>Shell: Navega a / (landing pública del tenant)

    Note over Shell: El access_token sigue válido hasta exp.<br/>Para invalidación inmediata: Core verifica<br/>blacklist:<jti> en Redis en cada request.
```

---

## Diagrama completo: ciclo de vida de una sesión

```mermaid
sequenceDiagram
    autonumber
    actor Usuario
    participant Shell as Shell :9000
    participant MFE as MFE (servicio)
    participant LoginMFE as Login MFE Svelte
    participant Auth as Authenticator :8081
    participant Core as Core :8080
    participant Redis
    participant DB as PostgreSQL

    rect rgb(220, 235, 255)
        Note over Shell,DB: 0 — BOOTSTRAP (siempre, sin token)
        Shell->>Core: GET /api/v1/public/portals/{portalId}<br/>[X-Tenant-ID: tenantId]
        Core->>Redis: Resolve tenant (cache o DB)
        Core->>DB: GetPortalServices(portalId)
        Core-->>Shell: {tenant, portal, services:[{authMfeUrl,authApiUrl,...}]}
        Shell->>Shell: registerApplication() para cada servicio
    end

    rect rgb(200, 240, 200)
        Note over Usuario,MFE: 1 — ACCESO PÚBLICO (sin auth)
        Usuario->>Shell: Navega a ruta pública
        Shell->>MFE: mount(customProps)
        MFE-->>Usuario: Contenido sin auth
    end

    rect rgb(255, 245, 210)
        Note over Usuario,Auth: 2 — LOGIN EN MFE PROTEGIDO
        Usuario->>Shell: Navega a ruta protegida
        Shell->>MFE: mount({authMfeUrl, authApiUrl, ...})
        MFE->>LoginMFE: import(authMfeUrl) → mount
        Usuario->>LoginMFE: email + password
        LoginMFE->>Auth: POST {authApiUrl}/auth/login
        Auth->>DB: Verificar + emitir JWT + refresh_token
        Auth-->>LoginMFE: {access_token, refresh_token, user}
        LoginMFE->>MFE: loginsuccess con tokens
        MFE->>MFE: Guarda tokens → monta contenido
        MFE-->>Usuario: App autenticada
    end

    rect rgb(235, 220, 255)
        Note over Usuario,Auth: 3 — USO DE MFE PROTEGIDO
        Usuario->>MFE: Interacción
        MFE->>Auth: GET /auth/validate [Bearer token]
        Auth-->>MFE: {sub, tenant_id, role, services}
        MFE->>MFE: Llama a su backend con el token
        MFE-->>Usuario: Datos
    end

    rect rgb(220, 240, 255)
        Note over MFE,DB: 4 — REFRESH SILENCIOSO
        MFE->>Auth: POST /auth/refresh {refresh_token}
        Auth->>DB: Rotar refresh_token (one-use)
        Auth-->>MFE: Nuevo {access_token, refresh_token}
    end

    rect rgb(255, 220, 220)
        Note over Usuario,MFE: 5 — LOGOUT
        Usuario->>MFE: Cerrar sesión
        MFE->>Auth: POST /auth/logout {refresh_token}
        Auth->>DB: Revocar refresh_token
        Auth-->>MFE: OK
        MFE->>MFE: clearTokens() → estado inicial
    end
```

---

## Notas de diseño

### Shell (single-spa)

- **Un shell por portal de tenant**: Identificado por `VITE_TENANT_ID` + `VITE_PORTAL_ID` (UUIDs). No necesita URL ni subdominio. Un tenant puede tener N portales, cada uno con su propio shell y su propio conjunto de servicios.
- **Fuentes de config en orden de prioridad**: `window.__SHELL_CONFIG__` → `VITE_CORE_API_URL` + UUIDs (endpoint de portal) → `VITE_SERVICES_API_URL` → `/mock/services.json`. Ver `.env`.
- **Sin auth global**: El shell no registra un MFE de login global. No gestiona tokens, no tiene `AuthStore`, no redirecciona a `/login`. Cada servicio MFE es autónomo en su auth (ejemplo: el Manager redirige internamente a `/manager/login`).
- **Redirect inicial**: Tras `start()`, si el pathname es `/`, el shell llama a `navigateToUrl('/{primer_servicio.slug}')`. Esto garantiza que siempre se cargue un MFE al abrir la app.
- **Activación puramente por ruta**: `buildActiveWhen` activa el MFE según la URL solamente. `public: true/false` es informativo para el MFE; el shell no diferencia su comportamiento.
- **`customProps` por servicio**: Cada MFE recibe `{ domElementGetter, tenant, portal, serviceId, authMfeUrl, authApiUrl }`. Con `authMfeUrl` y `authApiUrl` el MFE puede montar su propio login sin hardcodear URLs.
- **Identificación del portal**: `resolveTenantId()` y `resolvePortalId()` en `src/config.js` leen de `window.__SHELL_CONFIG__` primero, luego de las variables de entorno.

### Core API

- **`GET /api/v1/public/portals/{portal_id}`** (header `X-Tenant-ID`): Ruta pública. Verifica que el portal pertenezca al tenant. Devuelve `{ tenant, portal, services:[{id,slug,name,mfe_url,auth_mfe_url,auth_api_url,public,sort_order}] }`. Los campos `auth_mfe_url`, `auth_api_url` y `public` salen de `service.config || portal_services.config_override` (merge JSONB).
- **`GET /api/v1/public/config`** (legacy): Ruta pública original. Resuelve tenant por `X-Tenant-Slug` header o subdominio. Mantiene compatibilidad con mocks/legados.
- **`GET /api/v1/me/context`**: Ruta protegida (JWT). Devuelve `{tenant, user, services:[]}`. Útil para MFEs que quieren verificar servicios autorizados post-login.

### Authenticator

- **MFEs sin JWT_SECRET**: Los backends de MFEs usan `GET /auth/validate` del Authenticator para introspección. No necesitan el secreto.
- **Rotación de refresh tokens**: One-use — cada `/auth/refresh` revoca el token anterior y emite uno nuevo.
- **Blacklist de access tokens**: Core verifica `blacklist:<jti>` en Redis en cada request protegido. Para logout inmediato, agregar el `jti` con TTL = tiempo restante del token.
