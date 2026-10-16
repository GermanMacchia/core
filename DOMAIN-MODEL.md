# Modelo de dominio: Tenant / Portal / Service / User

```
                                   ┌──────────────────────┐
                                   │        TENANT         │
                                   │  id, name, contact_*   │
                                   │  plan_id, status        │
                                   └───┬───────┬────────┬───┘
                                       │       │        │
                          1:N          │       │        │  1:N
                     ┌─────────────────┘       │        └─────────────────┐
                     ▼                         │                          ▼
             ┌───────────────┐                 │                  ┌───────────────┐
             │     PORTAL     │                │  1:N (adhesión)  │      USER      │
             │ id, tenant_id  │                │                  │ id, tenant_id  │
             │ name, domain   │                ▼                  │ portal_id? ────┼──┐
             │ config         │        ┌────────────────┐         │ email, role_id │  │
             └───┬────────────┘        │ TENANT_SERVICE  │         └────────────────┘  │
                 │ 1:N                 │ tenant_id (FK)   │                              │
                 ▼                     │ service_id (FK)  │      portal_id opcional:     │
        ┌────────────────┐             │ is_enabled       │      scopea el user a un     │
        │ PORTAL_SERVICE  │             └───┬──────────┬──┘      portal puntual ─────────┘
        │ portal_id (FK)  │                 │          │
        │ service_id (FK) │                 │ N:1      │ 1:0..1
        │ slug, mfe_url   │                 ▼          ▼
        │ sort_order      │        ┌────────────────┐ ┌───────────────────┐
        └───┬─────────────┘        │    SERVICE      │ │      BUSINESS      │
            │ N:1                  │ id, name         │ │  id, tenant_svc_id │
            └─────────────────────▶│ deployment_id    │ │  name, url          │
                                    │ requires_business│ │  ("el negocio")     │
                                    │ is_active        │ └────────────────────┘
                                    └────────┬─────────┘
                                             │ N:1
                                             ▼
                                    ┌──────────────────┐
                                    │    DEPLOYMENT     │
                                    │ id, name (único)  │
                                    │ url, api_url      │
                                    │ version, is_active│
                                    └──────────────────┘
```

**DEPLOYMENT** (migración 036): una app desplegada una sola vez por la
plataforma, con una `url` canónica. Un SERVICE (la oferta comercial) se apoya
en exactamente un deployment; un deployment puede tener cero o varios
servicios. La API sigue devolviendo `mfe_url` / `version` en los servicios,
resueltos desde `deployments.url` / `deployments.version`. Se eliminó
`services.is_internal`.

**BUSINESS** ("el negocio", migración 038): antes `service_instances`. La tabla
pasó a llamarse `businesses`, `services.requires_instance` pasó a
`requires_business` y `user_service_access.service_instance_id` pasó a
`business_id`.

## Dos modos de bootstrap de un servicio

- **Portal-bound**: el servicio se expone con marca/dominio propio de un tenant vía `PORTAL_SERVICE`. Un shell por portal (`VITE_PORTAL_ID`), descubre sus apps en `GET /api/v1/public/portals/{portal_id}`.
- **Tenant-direct**: el tenant se adhiere al servicio directo vía `TENANT_SERVICE`, sin portal. Pensado para apps compartidas entre muchos tenants (ej. `booking-admin`). El shell resuelve el tenant por header `X-Tenant-ID` (o claims del JWT) y descubre sus servicios en `GET /api/v1/public/services`.

En ambos modos la autorización runtime de base es la misma: el JWT emitido por `core-authenticator` incluye el claim `services` armado desde `TENANT_SERVICE`, independiente de portal. Ver abajo la capa opcional que restringe esto por usuario.

## Restricción de usuario a servicios puntuales (`USER_SERVICE_ACCESS`)

Capa adicional, por encima de `TENANT_SERVICE`, para el caso "quiero que este usuario en particular solo entre a un servicio del tenant, no a todos los que el tenant tiene habilitados".

```
┌────────────────┐        ┌───────────────────────┐        ┌────────┐
│      USER       │───────▶│  USER_SERVICE_ACCESS   │◀───────│  ROLE   │
│ restrict_services│  1:N   │ user_id (FK)           │  N:1   │ service_id?│
└────────────────┘        │ business_id (FK)        │        └────────┘
                            │ role_id (FK)            │
                            └───────────┬─────────────┘
                                         │ N:1
                                         ▼
                                ┌───────────────────┐
                                │      BUSINESS       │
                                └───────────────────┘
```

- `USER.restrict_services = FALSE` (default): sin cambios — el usuario ve todos los `TENANT_SERVICE` habilitados del tenant, igual que antes.
- `USER.restrict_services = TRUE`: el JWT solo incluye los servicios donde el usuario tiene un grant en `USER_SERVICE_ACCESS`. Sin grants + flag en `TRUE` = no ve ningún servicio directo (esperado, no es un bug).
- `ROLE.service_id` (nullable): un rol pertenece a un servicio específico, o es global (`NULL`, ej. superadmin). Un trigger de DB (`enforce_role_service_match`) rechaza cualquier grant donde el rol no pertenezca al servicio del negocio (`BUSINESS`).

### Hecho

- Migración `users.restrict_services` (default `FALSE`, sin breaking change).
- CRUD completo de grants (`user_service_access`): crear, listar, borrar — antes solo existía lectura para gating interno.
- `core-authenticator`: Login/Refresh arman el claim `services` respetando el flag (grants-only si `TRUE`, tenant-wide si `FALSE`).
- Endpoint de catálogo de roles por servicio (`GET /api/v1/services/{id}/roles`) para poblar el selector dependiente en el front.
- UI en core-manager (`tenant-users`): toggle de `restrict_services` + panel de gestión de grants (asignar servicio+rol, listar, borrar), con errores del trigger de DB mostrados como toast.
- `go build`/`npm run build` limpios en los tres repos (core-backend, core-authenticator, core-manager).

### Pendiente / no verificado en esta sesión

- Verificación end-to-end contra una base real (correr `goose up`, loguear un usuario con `restrict_services=TRUE` y confirmar el JWT recortado) — solo se verificó compilación, no comportamiento en runtime.
- `booking-admin` (u otro shell tenant-direct) todavía no existe en este repo, así que esta restricción no tiene todavía un consumidor real más allá del propio core-manager.
- No hay UI para editar `ROLE.service_id` ni para crear roles nuevos por servicio — el catálogo de roles se administra hoy solo por seed/SQL directo.
