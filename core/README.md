# Tenant Core API

API central de gestión de tenants, autenticación y servicios.  
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
cd core

cp .env.example .env
```

Editar `.env` con los valores reales:

```env
DB_PASSWORD=tu_password_seguro
REDIS_PASSWORD=tu_redis_password
JWT_SECRET=cadena_aleatoria_larga_y_segura
SEED_ADMIN_EMAIL=admin@tu-dominio.com
SEED_ADMIN_PASSWORD=password_inicial
```

> **JWT_SECRET** debe tener al menos 32 caracteres aleatorios.  
> Generá uno con: `openssl rand -hex 32`

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
NAME          STATUS
core-postgres  healthy
core-redis     running
```

---

## 3. Ejecutar migraciones

Las migraciones están en `migrations/` con formato [sql-migrate](https://github.com/rubenv/sql-migrate) (`-- +migrate Up/Down`).

### Instalar sql-migrate CLI (una sola vez)

```bash
go install github.com/rubenv/sql-migrate/...@latest
```

### Crear `dbconfig.yml` (no se sube al repo)

```yaml
development:
  dialect: postgres
  datasource: postgres://core_user:${DB_PASSWORD}@localhost:5432/core_db?sslmode=disable
  dir: migrations
  table: migrations
```

### Aplicar migraciones

```bash
sql-migrate up

# Otros comandos útiles
sql-migrate status   # estado de cada migración
sql-migrate down     # revierte la última migración
```

Las 8 migraciones crean: `plans`, `tenants`, `services`, `tenant_services`, `users`, `refresh_tokens`, `audit_logs`, `tenant_portals` + `portal_services`.

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

## 6. Seed — superadmin inicial

El Core crea el superadmin **automáticamente** al arrancar si las variables están presentes en `.env`:

```env
SEED_ADMIN_EMAIL=admin@tu-dominio.com
SEED_ADMIN_PASSWORD=password_seguro
```

El seed es **idempotente** — si el usuario ya existe, lo omite sin error. Una vez creado, las variables pueden removerse del `.env`.

> **Producción:** inyectá `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` como secrets del proveedor (AWS Secrets Manager, Vault, etc.) solo durante el primer deploy. El arranque loguea un warning si detecta `ENV=production` con las variables activas.

---

## Endpoints

Base URL: `http://localhost:8080/api/v1`

> La autenticación (login / refresh / logout / validate) la gestiona el **Authenticator Service** en `:8081`. Ver `authenticator/README.md`.

### Contexto del tenant (endpoint principal para el Shell)

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/me/context` | Bearer JWT |

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
      { "slug": "billing",   "mfe_url": "https://cdn.x.com/billing/remoteEntry.js" },
      { "slug": "analytics", "mfe_url": "https://cdn.x.com/analytics/remoteEntry.js" }
    ],
    "user": {
      "id": "uuid",
      "role": "admin"
    }
  }
}
```

---

### Tenants

> Rutas marcadas `[superadmin]` requieren `role: superadmin` en el JWT.

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/tenants` | Bearer JWT | superadmin |
| `POST` | `/tenants` | Bearer JWT | superadmin |
| `GET` | `/tenants/:id` | Bearer JWT | cualquiera |
| `PATCH` | `/tenants/:id` | Bearer JWT | cualquiera |
| `DELETE` | `/tenants/:id` | Bearer JWT | superadmin |

#### `POST /tenants`

```json
// Request
{
  "slug": "acme-corp",
  "name": "Acme Corp",
  "plan_id": "uuid-del-plan",
  "domain": "acme.app.com"
}

// Response 201
{
  "data": {
    "id": "uuid",
    "slug": "acme-corp",
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

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/tenants/:id/services` | Bearer JWT | Servicios habilitados |
| `POST` | `/tenants/:id/services` | Bearer JWT | Habilitar servicio |
| `DELETE` | `/tenants/:id/services/:sid` | Bearer JWT | Deshabilitar servicio |

#### `POST /tenants/:id/services`

```json
// Request
{
  "service_id": "uuid-del-servicio",
  "config_override": {}
}
```

---

### Usuarios del tenant

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| `GET` | `/tenants/:id/users` | Bearer JWT | Listar usuarios del tenant |
| `POST` | `/tenants/:id/users` | Bearer JWT | Crear usuario en el tenant |

#### `POST /tenants/:id/users`

```json
// Request
{
  "email": "usuario@acme.com",
  "password": "password_seguro",
  "role": "admin"
}
```

---

### Catálogo de servicios

| Método | Ruta | Auth | Rol |
|---|---|---|---|
| `GET` | `/services` | Bearer JWT | cualquiera |
| `POST` | `/services` | Bearer JWT | superadmin |

#### `POST /services`

```json
// Request
{
  "name": "Billing",
  "slug": "billing",
  "mfe_url": "https://cdn.tu-org.com/billing/remoteEntry.js",
  "api_url": "https://api.tu-org.com/billing",
  "version": "1.0.0",
  "description": "Módulo de facturación"
}
```

---

### Health check

| Método | Ruta | Auth |
|---|---|---|
| `GET` | `/health` | — |

```json
// Response 200
{ "status": "ok" }
```

---

## Cabeceras importantes

| Header | Descripción |
|---|---|
| `Authorization: Bearer <token>` | JWT de acceso en rutas protegidas |
| `X-Tenant-Slug: acme-corp` | Resolver tenant en llamadas server-to-server |

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
core/
├── cmd/api/main.go              # Entry point + router + graceful shutdown
├── internal/
│   ├── config/                  # Variables de entorno (viper)
│   ├── db/                      # Pool PostgreSQL (pgx/v5)
│   ├── cache/                   # Cliente Redis
│   ├── domain/                  # Structs e interfaces (Tenant, Service, User)
│   ├── repository/              # Queries SQL (tenant_repo, service_repo, user_repo)
│   ├── service/                 # Lógica de negocio (tenant_service, service_svc)
│   ├── handler/                 # Handlers HTTP (tenant_handler, service_handler)
│   ├── middleware/              # JWT verify, tenant resolver, rate limiter, CORS, role
│   └── seed/                    # Seed automático del superadmin al arranque
├── pkg/
│   ├── jwt/                     # Solo Verify() — nunca Sign()
│   └── response/                # Wrappers de respuesta HTTP (JSON, error, list)
├── migrations/                  # 001–008 DDL con formato sql-migrate
│   ├── 001_create_plans.sql
│   ├── 002_create_tenants.sql
│   ├── 003_create_services.sql
│   ├── 004_create_tenant_services.sql
│   ├── 005_create_users.sql
│   ├── 006_create_refresh_tokens.sql
│   ├── 007_create_audit_logs.sql
│   └── 008_create_tenant_portals.sql  # tenant_portals + portal_services
├── docker-compose.yml
├── Dockerfile
└── .env.example
```
