# Token Management — Access Token & Refresh Token

Guía de referencia para integrar y consumir el servicio de autenticación. Describe el modelo de tokens, los flujos de ciclo de vida y las decisiones de seguridad implementadas.

---

## Modelo de tokens

El servicio emite dos tipos de token en cada autenticación exitosa:

| Propiedad | Access Token | Refresh Token |
|---|---|---|
| Formato | JWT firmado (HS256) | Hex opaco (32 bytes aleatorios) |
| Duración por defecto | 15 minutos | 30 días |
| Almacenamiento servidor | No (stateless) | Hash SHA-256 en PostgreSQL |
| Enviado por el cliente en | `Authorization: Bearer <token>` | Cuerpo JSON `refresh_token` |
| Revocable en caliente | No (expira solo) | Sí |

### Claims del Access Token (JWT)

```json
{
  "sub":        "<user_uuid>",
  "tenant_id":  "<tenant_uuid>",
  "tenant":     "<tenant_slug>",
  "role":       "admin | member | viewer | superadmin",
  "services":   ["<service_id>", "..."],
  "iat":        1700000000,
  "exp":        1700000900,
  "jti":        "<uuid>"
}
```

El `jti` (JWT ID) es único por token y permite trazabilidad, pero **no se persiste** en base de datos — el access token es completamente stateless.

---

## Flujos de ciclo de vida

### 1. Login

```
POST /auth/login
Content-Type: application/json

{
  "email":    "user@example.com",
  "password": "secret"
}
```

**Respuesta `200 OK`:**

```json
{
  "access_token":  "<jwt>",
  "refresh_token": "<hex-opaco>",
  "expires_at":    "2024-11-14T12:15:00Z",
  "user": {
    "id":         "<uuid>",
    "tenant_id":  "<uuid>",
    "email":      "user@example.com",
    "role":       "admin",
    "is_active":  true
  }
}
```

**Errores:**

| HTTP | Motivo |
|---|---|
| `400` | Campos faltantes o body inválido |
| `401` | Credenciales incorrectas |
| `403` | Usuario inactivo |

**Qué hace internamente:**
1. Busca el usuario por email (scope de tenant o global según el contexto).
2. Verifica la contraseña con `bcrypt`.
3. Consulta los servicios habilitados para el tenant del usuario y los incluye en el claim `services` del JWT. Los usuarios con rol `superadmin` reciben `services: null` (acceso irrestricto).
4. Genera un JWT firmado con `HS256` usando `JWT_SECRET`.
5. Genera 32 bytes criptográficamente aleatorios como refresh token.
6. Persiste en BD el **hash SHA-256** del refresh token (nunca el token en claro) junto a `user_agent` e `ip_address`.
7. Actualiza `last_login_at` del usuario.
8. Escribe un registro `auth.login` en la tabla `audit_logs` (fire-and-forget, no bloquea la respuesta).

---

### 2. Refresh

El access token es de corta duración. Cuando expira, el cliente solicita uno nuevo usando el refresh token, **sin que el usuario deba autenticarse de nuevo**.

```
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "<hex-opaco-recibido-en-login>"
}
```

**Respuesta `200 OK`:** misma estructura que `/auth/login`.

**Errores:**

| HTTP | Motivo |
|---|---|
| `400` | `refresh_token` ausente o body inválido |
| `401` | Token expirado (`token expired`) |
| `401` | Token revocado o no encontrado (`token revoked`) |

**Qué hace internamente:**
1. Calcula el hash SHA-256 del token recibido.
2. Busca el registro en BD por hash.
3. Valida que no esté revocado (`revoked_at IS NULL`) y que no haya expirado.
4. **Rotación obligatoria:** revoca el refresh token actual e inmediatamente emite uno nuevo.
5. Consulta los servicios habilitados para el tenant del usuario e incluye el claim `services` actualizado en el nuevo JWT (igual que en login). Los `superadmin` reciben `services: null`.
6. Genera un nuevo access token JWT.
7. Persiste el nuevo refresh token (hasheado) con el `user_agent` e `ip` actuales.

> **Importante para el cliente:** tras cada `/auth/refresh`, el refresh token anterior queda inválido. El cliente **debe reemplazar** el token almacenado con el nuevo recibido en la respuesta.

---

### 3. Logout

```
POST /auth/logout
Content-Type: application/json

{
  "refresh_token": "<hex-opaco>"
}
```

**Respuesta `200 OK`:**

```json
{ "message": "logged out" }
```

**Qué hace internamente:**
1. Busca el refresh token en BD por su hash SHA-256 para obtener el `user_id` asociado.
2. Marca el token como revocado (`revoked_at = NOW()`).
3. Escribe un registro `auth.logout` en la tabla `audit_logs` (fire-and-forget).
- El access token asociado **sigue siendo válido** hasta su expiración natural (máximo 15 minutos). Diseño aceptado: la ventana de riesgo es mínima dado el TTL corto.

---

### 4. Validar un Access Token (para microservicios)

Endpoint de introspección para que otros servicios verifiquen un token sin necesitar el `JWT_SECRET`.

```
GET /auth/validate
Authorization: Bearer <access_token>
```

**Respuesta `200 OK`:**

```json
{
  "sub":       "<user_uuid>",
  "tenant_id": "<tenant_uuid>",
  "tenant":    "<tenant_slug>",
  "role":      "admin",
  "services":  ["<service_id>"],
  "exp":       1700000900
}
```

**Errores:**

| HTTP | Motivo |
|---|---|
| `401` | Header `Authorization` ausente o token inválido/expirado |

**Alternativa (validación local):** si el microservicio tiene acceso al mismo `JWT_SECRET`, puede validar el token localmente con `HS256` sin hacer una llamada HTTP. En ese caso usar la librería JWT del lenguaje de destino con el mismo secreto compartido.

---

## Almacenamiento del Refresh Token (seguridad)

El refresh token **nunca se persiste en claro**. El flujo de almacenamiento es:

```
token_raw  (entregado al cliente)
    │
    └─► SHA-256 ──► token_hash  (almacenado en BD)
```

Registro en base de datos (`refresh_tokens`):

| Campo | Descripción |
|---|---|
| `id` | UUID del registro |
| `user_id` | FK al usuario |
| `token_hash` | SHA-256 del token en hex |
| `expires_at` | Timestamp de expiración |
| `revoked_at` | NULL si activo; timestamp si revocado |
| `user_agent` | User-Agent del cliente al momento de emisión |
| `ip_address` | IP del cliente al momento de emisión |
| `created_at` | Timestamp de creación |

Si la base de datos es comprometida, los hashes son inútiles sin el token original.

---

## Rate Limiting

El servicio aplica rate limiting a nivel de IP usando contadores en Redis. Las respuestas con exceso reciben `429 Too Many Requests`.

| Endpoint | Límite | Clave Redis |
|---|---|---|
| `POST /auth/login` | **10 req/min** (estricto) | `auth:login:strict:{ip}` |
| Todos los demás `/auth/*` | **60 req/min** (global) | `auth:global:{ip}` |

El límite estricto de login está diseñado para frenar ataques de fuerza bruta sin afectar el uso normal (un usuario raramente intenta más de 1–2 logins por minuto).

---

## Registro de auditoría

Cada login y logout exitoso genera un registro en la tabla `audit_logs` de PostgreSQL. El registro es **fire-and-forget**: se escribe en una goroutine y nunca bloquea la respuesta al cliente.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | bigserial | Identificador autoincremental |
| `tenant_id` | uuid | Tenant del usuario autenticado |
| `user_id` | uuid | Usuario que realizó la acción |
| `action` | text | `auth.login` o `auth.logout` |
| `ip_address` | inet | IP del cliente (vacío → `NULL`) |
| `created_at` | timestamptz | Momento del evento (default `NOW()`) |

Ejemplo de consulta para ver los últimos eventos de un tenant:

```sql
SELECT user_id, action, ip_address, created_at
FROM audit_logs
WHERE tenant_id = '<uuid>'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Variables de entorno relevantes

| Variable | Por defecto | Descripción |
|---|---|---|
| `JWT_SECRET` | _(requerido)_ | Clave de firma HMAC. Debe ser idéntica en todos los servicios que validen tokens localmente. Mínimo 32 chars recomendado. |
| `JWT_EXP_MINUTES` | `15` | Duración del access token en minutos. |
| `REFRESH_TOKEN_EXP_DAYS` | `30` | Duración del refresh token en días. |

---

## Guía de integración para un cliente

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENTE                              │
│                                                             │
│  1. POST /auth/login                                        │
│     └─ Almacenar access_token y refresh_token de forma     │
│        segura (memory > sessionStorage > localStorage)      │
│                                                             │
│  2. Cada request a la API                                   │
│     └─ Header: Authorization: Bearer <access_token>        │
│                                                             │
│  3. Al recibir 401 en cualquier endpoint protegido          │
│     └─ POST /auth/refresh con el refresh_token              │
│         ├─ 200: reemplazar ambos tokens, reintentar req.    │
│         └─ 401: sesión expirada → redirigir a login         │
│                                                             │
│  4. Al cerrar sesión                                        │
│     └─ POST /auth/logout con el refresh_token              │
│         └─ Borrar ambos tokens del almacenamiento           │
└─────────────────────────────────────────────────────────────┘
```

### Pseudocódigo de interceptor HTTP

```typescript
async function request(url, options) {
  const res = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${getAccessToken()}` }
  });

  if (res.status === 401 && !options._retry) {
    const refreshed = await fetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: getRefreshToken() })
    });

    if (refreshed.ok) {
      const { access_token, refresh_token } = await refreshed.json();
      saveTokens(access_token, refresh_token);
      return request(url, { ...options, _retry: true });
    }

    clearTokens();
    redirectToLogin();
  }

  return res;
}
```

---

## Decisiones de diseño

**¿Por qué refresh token opaco en lugar de JWT?**
Los JWT son verificables sin BD, pero eso impide revocarlos. Un token opaco almacenado como hash permite revocación inmediata (logout, compromiso de sesión) con un único lookup en BD.

**¿Por qué rotación en cada refresh?**
La rotación (invalidar el token anterior y emitir uno nuevo) limita la ventana de reutilización en caso de que un refresh token sea interceptado. Si un atacante usa un token ya rotado, la operación falla con `token revoked`.

**¿Por qué el access token no se revoca en logout?**
El access token es stateless por diseño (sin lookup en BD), lo que permite validación de alta performance en cualquier microservicio. El TTL corto (15 min) acota el riesgo aceptado. Si se requiere revocación inmediata del access token, se puede implementar una blocklist en Redis usando el campo `jti`.
