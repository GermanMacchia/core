# Tenant Core API

API central de gestión de tenants, portales, servicios y usuarios.  
**Stack:** Go 1.22 · PostgreSQL 16 · Redis 7 · Chi router

---

## Requisitos previos

| Herramienta | Versión mínima |
|---|---|
| Go | 1.22 |
| Docker | 24+ |
| Docker Compose | v2 |

---

## 1. Clonar y configurar variables de entorno

```bash
git clone <repo-url>
cd core-backend

cp .env.example .env
```

Editar `.env` con los valores reales:

```env
# Base de datos
DB_PASSWORD=tu_password_seguro

# Redis
REDIS_PASSWORD=tu_redis_password

# JWT — mínimo 32 caracteres aleatorios
JWT_SECRET=cadena_aleatoria_larga_y_segura
# Generá uno con: openssl rand -hex 32

# API key pública para el shell (header X-Api-Key)
PUBLIC_API_KEY=clave_publica_del_shell

# Seed inicial (se pueden remover después del primer arranque)
SEED_ADMIN_EMAIL=admin@tu-dominio.com
SEED_ADMIN_PASSWORD=password_inicial
SEED_AUTH_API_URL=http://localhost:8081
SEED_LOGIN_MFE_URL=http://localhost:5173/src/main.ts
SEED_MANAGER_MFE_URL=http://localhost:4201/src/main.single-spa.ts
# SEED_*_MFE_URL definen la url de los deployments core-login / core-manager del seed
```

---

## 2. Levantar infraestructura (Docker)

```bash
# Levantar PostgreSQL + Redis en background
docker compose up postgres redis -d

# Verificar que estén healthy
docker compose ps
```

Esperar hasta que postgres muestre `healthy`:

```
NAME           STATUS
core-postgres  healthy
core-redis     running
```

---

## 3. Ejecutar migraciones

Las migraciones están en `migrations/` con formato [goose](https://github.com/pressly/goose) (`-- +goose Up/Down`).

### Instalar goose CLI (una sola vez)

```bash
go install github.com/pressly/goose/v3/cmd/goose@latest
```

### Aplicar migraciones

```bash
goose -dir migrations postgres "postgres://core_user:<password>@localhost:5432/core_db?sslmode=disable" up

# Otros comandos útiles
goose -dir migrations postgres "postgres://core_user:<password>@localhost:5432/core_db?sslmode=disable" status   # estado de cada migración
goose -dir migrations postgres "postgres://core_user:<password>@localhost:5432/core_db?sslmode=disable" down     # revierte la última migración
```

`<password>` es el valor de `DB_PASSWORD` en tu `.env`.

---

## 4. Correr la API

### Modo desarrollo (local)

```bash
go run ./cmd/api
```

Salida esperada:

```
{"level":"info","msg":"connected to postgres"}
{"level":"info","msg":"connected to redis"}
{"level":"info","msg":"server starting","port":"8080"}
```

### Modo Docker (todo el stack)

```bash
docker compose up --build
```

La API queda disponible en `http://localhost:8080`.

---

## 5. Verificar que funciona

```bash
curl http://localhost:8080/health
# {"status":"ok"}
```

---

## 6. Seed — datos iniciales

El Core crea el superadmin y la infraestructura del portal de administración **automáticamente** al arrancar si las variables están presentes en `.env`.

El seed es **idempotente** — todas las sentencias usan `ON CONFLICT DO UPDATE`, por lo que puede correr en cada arranque sin efectos secundarios.

Lo que crea el seed:

| Recurso | ID fijo | Descripción |
|---|---|---|
| Tenant `Platform` | `...0001` | Tenant raíz de la plataforma |
| Portal `Admin Portal` | `...0002` | Portal de administración |
| Servicio `Login` | `...0010` | MFE de login (`public: true`) |
| Servicio `Manager` | `...0011` | MFE de gestión de tenants |
| Usuario superadmin | — | Creado solo si no existe |

> **Producción:** inyectá `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` como secrets del proveedor (AWS Secrets Manager, Vault, etc.) solo durante el primer deploy. El arranque loguea un warning si detecta `ENV=production` con las variables activas.

---

## Roles

Los roles son una tabla fija (`roles`) con UUIDs estables. El nombre del rol viaja en el JWT.

| Nombre | UUID (`...`) | Descripción |
|---|---|---|
| `superadmin` | `0101` | Acceso total a la plataforma |
| `admin` | `0102` | Administrador del tenant |
| `member` | `0103` | Miembro del tenant |
| `viewer` | `0104` | Acceso de solo lectura |

Las rutas de gestión de usuarios aceptan el nombre del rol como string (`"admin"`, etc.). El repositorio resuelve el nombre a `role_id` internamente.

---

## Endpoints

Base URL: `http://localhost:8080/api/v1`

> La autenticación (login / refresh / logout / validate) la gestiona el **Authenticator Service** en `:8081`. Ver `authenticator/README.md`.

---

### Bootstrap del shell (endpoint principal)

Endpoint público — el shell lo llama antes del login para obtener la configuración del portal.

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/public/portals/:portal_id` | `X-Api-Key` + `X-Tenant-ID` |

```json
// Response 200
{
  "tenant": {
    "id": "uuid",
    "name": "Acme Corp"
  },
  "portal": {
    "id": "uuid",
    "name": "Admin Portal",
    "config": {
      "auth_api_url": "http://localhost:8081",
      "login_slug": "login"
    }
  },
  "services": [
    {
      "id": "uuid",
      "slug": "login",
      "name": "Login",
      "mfe_url": "http://localhost:5173/src/main.ts",
      "public": true,
      "sort_order": 0
    },
    {
      "id": "uuid",
      "slug": "manager",
      "name": "Manager",
      "mfe_url": "http://localhost:4201/src/main.single-spa.ts",
      "public": false,
      "allowed_roles": ["admin", "superadmin"],
      "sort_order": 1
    }
  ]
}
```

El shell usa `portal.config.login_slug` para saber a dónde redirigir al usuario no autenticado. Si `login_slug` está ausente, el portal es completamente público.

---

### Contexto autenticado

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/me/context` | Bearer JWT |

```json
// Response 200
{
  "tenant": {
    "id": "uuid",
    "name": "Acme Corp",
    "plan": "enterprise"
  },
  "services": [
    { "slug": "manager", "mfe_url": "http://localhost:4201/src/main.single-spa.ts" }
  ],
  "user": {
    "id": "uuid",
    "role": "admin"
  }
}
```

---

### Tenants

> Rutas marcadas `[superadmin]` requieren `role: superadmin` en el JWT.  
> Para rutas sin esa marca, el acceso está restringido por **ownership**: un usuario no-superadmin solo puede operar sobre su propio tenant. Intentar acceder al tenant de otro devuelve `403 Forbidden`.

| Método | Ruta | Auth | Rol / Acceso |
|---|---|---|---|
| `GET` | `/tenants` | Bearer JWT | superadmin |
| `POST` | `/tenants` | Bearer JWT | superadmin |
| `GET` | `/tenants/:id` | Bearer JWT | superadmin **o** tenant propio |
| `PATCH` | `/tenants/:id` | Bearer JWT | superadmin **o** tenant propio |
| `DELETE` | `/tenants/:id` | Bearer JWT | superadmin |

#### `POST /tenants`

```json
// Request
{
  "name": "Acme Corp",
  "plan_id": "uuid-del-plan",
  "domain": "acme.app.com"
}

// Response 201
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "status": "active",
    "plan_id": "uuid",
    "created_at": "2026-06-05T12:00:00Z"
  }
}
```

#### `PATCH /tenants/:id`

```json
// Request — todos los campos son opcionales
{
  "name": "Nuevo Nombre",
  "status": "suspended",
  "domain": "nuevo.dominio.com"
}
```

---

### Servicios del tenant

> Aplica la misma regla de ownership que en Tenants.

| Método | Ruta | Auth | Rol / Acceso |
|---|---|---|---|
| `GET` | `/tenants/:id/services` | Bearer JWT | superadmin **o** tenant propio |
| `POST` | `/tenants/:id/services` | Bearer JWT | superadmin **o** tenant propio |
| `DELETE` | `/tenants/:id/services/:sid` | Bearer JWT | superadmin |

#### `POST /tenants/:id/services` — habilitar un servicio para un tenant

```json
// Request
{
  "service_id": "uuid-del-servicio",
  "slug": "billing"
}
```

> `slug` define la ruta de montaje del MFE para este tenant (ej: `/billing`). Puede diferir entre tenants para el mismo servicio.

---

### Usuarios del tenant

> Aplica la misma regla de ownership que en Tenants.

| Método | Ruta | Auth | Rol / Acceso |
|---|---|---|---|
| `GET` | `/tenants/:id/users` | Bearer JWT | superadmin **o** tenant propio |
| `POST` | `/tenants/:id/users` | Bearer JWT | superadmin **o** tenant propio |
| `PATCH` | `/tenants/:id/users/:uid` | Bearer JWT | superadmin **o** tenant propio |
| `DELETE` | `/tenants/:id/users/:uid` | Bearer JWT | superadmin |

#### `POST /tenants/:id/users`

```json
// Request
{
  "email": "usuario@acme.com",
  "password": "password_seguro",
  "role": "admin",
  "portal_id": "uuid-del-portal"
}
```

> `portal_id` es opcional. Un usuario sin `portal_id` tiene acceso a todos los portales del tenant.

#### `PATCH /tenants/:id/users/:uid`

```json
// Request — todos los campos son opcionales
{
  "role": "viewer",
  "portal_id": "uuid-del-portal",
  "is_active": false
}
```

---

### Deployments

Un deployment es una app desplegada una sola vez por la plataforma, con una `url` canónica (migración 036). Cada servicio se apoya en un deployment (`services.deployment_id`); las respuestas de servicios siguen incluyendo `mfe_url` y `version`, resueltos desde el deployment. Eliminar un deployment que todavía referencian servicios devuelve `409`.

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/deployments[?all=true]` | Bearer JWT | superadmin |
| `GET` | `/deployments/:id` | Bearer JWT | superadmin |
| `POST` | `/deployments` | Bearer JWT | superadmin |
| `PATCH` | `/deployments/:id` | Bearer JWT | superadmin |
| `DELETE` | `/deployments/:id` | Bearer JWT | superadmin |

```json
// POST /deployments
{
  "name": "billing-mfe",
  "url": "https://cdn.tu-org.com/billing/remoteEntry.js",
  "version": "1.0.0"
}
```

---

### Catálogo de servicios

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/services` | Bearer JWT | cualquiera |
| `POST` | `/services` | Bearer JWT | superadmin |
| `GET` | `/services/:id` | Bearer JWT | cualquiera |
| `PATCH` | `/services/:id` | Bearer JWT | superadmin |
| `DELETE` | `/services/:id` | Bearer JWT | superadmin |

#### `POST /services`

```json
// Request
{
  "name": "Billing",
  "deployment_id": "<uuid de un deployment existente>",
  "description": "Módulo de facturación",
  "config": {
    "public": false,
    "allowed_roles": ["admin", "superadmin"],
    "auth_api_url": "https://auth.tu-org.com"
  }
}
```

---

### Portales

> Un tenant puede tener múltiples portales (`tenant_portals`), cada uno con su propio dominio y subset de servicios habilitados (`portal_services`).

| Método | Ruta | Auth | Rol / Acceso |
|---|---|---|---|
| `GET` | `/portals` | Bearer JWT | superadmin |
| `GET` | `/tenants/:id/portals` | Bearer JWT | cualquier autenticado |
| `POST` | `/tenants/:id/portals` | Bearer JWT | cualquier autenticado |
| `PATCH` | `/portals/:portal_id` | Bearer JWT | cualquier autenticado |

> `GET /portals` lista todos los portales de la plataforma sin filtrar por tenant — pensado para la vista global de administración (`core-manager`). Cada item incluye `tenant_name` para identificar a qué tenant pertenece.

#### `GET /portals`

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "tenant_id": "uuid",
      "tenant_name": "Acme Corp",
      "name": "Admin Portal",
      "domain": "admin.acme.com",
      "description": "Portal de administración",
      "config": {},
      "is_active": true,
      "created_at": "2026-06-05T12:00:00Z",
      "updated_at": "2026-06-05T12:00:00Z"
    }
  ]
}
```

#### `POST /tenants/:id/portals`

```json
// Request
{
  "name": "Admin Portal",
  "domain": "admin.acme.com",
  "description": "Portal de administración",
  "config": { "login_slug": "login" }
}
```

#### `PATCH /portals/:portal_id`

```json
// Request — todos los campos son opcionales
{
  "name": "Nuevo nombre",
  "domain": "nuevo.dominio.com",
  "description": "Nueva descripción",
  "is_active": false,
  "config": { "login_slug": "login" }
}
```

---

### Servicios de un portal

> Habilita/edita/desasigna qué servicios del catálogo están disponibles dentro de un portal específico, con overrides de config por portal (`config_override`).

| Método | Ruta | Auth | Rol / Acceso |
|---|---|---|---|
| `GET` | `/portals/:portal_id/services` | Bearer JWT | cualquier autenticado |
| `POST` | `/portals/:portal_id/services` | Bearer JWT | cualquier autenticado |
| `PATCH` | `/portals/:portal_id/services/:service_id` | Bearer JWT | cualquier autenticado |
| `DELETE` | `/portals/:portal_id/services/:service_id` | Bearer JWT | cualquier autenticado |

#### `POST /portals/:portal_id/services` — asignar un servicio al portal

```json
// Request
{
  "service_id": "uuid-del-servicio",
  "slug": "/manager",
  "sort_order": 0
}
```

#### `PATCH /portals/:portal_id/services/:service_id`

```json
// Request — todos los campos son opcionales
{
  "slug": "/manager",
  "sort_order": 1,
  "config_override": { "public": true }
}
```

> `DELETE` no borra el registro: pone `is_enabled = FALSE` (desasignación reversible).

---

### Planes

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/plans` | Bearer JWT | cualquiera |
| `POST` | `/plans` | Bearer JWT | superadmin |
| `GET` | `/plans/:id` | Bearer JWT | cualquiera |
| `PATCH` | `/plans/:id` | Bearer JWT | superadmin |
| `DELETE` | `/plans/:id` | Bearer JWT | superadmin |
| `GET` | `/plans/:id/services` | Bearer JWT | cualquiera |
| `PUT` | `/plans/:id/services/:service_id` | Bearer JWT | superadmin |
| `DELETE` | `/plans/:id/services/:service_id` | Bearer JWT | superadmin |

#### `POST /plans`

```json
// Request
{
  "name": "Enterprise",
  "max_users": 100,
  "max_services": 20,
  "price": 499.90,
  "features": { "sso": true }
}
```

#### `PUT /plans/:id/services/:service_id` — precio/inclusión de un servicio en el plan

```json
// Request
{
  "price": 49.90,
  "is_included": true
}
```

---

### Config Definitions

> Registro de qué keys de configuración existen, en qué `scope` (`service` · `portal` · `tenant` · `plan`) y con qué tipo — ver [Configuración: campos reconocidos](#configuración-campos-reconocidos-y-dónde-ponerlos) más abajo.

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/config-definitions` | Bearer JWT | superadmin |
| `POST` | `/config-definitions` | Bearer JWT | superadmin |
| `GET` | `/config-definitions/:scope/:key` | Bearer JWT | superadmin |
| `PATCH` | `/config-definitions/:scope/:key` | Bearer JWT | superadmin |
| `DELETE` | `/config-definitions/:scope/:key` | Bearer JWT | superadmin |

#### `POST /config-definitions`

```json
// Request
{
  "key": "allowed_roles",
  "scope": "service",
  "type": "string[]",
  "description": "Roles que pueden montar este MFE",
  "default_val": null
}
```

> `scope` acepta `service` · `portal` · `tenant` · `plan`. `type` acepta `bool` · `string` · `string[]`.

---

### Cache

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `POST` | `/cache/reset` | Bearer JWT | superadmin |

```json
// Response 200
{ "data": { "message": "cache reset successfully" } }
```

> Hace `FLUSHDB` sobre la instancia de Redis usada para cachear resoluciones de tenant/portal. Usar tras cambios de config que no se reflejan por el TTL del cache.

---

### Health check

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/health` | — |

```json
{ "status": "ok" }
```

---

## Configuración: campos reconocidos y dónde ponerlos

### `services.config` — defaults globales del servicio

| Key | Tipo | Leída en | Efecto |
|---|---|---|---|
| `public` | `bool` | shell | Si `true`, monta el MFE sin JWT. Por defecto `false` |
| `auth_api_url` | `string` | shell | URL del auth API inyectada al MFE como `authApiUrl` |
| `allowed_roles` | `string[]` | shell | Roles que pueden montar este MFE (ej: `["admin","superadmin"]`). Si ausente, cualquier usuario autenticado tiene acceso |

### `portal_services.config_override` — overrides por portal

Acepta las mismas keys que `services.config`. Se aplica con un **shallow merge** (`services.config || config_override`) en `portal_repo.go · GetServices`: las keys de `config_override` sobreescriben las del servicio base.

Ejemplo: un servicio es `public: false` globalmente pero se quiere público en un portal específico → poner `{"public": true}` en `config_override`.

### `tenant_portals.config` — comportamiento del portal

El objeto completo se expone al shell como `portal.config` desde `portal_handler.go · PublicConfig`.

| Key | Tipo | Leída en | Efecto |
|---|---|---|---|
| `auth_api_url` | `string` | shell | Fallback de `authApiUrl` para servicios que no declaran el propio |
| `login_slug` | `string` | shell | Slug del MFE que maneja el login (ej: `"login"`). **Si está ausente, el portal es público** — el shell no enforcea auth |

### `tenants.config` — metadatos de marca del tenant

| Key | Tipo | Leída en | Efecto |
|---|---|---|---|
| `logo_url` | `string` | `tenant_handler.go` → shell | Logo del tenant en la barra del shell |
| `primary_color` | `string` | `tenant_handler.go` → shell | Color primario de la UI del shell |

### Flujo de merge completo

```
services.config                   ← defaults globales
        || (JSONB merge, Postgres)
portal_services.config_override   ← overrides por portal
        =
PortalService.Config              ← lo que recibe el shell por servicio
```

### Reglas de diseño

| Quiero... | Dónde va |
|---|---|
| Que algo aplique a todos los portales | `services.config` |
| Override para un portal específico | `portal_services.config_override` |
| Configurar auth o comportamiento del portal | `tenant_portals.config` |
| Branding del tenant (logo, colores) | `tenants.config` |
| Restringir un servicio a ciertos roles | `services.config["allowed_roles"]` o override en `portal_services` |
| Portal sin login (totalmente público) | Omitir `login_slug` en `tenant_portals.config` |

> `description` se conserva en `services` como metadato informativo; no viaja al shell.

### `config_definitions` — registro de keys válidas

La tabla `config_definitions` actúa como fuente de verdad de qué keys de configuración existen, en qué scope y qué tipo tienen. El storage sigue siendo JSONB — esta tabla es documentación viva a nivel DB y punto de validación antes de guardar un config.

```sql
SELECT key, scope, type, description, default_val
FROM config_definitions
ORDER BY scope, key;
```

Al agregar una nueva key de config: primero insertarla en `config_definitions`, luego usarla en el JSONB correspondiente.

---

## Cabeceras importantes

| Header | Descripción |
|---|---|
| `Authorization: Bearer <token>` | JWT de acceso en rutas protegidas |
| `X-Tenant-ID: <uuid>` | Resolver tenant en llamadas server-to-server (sin JWT) |
| `X-Api-Key: <key>` | Autenticación para el endpoint público del shell |

---

## Respuesta de errores

Todos los errores siguen el mismo formato:

```json
{
  "error": "mensaje descriptivo"
}
```

| Código | Significado |
|---|---|
| `400` | Request inválido / campos faltantes |
| `401` | Token ausente, inválido o expirado |
| `403` | Sin permisos para esa operación |
| `404` | Recurso no encontrado |
| `422` | Tenant no resuelto |
| `429` | Rate limit superado (60 req/min por IP) |
| `500` | Error interno del servidor |

---

## Estructura del proyecto

```
core-backend/
├── cmd/api/main.go              # Entry point + router + graceful shutdown
├── internal/
│   ├── config/                  # Variables de entorno (viper)
│   ├── db/                      # Pool PostgreSQL (pgx/v5)
│   ├── cache/                   # Cliente Redis
│   ├── domain/                  # Structs e interfaces (Tenant, Service, User, Portal)
│   ├── repository/              # Queries SQL (tenant_repo, service_repo, user_repo, portal_repo)
│   ├── service/                 # Lógica de negocio (tenant_service, service_svc)
│   ├── handler/                 # Handlers HTTP (tenant_handler, service_handler, portal_handler)
│   ├── middleware/              # JWT verify, tenant resolver, rate limiter, CORS, role, api_key
│   └── seed/                    # Seed idempotente al arranque
├── pkg/
│   ├── jwt/                     # Solo Verify() — nunca Sign()
│   └── response/                # Wrappers de respuesta HTTP (JSON, error, list)
├── migrations/                  # DDL con formato goose (ver migrations/*.sql para el detalle)
├── docker-compose.yml
├── Dockerfile
└── .env.example
```
