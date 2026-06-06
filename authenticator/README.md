# Authenticator Service

Microservicio de autenticación para la plataforma multi-tenant. Es el único firmante de JWT; el Core y cualquier otro servicio solo verifican la firma con el mismo `JWT_SECRET`.

**Stack:** Go 1.22 · Chi · pgx/v5 · Redis · Zap  
**Puerto:** 8081  
**Base de datos:** PostgreSQL `core_db` — tablas `users` + `refresh_tokens`

---

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/auth/login` | Emite access token + refresh token |
| `POST` | `/auth/refresh` | Rota el refresh token y emite uno nuevo |
| `POST` | `/auth/logout` | Revoca el refresh token activo |
| `GET` | `/auth/validate` | Introspección de JWT para otros microservicios |
| `GET` | `/health` | Health check |

### `POST /auth/login`

```json
// Request
{ "email": "admin@acme.com", "password": "secret" }

// Response 200
{
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "a1b2c3d4...",
    "expires_at": "2026-06-06T15:30:00Z",
    "user": {
      "id": "uuid",
      "email": "admin@acme.com",
      "role": "admin"
    }
  }
}
```

### `POST /auth/refresh`

```json
// Request
{ "refresh_token": "a1b2c3d4..." }

// Response 200 — igual estructura que login
```

### `POST /auth/logout`

```json
// Request
{ "refresh_token": "a1b2c3d4..." }

// Response 200
{ "data": { "message": "logged out" } }
```

### `GET /auth/validate`

```
Authorization: Bearer <JWT>

// Response 200 — claims decodificados
{
  "data": {
    "sub": "uuid-del-usuario",
    "tenant_id": "uuid-del-tenant",
    "role": "admin",
    "exp": 1234567890
  }
}
```

---

## Variables de entorno

```env
PORT=8081
ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=core_db
DB_USER=core_user
DB_PASSWORD=secret
DB_MAX_CONNS=10

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

JWT_SECRET=misma_clave_que_el_core
JWT_EXP_MINUTES=15
REFRESH_TOKEN_EXP_DAYS=30

ALLOWED_ORIGINS=http://localhost:4200
```

> `JWT_SECRET` debe ser **idéntico** al configurado en `core/.env`.  
> Generá uno seguro con: `openssl rand -hex 32`

---

## Correr en desarrollo

```bash
cp .env.example .env
# Editar .env con los valores reales
go run ./cmd/api
```

Salida esperada:

```
{"level":"info","msg":"connected to postgres"}
{"level":"info","msg":"connected to redis"}
{"level":"info","msg":"authenticator starting","port":"8081"}
```

---

## Errores

Todos los errores siguen el formato:

```json
{ "error": "mensaje descriptivo" }
```

| Código | Significado |
|---|---|
| `400` | Request inválido o campos faltantes |
| `401` | Credenciales incorrectas o token inválido/expirado |
| `429` | Rate limit superado (60 req/min por IP) |
| `500` | Error interno del servidor |

---

## Estructura

```
authenticator/
├── cmd/api/main.go
├── internal/
│   ├── cache/         # Cliente Redis (revocación de tokens)
│   ├── config/        # Variables de entorno (viper)
│   ├── db/            # Pool PostgreSQL (pgx/v5)
│   ├── domain/        # User, RefreshToken, UserRepository interface
│   ├── handler/       # auth_handler.go
│   ├── middleware/    # CORS
│   ├── repository/    # auth_repo.go (queries SQL)
│   └── service/       # auth_service.go (bcrypt, sign, refresh rotation)
├── pkg/
│   ├── jwt/           # Sign() + Verify()
│   └── response/      # Wrappers de respuesta HTTP
└── .env.example
```
