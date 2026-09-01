# Platform — Arquitectura Multi-Tenant

Plataforma de microservicios multi-tenant. Cuatro aplicaciones independientes coordinadas: dos APIs en Go, un shell Angular que actúa de host MFE y un micro-frontend de login en Svelte compilado como Web Component.

---

## Aplicaciones

### `core-backend/` — Tenant Core API · Go · Puerto 8080

El componente central de la plataforma. Gestiona el catálogo de tenants y servicios, resuelve el contexto de cada request y expone la configuración que el Shell necesita para cargar los MFEs correctos.

**Responsabilidades:**
- CRUD de tenants y planes
- Catálogo de servicios (MFEs) disponibles en la plataforma
- Control de qué servicios tiene habilitados cada tenant (`tenant_services`)
- Gestión de portales: cada tenant puede tener múltiples portales independientes (`tenant_portals`), cada uno con su propio dominio/slug y subset de servicios (`portal_services`)
- `GET /api/v1/public/config` — configuración pública para el arranque del Shell (sin auth, resuelve el portal por dominio)
- `GET /api/v1/me/context` — contexto autenticado: tenant + portal activo + servicios + rol del usuario
- Validación de JWT (verifica, nunca firma)
- Rate limiting y resolución de tenant/portal por dominio, header o JWT

**Stack:** Go 1.22 · Chi · pgx/v5 · Redis · Zap  
**Base de datos:** PostgreSQL `core_db` (plans, tenants, services, tenant_services, tenant_portals, portal_services, users, refresh_tokens, audit_logs)

---

### `core-authenticator/` — Auth Service · Go · Puerto 8081

Microservicio independiente, responsable exclusivo de la autenticación. Único firmante de JWT. El Core y cualquier otro servicio solo verifican la firma con el mismo `JWT_SECRET`.

**Responsabilidades:**
- `POST /auth/login` — emite access token + refresh token
- `POST /auth/refresh` — rota el refresh token y emite uno nuevo
- `POST /auth/logout` — revoca el refresh token activo
- `GET /auth/validate` — introspección de JWT para otros microservicios (devuelve claims decodificados)
- Hash de contraseñas con bcrypt y hash de refresh tokens con SHA-256

**Stack:** Go 1.22 · Chi · pgx/v5 · Redis · Zap  
**Base de datos:** PostgreSQL `core_db` — misma instancia que Core, tablas `users` + `refresh_tokens`

> `JWT_SECRET` debe ser idéntico en `core-backend/.env` y `core-authenticator/.env`.

---

### `core-manager/` — Shell Angular · Angular 22 · Puerto 4200

Aplicación host que orquesta la carga dinámica de Micro-Frontends. Al iniciar resuelve el portal activo (por dominio) y carga únicamente los MFEs habilitados en ese portal. Usa inyección de `<script>` y Custom Elements como mecanismo de MFE (framework-agnostic, no requiere Webpack Module Federation).

**Responsabilidades:**
- Resolución del portal activo al inicio (`GET /api/v1/public/config` via `APP_INITIALIZER` — el Core devuelve tenant + portal + MFEs del portal)
- Carga dinámica de MFEs inyectando `<script>` tags con la URL del bundle IIFE
- Auth guard y gestión de tokens (signals, sessionStorage)
- Comunicación con el Auth Service a través del MFE de login
- Layout base con navbar, rutas lazy y dashboard de MFEs habilitados en el portal activo

**Stack:** Angular 22 · Tailwind CSS v4 · DaisyUI v5 · TypeScript  
**Patrón MFE:** Web Components (Custom Elements) + dynamic script injection

---

### `core-login/` — Login MFE · Svelte 5 · Dev :5173 · Preview :4174

Micro-frontend de login compilado como Web Component (`<login-mfe>`). El Shell lo carga dinámicamente inyectando el bundle IIFE. Completamente personalizable por tenant a través de un atributo `config` JSON.

**Responsabilidades:**
- Renderiza un formulario de login estilizado según la marca del tenant
- Se comunica directamente con el Auth Service (`POST /auth/login`)
- Emite `loginsuccess` / `loginerror` como `CustomEvent` con `composed: true` para cruzar el shadow DOM hacia Angular
- Zero dependencias externas de UI — CSS puro con `--primary` como custom property para theming

**Stack:** Svelte 5 · Vite · TypeScript  
**Build:** `dist/login-mfe.iife.js` (~55 kB, ~21 kB gzip)

**Config que recibe el Web Component:**
```json
{
  "name": "Acme Corp",
  "logo_url": "https://cdn.acme.com/logo.png",
  "primary_color": "#6366f1",
  "auth_url": "http://localhost:8081"
}
```

---

## Arquitectura

```
CLIENT / BROWSER
      │
      ▼
NGINX (reverse proxy / TLS)
      │
      ├────────────────────┬─────────────────────────┐
      ▼                    ▼                         ▼
Shell (Angular)      CORE (Go :8080)      AUTHENTICATOR (Go :8081)
core-manager/ :4200  /api/v1/*            /auth/*
      │                    │
      │ inyecta <script>   ├───────────┬──────────┐
      ▼                    ▼           ▼          ▼
<login-mfe>           core_db      Redis      MFE 1..N
(Svelte WC)           Postgres    (cache)
core-login/dist/
login-mfe.iife.js
```

**Flujo de arranque del Shell:**

```
1. Shell arranca
       ↓
2. APP_INITIALIZER → GET /api/v1/public/config   ← sin auth, resuelve portal por dominio
       ↓                                            devuelve: tenant + portal + MFEs del portal
3. ¿token válido en sessionStorage?
       ├── SÍ  → GET /api/v1/me/context → carga MFEs del portal activo
       └── NO  → inyecta <script src="auth_mfe_url">
                       ↓
                  <login-mfe config='{...}'>
                       ↓
                  Usuario completa el form
                       ↓
                  POST /auth/login  →  access_token + refresh_token
                       ↓
                  CustomEvent 'loginsuccess' (composed: true)
                       ↓
                  NgZone.run() → setTokens → navigate('/')
```

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Go | 1.22 |
| Node.js | 20+ |
| npm | 9+ |
| Docker | 24+ |
| Docker Compose | v2 |
| `sql-migrate` CLI | para migraciones (`go install github.com/rubenv/sql-migrate/...@latest`) |

---

## Inicio rápido — Desarrollo local

### 1. Variables de entorno

```bash
cp core-backend/.env.example core-backend/.env
cp core-authenticator/.env.example core-authenticator/.env
```

Editar ambos archivos. **El campo `JWT_SECRET` debe ser exactamente igual en los dos:**

```bash
# Generar un secret seguro (correr una sola vez, copiar en ambos .env)
openssl rand -hex 32
```

### 2. Infraestructura (Docker)

```bash
# Levanta PostgreSQL y Redis compartidos
docker compose -f core-backend/docker-compose.yml up postgres redis -d

# Esperar a que postgres esté healthy
docker compose -f core-backend/docker-compose.yml ps
```

### 3. Migraciones

Las migraciones usan [sql-migrate](https://github.com/rubenv/sql-migrate) (formato `-- +migrate Up/Down`).

Instalar el CLI una sola vez:

```bash
go install github.com/rubenv/sql-migrate/...@latest
```

Crear `core-backend/dbconfig.yml` (no se sube al repo — ya está en `.gitignore`):

```yaml
development:
  dialect: postgres
  datasource: postgres://core_user:secret123@localhost:5432/core_db?sslmode=disable
  dir: migrations
  table: migrations
```

Correr las migraciones:

```bash
cd core-backend
sql-migrate up
```

Otros comandos útiles:

```bash
sql-migrate status   # estado de cada migración
sql-migrate down     # revierte la última migración
```

### 4. Seed — Superadmin inicial

El Core API crea el superadmin automáticamente en el primer arranque si las variables están presentes en `core-backend/.env`:

```env
SEED_ADMIN_EMAIL=admin@mirabit.com
SEED_ADMIN_PASSWORD=123HoLa456!
```

El seed es **idempotente** — si el usuario ya existe, lo omite sin error. Una vez creado el superadmin, las variables pueden removerse del `.env`.

> **Producción:** no usar `.env`. Inyectar `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` como secrets del proveedor (AWS Secrets Manager, Vault, etc.) solo durante el primer deploy. El arranque logueará un warning si detecta `ENV=production` con las variables activas. Removerlas después del primer deploy exitoso.

### 5. Correr los servicios

Abrir cuatro terminales:

```bash
# Terminal 1 — Core API
cd core-backend && go run ./cmd/api

# Terminal 2 — Authenticator
cd core-authenticator && go run ./cmd/api

# Terminal 3 — Login MFE (dev con HMR)
cd core-login && npm install && npm run dev

# Terminal 4 — Shell Angular
cd core-manager && npm install && npx ng serve
```

| Servicio | URL | Notas |
|---|---|---|
| Core API | http://localhost:8080 | |
| Authenticator | http://localhost:8081 | |
| Login MFE dev | http://localhost:5173 | preview standalone del form |
| Shell Angular | http://localhost:4200 | app completa |

### 6. Build del Login MFE para producción

El Shell en producción carga `login-mfe.iife.js` desde una URL estática (CDN o servidor de archivos):

```bash
cd core-login && npm run build
# Output: core-login/dist/login-mfe.iife.js (~55 kB)
```

### 7. Health checks

```bash
curl http://localhost:8080/health
curl http://localhost:8081/health
# Ambos responden: {"status":"ok"}
```

---

## Stack completo con Docker

```bash
# Desde la raíz — levanta toda la infraestructura backend
docker compose up --build
```

El Shell y el Login MFE se sirven por separado (o desde Nginx en producción).

---

## Variables de entorno clave

| Variable | Dónde | Descripción |
|---|---|---|
| `JWT_SECRET` | core + authenticator | **Debe ser idéntica en ambos** |
| `DB_HOST` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | core + authenticator | PostgreSQL |
| `REDIS_HOST` / `REDIS_PASSWORD` | core + authenticator | Redis |
| `ALLOWED_ORIGINS` | core + authenticator | Orígenes CORS separados por coma |
| `PORT` | core (`8080`) / authenticator (`8081`) | Puerto de escucha |
| `JWT_EXP_MINUTES` | authenticator | Duración del access token |
| `REFRESH_TOKEN_EXP_DAYS` | authenticator | Duración del refresh token |
| `SEED_ADMIN_EMAIL` | core | Email del superadmin inicial — remover tras el primer arranque |
| `SEED_ADMIN_PASSWORD` | core | Contraseña del superadmin inicial — remover tras el primer arranque |
| `ENV` | core | `development` / `production` — en production activa el warning del seed |

> `core-login/` y `core-manager/` no necesitan `.env` — se configuran en tiempo de ejecución a través de la API del Core.
>
> `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` son opcionales y solo necesarias en el primer arranque. En producción, inyectarlas como secrets del proveedor y removerlas después del primer deploy.

---

## Estructura del repositorio

```
platform/
├── core-backend/                # Tenant Core API (Go, :8080)
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── config/
│   │   ├── db/
│   │   ├── cache/
│   │   ├── domain/
│   │   ├── repository/
│   │   ├── service/
│   │   ├── handler/
│   │   └── middleware/
│   ├── pkg/jwt/                 # solo Verify(), nunca Sign()
│   ├── internal/seed/           # seed superadmin al arranque
│   ├── migrations/              # 001–008 DDL completo (sql-migrate)
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── .env.example
│
├── core-authenticator/          # Auth Service (Go, :8081)
│   ├── cmd/api/main.go
│   ├── internal/
│   │   ├── domain/              # User, RefreshToken
│   │   ├── repository/          # auth_repo
│   │   ├── service/             # bcrypt, JWT sign, refresh rotation
│   │   ├── handler/             # auth_handler
│   │   └── middleware/          # CORS
│   ├── pkg/jwt/                 # Sign() + Verify()
│   └── .env.example
│
├── core-manager/                # Shell Angular (:4200)
│   ├── src/app/
│   │   ├── core/
│   │   │   ├── services/        # auth.service, tenant.service, admin.service
│   │   │   ├── guards/          # auth.guard, role.guard (superAdminGuard)
│   │   │   └── models/          # tenant.model.ts
│   │   ├── pages/
│   │   │   ├── login-page/      # carga <login-mfe> dinámicamente
│   │   │   ├── dashboard/       # lista MFEs habilitados del portal
│   │   │   ├── tenants/         # gestión de tenants (superadmin)
│   │   │   ├── tenant-detail/   # overview + portales + usuarios del tenant
│   │   │   ├── services/        # catálogo de servicios (superadmin)
│   │   │   ├── portals/         # vista global de portales, todos los tenants (superadmin)
│   │   │   ├── plans/           # gestión de planes (superadmin)
│   │   │   └── config-definitions/  # registro de config keys por scope (superadmin)
│   │   └── layout/              # drawer nav + layout base (rutas autenticadas)
│   └── package.json
│
├── core-login/                  # Login MFE (Svelte 5 → Web Component)
│   ├── src/
│   │   ├── Login.svelte         # <login-mfe> custom element
│   │   └── main.ts
│   ├── dist/
│   │   └── login-mfe.iife.js    # bundle final (~55 kB)
│   └── vite.config.ts
│
├── docs/
│   ├── README.md                # Este archivo
│   └── tenant-core-arquitectura.md  # DDL completo + contratos API + roadmap
│
└── .gitignore
```

---

## Paso a paso — Subir el proyecto a GitHub

### Paso 1 — Revisar qué NO debe subirse

Verificar que ningún `.env` con secrets esté en el staging area. El `.gitignore` raíz ya los excluye, pero confirmarlo antes del primer commit:

```bash
# Desde la raíz del proyecto
git status
```

No debe aparecer ningún archivo `.env` en la lista. Si aparece, agregarlo al `.gitignore`:

```bash
echo ".env" >> .gitignore
```

Confirmar también que `node_modules/` y `dist/` están excluidos:

```bash
git check-ignore -v core-manager/node_modules core-login/node_modules core-login/dist
# Todos deben mostrar que están siendo ignorados
```

### Paso 2 — Crear el repositorio en GitHub

1. Ir a [github.com/new](https://github.com/new)
2. Nombre sugerido: `platform` o `tenant-platform`
3. Visibilidad: **Private** (contiene arquitectura propietaria)
4. **No** inicializar con README ni `.gitignore` (ya existen)
5. Copiar la URL: `https://github.com/tu-usuario/platform.git`

### Paso 3 — Primer commit

Stagear solo los archivos del proyecto (nunca `-A` sin revisar primero):

```bash
# Backend Go
git add core-backend/
git add core-authenticator/

# Frontend
git add core-manager/
git add core-login/

# Raíz
git add .gitignore
git add README.md
git add tenant-core-arquitectura.md
git add refactor-auth-separation.md
```

Verificar el staging antes de commitear:

```bash
git status
# La columna "Changes to be committed" no debe incluir .env ni node_modules
```

Crear el commit:

```bash
git commit -m "feat: initial platform — core, authenticator, manager, login MFE"
```

### Paso 4 — Conectar con el repositorio remoto

```bash
git remote add origin https://github.com/tu-usuario/platform.git
```

### Paso 5 — Renombrar la rama y subir

```bash
git branch -M main
git push -u origin main
```

Si pide credenciales: GitHub ya no acepta usuario/contraseña — usar un **Personal Access Token** o SSH.

**Opción A — Token (HTTPS):**
1. GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Permisos: `Contents: Read and write` sobre el repo
3. Usar el token como contraseña cuando git lo pida

**Opción B — SSH (recomendado):**
```bash
# Generar clave si no existe
ssh-keygen -t ed25519 -C "tu@email.com"

# Agregar la clave pública a GitHub → Settings → SSH keys
cat ~/.ssh/id_ed25519.pub

# Cambiar el remote a SSH
git remote set-url origin git@github.com:tu-usuario/platform.git
git push -u origin main
```

### Paso 6 — Verificar en GitHub

Abrir `https://github.com/tu-usuario/platform` y confirmar:

- Carpetas `core-backend/`, `core-authenticator/`, `core-manager/`, `core-login/` visibles
- **No** hay archivos `.env` en ninguna carpeta
- **No** hay carpetas `node_modules/` ni `dist/` commiteadas
- El `README.md` se renderiza correctamente

---

## Documentación adicional

| Archivo | Contenido |
|---|---|
| `tenant-core-arquitectura.md` | DDL completo de `core_db`, contratos de API REST, estrategia de cache Redis, roadmap |
| [`sistema-tenants-servicios.md`](./sistema-tenants-servicios.md) | Arquitectura completa del sistema de tenants/servicios: cómo se comunican `core` y `booking`, diagramas de componentes y secuencia, esquema real de `core_db`, y hallazgos/pendientes verificados en código |
