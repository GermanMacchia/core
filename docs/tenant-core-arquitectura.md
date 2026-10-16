# TENANT CORE
### Arquitectura de Microservicios con Go + PostgreSQL

> **Versión:** 1.1.0 · **Estado:** Draft · **Stack:** Go + PostgreSQL + Redis

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Esquema de Base de Datos](#3-esquema-de-base-de-datos)
4. [Estructura del Proyecto Go](#4-estructura-del-proyecto-go)
5. [API REST — Contratos](#5-api-rest--contratos)
6. [Middleware y Flujo de Request](#6-middleware-y-flujo-de-request)
7. [Estrategia de Cache (Redis)](#7-estrategia-de-cache-redis)
8. [Docker Compose](#8-docker-compose)
9. [Variables de Entorno](#9-variables-de-entorno)
10. [Roadmap de Implementación](#10-roadmap-de-implementación)

---

## 1. Visión General

El **Tenant Core** es el componente central responsable de gestionar múltiples tenants (clientes/organizaciones) y los servicios (microfrontends + backends) habilitados para cada uno. Actúa como resolvedor de contexto y configuración antes de que el Shell cargue los MFEs correspondientes.

### 1.1 Responsabilidades del Core

- Registro y gestión del ciclo de vida de tenants
- Resolución de tenant a partir del request (dominio, header, JWT)
- Gestión del catálogo de servicios disponibles en la plataforma
- Control de qué servicios tiene habilitados cada tenant y si son públicos o privados
- Exposición de configuración pública para el arranque del Shell (sin auth)
- Resolución de contexto autenticado para el Shell (con JWT)
- Rate limiting y auditoría básica por tenant

### 1.2 Qué NO hace el Core

- ❌ No emite ni firma JWT (responsabilidad del Auth Service)
- ❌ No gestiona usuarios ni contraseñas (responsabilidad del Auth Service)
- ❌ No renderiza ningún frontend (responsabilidad del Shell)
- ❌ No gestiona el menú de navegación (responsabilidad del Shell)
- ❌ No almacena datos de negocio de los tenants

---

## 2. Arquitectura del Sistema

### 2.1 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT / BROWSER                    │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS request
                           ▼
┌──────────────────────────────────────────────────────────┐
│              NGINX (reverse proxy / TLS)                 │
└──────────┬───────────────┬──────────────────────────────┘
           │               │
           ▼               ▼
┌──────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│  Shell (Angular) │  │  TENANT CORE (Go)  │  │  AUTH SERVICE    │
│  /app/*          │◄►│  :8080             │  │  (Go) :8081      │
│  Module Fed.     │  │  /api/v1/*         │  │  /api/v1/auth/*  │
└──────────────────┘  └────────┬───────────┘  └──────────────────┘
                               │
                  ┌────────────┼────────────┐
                  ▼            ▼            ▼
             ┌────────┐  ┌─────────┐  ┌──────────┐
             │core_db │  │  Redis  │  │MFE 1..N  │
             │Postgres│  │ (cache) │  │          │
             └────────┘  └─────────┘  └──────────┘
```

### 2.2 Flujo de arranque del Shell

```
Shell arranca
     ↓
GET /api/v1/public/config    ← sin auth, por dominio/subdominio
     ↓
¿MFEs públicos disponibles?
     ├── SI → carga MFE público directamente (sin login)
     └── NO → ¿hay token válido en memoria?
                  ├── SI → GET /api/v1/me/context → carga MFEs del tenant
                  └── NO → carga Auth MFE → usuario hace login → Auth Service
```

### 2.3 Estrategia de Multi-tenancy

Se adopta el modelo **Shared Database — Schema por Tenant** en PostgreSQL:

| Modelo | Aislamiento | Costo Operativo | |
|---|---|---|---|
| Shared DB + Shared Schema | Bajo (`tenant_id`) | Muy bajo | |
| Shared DB + Schema/Tenant | Medio-alto | Bajo | ✅ **ELEGIDO** |
| DB por Tenant | Máximo | Alto | |

---

## 3. Esquema de Base de Datos

### 3.1 Estructura General

```
PostgreSQL Instance
└── core_db                        ← Base de datos compartida (Core + Authenticator)
    ├── plans
    ├── tenants
    ├── services
    ├── tenant_services            ← incluye is_public por tenant
    ├── users                      ← gestionado por el Authenticator
    ├── refresh_tokens             ← gestionado por el Authenticator
    ├── audit_logs
    ├── tenant_portals             ← portales independientes por tenant
    └── portal_services            ← servicios habilitados por portal
```

> Core y Authenticator comparten la misma instancia de `core_db`. No hay FK entre microservicios — la referencia cruzada es lógica via `tenant_id` en los JWT claims.

### 3.2 DDL Completo — `core_db`

#### `plans`

```sql
CREATE TABLE plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(100) NOT NULL UNIQUE,  -- "free" | "starter" | "pro" | "enterprise"
  max_users    INT NOT NULL DEFAULT 5,
  max_services INT NOT NULL DEFAULT 3,
  price_usd    NUMERIC(10,2) NOT NULL DEFAULT 0,
  features     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `tenants`

```sql
CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          VARCHAR(100) NOT NULL UNIQUE,  -- "acme-corp" (usado en URLs)
  name          VARCHAR(255) NOT NULL,
  domain        VARCHAR(255) UNIQUE,           -- dominio personalizado opcional
  logo_url      VARCHAR(500),                  -- logo para pantalla de login
  plan_id       UUID NOT NULL REFERENCES plans(id),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'suspended', 'trial', 'cancelled')),
  config        JSONB NOT NULL DEFAULT '{}',
  trial_ends_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug   ON tenants(slug);
CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_tenants_status ON tenants(status);
```

> Nota (migración 036): `mfe_url`, `version` y `api_url` ahora viven en una
> tabla `deployments` aparte (`name` único, `url`, `api_url`, `version`,
> `description`, `is_active`). `services` la referencia mediante
> `deployment_id NOT NULL` (N servicios : 1 deployment); `services.slug` y
> `services.is_internal` ya no existen. La API sigue devolviendo `mfe_url` /
> `version` en los servicios, resueltos desde el deployment. El DDL de abajo es
> el diseño original.

#### `services`

```sql
CREATE TABLE services (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  slug        VARCHAR(100) NOT NULL UNIQUE,
  mfe_url     VARCHAR(500) NOT NULL,         -- URL del remoteEntry.js del MFE
  api_url     VARCHAR(500),                  -- URL base del microservicio backend
  version     VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  description TEXT,
  config      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `tenant_services`

```sql
-- Tabla pivote: qué servicios tiene habilitados cada tenant
CREATE TABLE tenant_services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_id      UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  is_enabled      BOOLEAN NOT NULL DEFAULT TRUE,
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,  -- si TRUE, el Shell lo carga sin auth
  config_override JSONB NOT NULL DEFAULT '{}',
  enabled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  UNIQUE(tenant_id, service_id)
);

CREATE INDEX idx_tenant_services_tenant ON tenant_services(tenant_id);
```

> `is_public` es por tenant, no por servicio. Un mismo servicio puede ser público para un tenant y privado para otro. Ejemplo: el MFE de booking es público para un restaurante (clientes reservan sin login) y privado para un hospital (solo staff autenticado).

#### `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'member'
                CHECK (role IN ('superadmin', 'admin', 'member', 'viewer')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_email ON users(email);
```

#### `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 del token plano
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
```

#### `audit_logs`

```sql
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  tenant_id   UUID REFERENCES tenants(id),
  user_id     UUID,                          -- referencia lógica a users.id
  action      VARCHAR(100) NOT NULL,         -- "tenant.create" | "service.enable"
  resource    VARCHAR(100),
  resource_id UUID,
  payload     JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id, created_at DESC);
```

#### `tenant_portals`

```sql
CREATE TABLE tenant_portals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug        VARCHAR(100) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  domain      VARCHAR(255),
  description TEXT,
  config      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, slug),
  UNIQUE(domain)
);

CREATE INDEX idx_tenant_portals_tenant ON tenant_portals(tenant_id);
CREATE INDEX idx_tenant_portals_domain ON tenant_portals(domain);
```

#### `portal_services`

```sql
CREATE TABLE portal_services (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id         UUID NOT NULL REFERENCES tenant_portals(id) ON DELETE CASCADE,
  tenant_service_id UUID NOT NULL REFERENCES tenant_services(id) ON DELETE CASCADE,
  is_enabled        BOOLEAN NOT NULL DEFAULT TRUE,
  config_override   JSONB NOT NULL DEFAULT '{}',
  sort_order        INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(portal_id, tenant_service_id)
);

CREATE INDEX idx_portal_services_portal ON portal_services(portal_id);
```

---

## 4. Estructura del Proyecto Go

### 4.1 Layout de Directorios

```
core-backend/
├── cmd/api/main.go
├── internal/
│   ├── config/
│   │   └── config.go
│   ├── db/
│   │   └── postgres.go
│   ├── cache/
│   │   └── redis.go
│   ├── domain/
│   │   ├── tenant.go
│   │   └── service.go
│   ├── repository/
│   │   ├── tenant_repo.go
│   │   └── service_repo.go
│   ├── service/
│   │   ├── tenant_service.go
│   │   └── service_svc.go
│   ├── handler/
│   │   ├── public_handler.go      ← GET /public/config
│   │   ├── context_handler.go     ← GET /me/context
│   │   ├── tenant_handler.go
│   │   └── service_handler.go
│   └── middleware/
│       ├── auth.go                ← JWT verify (nunca firma)
│       ├── tenant_resolver.go
│       ├── rate_limiter.go
│       └── cors.go
├── pkg/
│   ├── jwt/                       ← solo Verify(), nunca Sign()
│   └── response/
├── migrations/
│   ├── 001_create_plans.sql
│   ├── 002_create_tenants.sql
│   ├── 003_create_services.sql
│   ├── 004_create_tenant_services.sql
│   └── 005_create_audit_logs.sql
├── Dockerfile
├── .env.example
└── go.mod
```

### 4.2 Dependencias (`go.mod`)

```go
module github.com/tu-org/tenant-core

go 1.22

require (
  github.com/go-chi/chi/v5          v5.1.0
  github.com/jackc/pgx/v5           v5.6.0
  github.com/golang-jwt/jwt/v5      v5.2.1
  github.com/redis/go-redis/v9      v9.6.1
  github.com/spf13/viper            v1.19.0
  github.com/rubenv/sql-migrate     latest   // herramienta de migraciones
  github.com/google/uuid            v1.6.0
  go.uber.org/zap                   v1.27.0
)
```

> Las migraciones usan [sql-migrate](https://github.com/rubenv/sql-migrate) con el formato `-- +migrate Up/Down`.

---

## 5. API REST — Contratos

### 5.1 Endpoint público — arranque del Shell

```
GET /api/v1/public/config
```

Sin autenticación. El tenant se resuelve por:
1. Subdominio del `Host` header (`acme.app.com` → slug `acme`)
2. Query param `?tenant=acme` (fallback para desarrollo)

```json
// Response 200
{
  "data": {
    "tenant": {
      "slug": "acme-corp",
      "name": "Acme Corp",
      "logo_url": "https://cdn.x.com/acme/logo.png"
    },
    "auth_mfe_url": "https://cdn.x.com/auth/remoteEntry.js",
    "mfes": [
      {
        "slug": "booking",
        "mfe_url": "https://cdn.x.com/booking/remoteEntry.js",
        "public": true
      },
      {
        "slug": "admin",
        "mfe_url": "https://cdn.x.com/admin/remoteEntry.js",
        "public": false
      }
    ]
  }
}
```

> El Shell usa `public: true` para cargar el MFE sin exigir auth. Si todos los MFEs son `public: false`, el Shell carga el Auth MFE.

### 5.2 Contexto autenticado — endpoint principal para el Shell

```
GET /api/v1/me/context
Authorization: Bearer <JWT>
```

Toda la información del usuario viene de los claims del JWT. No hay query a tabla de usuarios.

```json
// Response 200
{
  "data": {
    "tenant": {
      "id": "uuid",
      "slug": "acme-corp",
      "name": "Acme Corp",
      "plan": "pro"
    },
    "services": [
      {
        "slug": "billing",
        "mfe_url": "https://cdn.x.com/billing/remoteEntry.js",
        "public": false
      },
      {
        "slug": "booking",
        "mfe_url": "https://cdn.x.com/booking/remoteEntry.js",
        "public": true
      }
    ],
    "user": {
      "id": "uuid",
      "role": "admin"
    }
  }
}
```

### 5.3 Tenants

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/tenants` | superadmin | Listar todos |
| `POST` | `/api/v1/tenants` | superadmin | Crear tenant |
| `GET` | `/api/v1/tenants/:id` | cualquiera | Detalle |
| `PATCH` | `/api/v1/tenants/:id` | cualquiera | Actualizar |
| `DELETE` | `/api/v1/tenants/:id` | superadmin | Desactivar |

#### `POST /tenants`

```json
{
  "slug": "acme-corp",
  "name": "Acme Corp",
  "plan_id": "uuid",
  "domain": "acme.app.com",
  "logo_url": "https://cdn.x.com/acme/logo.png"
}
```

### 5.4 Servicios del tenant

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/tenants/:id/services` | Servicios habilitados |
| `POST` | `/api/v1/tenants/:id/services` | Habilitar servicio |
| `PATCH` | `/api/v1/tenants/:id/services/:sid` | Actualizar config / is_public |
| `DELETE` | `/api/v1/tenants/:id/services/:sid` | Deshabilitar servicio |

#### `POST /tenants/:id/services`

```json
{
  "service_id": "uuid",
  "is_public": true,
  "config_override": {}
}
```

#### `PATCH /tenants/:id/services/:sid`

```json
{
  "is_public": false,
  "is_enabled": true,
  "config_override": {}
}
```

### 5.5 Catálogo de servicios

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/services` | cualquiera | Catálogo completo |
| `POST` | `/api/v1/services` | superadmin | Registrar servicio |

#### `POST /services`

```json
{
  "name": "Booking",
  "slug": "booking",
  "mfe_url": "https://cdn.tu-org.com/booking/remoteEntry.js",
  "api_url": "https://api.tu-org.com/booking",
  "version": "1.0.0",
  "description": "Módulo de reservas"
}
```

### 5.6 Health check

```
GET /health
→ { "status": "ok" }
```

---

## 6. Middleware y Flujo de Request

### 6.1 Pipeline (Chi)

```go
r := chi.NewRouter()

r.Use(middleware.Logger)
r.Use(middleware.Recoverer)
r.Use(cors.Handler(...))
r.Use(rateLimiter.ByIP)

// Públicos — sin auth
r.Get("/health", healthHandler.Get)
r.Get("/api/v1/public/config", publicHandler.Config)   // ← nuevo

// Protegidos — requieren JWT válido
r.Group(func(r chi.Router) {
  r.Use(jwtMiddleware.Verify)
  r.Use(tenantMiddleware.Resolve)

  r.Get("/api/v1/me/context", contextHandler.Get)

  r.Route("/api/v1/tenants", func(r chi.Router) {
    r.Get("/",    tenantHandler.List)
    r.Get("/{id}", tenantHandler.Get)
    r.Patch("/{id}", tenantHandler.Update)
    r.Get("/{id}/services", tenantHandler.ListServices)
    r.Post("/{id}/services", tenantHandler.EnableService)
    r.Patch("/{id}/services/{sid}", tenantHandler.UpdateService)
    r.Delete("/{id}/services/{sid}", tenantHandler.DisableService)
  })

  r.Get("/api/v1/services", serviceHandler.List)

  // Solo superadmin
  r.Group(func(r chi.Router) {
    r.Use(roleMiddleware.RequireSuperAdmin)
    r.Post("/api/v1/tenants",   tenantHandler.Create)
    r.Delete("/api/v1/tenants/{id}", tenantHandler.Delete)
    r.Post("/api/v1/services",  serviceHandler.Create)
  })
})
```

### 6.2 Tenant Resolver

Orden de resolución para rutas autenticadas:

1. Claim `tenant_id` del JWT
2. Header `X-Tenant-Slug`
3. Subdominio del `Host`

Para `/public/config` (sin JWT), solo por subdominio o query param `?tenant=`.

---

## 7. Estrategia de Cache (Redis)

| Clave | Contenido | TTL |
|---|---|---|
| `core:tenant:{slug}` | Config completa del tenant | 5 min |
| `core:tenant:{id}:services` | Servicios + `is_public` + MFE URLs | 5 min |
| `core:public:{slug}` | Response de `/public/config` | 2 min |
| `core:ratelimit:{ip}` | Contador de rate limiting | 1 min |

> Las keys de auth (`auth:revoked:*`, `auth:refresh:*`) las gestiona el Auth Service con su propio namespace.

---

## 8. Docker Compose

El Core forma parte del stack raíz de la plataforma. Ver `platform/docker-compose.yml`.

Para desarrollo aislado del Core únicamente:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB:       core_db
      POSTGRES_USER:     core_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U core_user -d core_db"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    ports:
      - "6379:6379"

  core:
    build: .
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_started }

volumes:
  pgdata:
```

### Dockerfile (multi-stage)

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o core ./cmd/api

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/core .
EXPOSE 8080
CMD ["./core"]
```

---

## 9. Variables de Entorno

```env
# Server
PORT=8080
ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=core_db
DB_USER=core_user
DB_PASSWORD=secret
DB_MAX_CONNS=25

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# JWT — solo para verificar, nunca para firmar
JWT_SECRET=misma_clave_que_el_auth_service

# CORS
ALLOWED_ORIGINS=http://localhost:4200,https://app.tu-dominio.com
```

---

## 10. Roadmap de Implementación

| Fase | Nombre | Tareas principales | Estado |
|---|---|---|---|
| 1 | Fundamentos DB | DDL (008 migraciones), docker-compose local, sql-migrate | ✅ Completo |
| 2 | Auth Service | Login/refresh/logout/validate, bcrypt, JWT sign, refresh rotation | ✅ Completo |
| 3 | Tenants + Servicios | CRUD tenants, catálogo de servicios, `is_public` en pivote | ✅ Completo |
| 4 | Tenant Context | `GET /me/context` — info desde JWT claims | ✅ Completo |
| 5 | Middleware completo | JWT verify, tenant resolver, rate limiting, role guard, seed | ✅ Completo |
| 6 | Portales | `tenant_portals` + `portal_services` DDL, gestión de portales por tenant | ✅ Completo (DB) |
| 7 | Endpoint público | `GET /public/config` — resolución de portal por dominio sin auth | 🔄 Pendiente |
| 8 | Tests | Unit + integration tests | ⬜ Pendiente |
| 9 | Deploy VPS | Nginx, TLS, CI/CD GitHub Actions | ⬜ Pendiente |

---

*Confidencial — Uso Interno*
