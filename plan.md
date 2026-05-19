# TailUI — Headscale Admin Dashboard: Plan por Fases

## Context

Construir un panel de administración self-hosted para Headscale que replique la experiencia de la consola Tailscale.
Patrón BFF: el frontend React nunca expone la API key de Headscale; el backend Fastify la mantiene en server-side, autentica sesiones, proxea llamadas y emite SSE para estado en tiempo real.
Todo corre en Docker Compose en un VPS de un núcleo junto a una instancia Headscale existente.

**Filosofía de instalación**: todos los valores tienen defaults razonables. Solo los estrictamente necesarios (API key de Headscale y contraseña de admin) se solicitan interactivamente mediante un wizard de primer arranque.

**Regla de iteración**: cada fase termina con un commit en git y una verificación manual antes de continuar.

---

## Estructura del Monorepo

```
tailui/
├── docker-compose.yml
├── .env.example          ← solo documentación; wizard genera el .env real
├── setup.sh              ← wizard interactivo de primer arranque
├── backend/
│   ├── Dockerfile
│   ├── package.json / tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── auth/
│       ├── routes/
│       ├── headscale/   ← cliente tipado
│       ├── db/          ← SQLite (sessions + audit)
│       └── sse/
└── frontend/
    ├── Dockerfile
    ├── vite.config.ts
    ├── package.json / tsconfig.json
    └── src/
        ├── main.tsx
        ├── router.tsx
        ├── api/         ← TanStack Query hooks
        ├── components/
        ├── pages/
        └── stores/      ← Zustand
```

---

## Defaults y wizard

### Variables con default automático (no se preguntan)
| Variable | Default |
|---|---|
| `HEADSCALE_URL` | `http://headscale:8080` |
| `PORT` | `3001` |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `warn` |
| `SESSION_SECRET` | generado con `openssl rand -hex 32` |

### Variables que sí requiere el wizard (sin default válido)
| Variable | Pregunta |
|---|---|
| `HEADSCALE_API_KEY` | "Pega tu Headscale API key:" |
| `ADMIN_USERNAME` | "Nombre de usuario del panel (default: admin):" |
| `ADMIN_PASSWORD` | "Contraseña del panel (se hará hash con bcrypt):" |

### Comportamiento del wizard (`setup.sh`)
1. Detecta si `.env` ya existe → pregunta si sobreescribir
2. Solicita solo las variables requeridas (las opcionales usan defaults)
3. Genera `SESSION_SECRET` automáticamente
4. Hace hash bcrypt de la contraseña con Node.js
5. Escribe `.env` con todos los valores
6. Ejecuta `docker compose up -d --build`
7. Muestra URL de acceso y credenciales

---

## Fases

### Fase 0 — Bootstrap, Git & Setup Wizard *(prerequisito)*
**Objetivo**: monorepo en pie, wizard funcional, docker compose arranca con un solo comando.

Tareas:
- `git init` en el directorio del proyecto
- `.gitignore` (node_modules, dist, .env, *.db)
- `docker-compose.yml` con los dos servicios + red externa `hs-net`
- `.env.example` con todas las variables documentadas
- `setup.sh` — wizard interactivo bash:
  - Detecta si `.env` existe y pregunta si sobreescribir
  - Pide `HEADSCALE_API_KEY`, `ADMIN_USERNAME` (default: admin), `ADMIN_PASSWORD`
  - Genera `SESSION_SECRET` con `openssl rand -hex 32`
  - Genera hash bcrypt con `node -e "require('bcryptjs').hash(...).then(console.log)"`
  - Escribe `.env` con defaults para el resto
  - Ejecuta `docker compose up -d --build`
  - Imprime URL de acceso
- Backend: scaffold Fastify + TypeScript, endpoint `GET /health` → `{ok:true}`
- Frontend: scaffold Vite + React 18 + TypeScript, página `<App>` con texto "TailUI"

Verificación:
```bash
bash setup.sh          # wizard, responde preguntas
curl http://localhost:3001/health   # → {"ok":true}
curl http://localhost:5173           # → HTML con "TailUI"
```
Commit: `feat: bootstrap monorepo + setup wizard`

---

### Fase 1 — Autenticación
**Objetivo**: login/logout funcional con JWT httpOnly.

Tareas:
- Backend: `POST /auth/login` (bcrypt compare vs env), firma JWT con `jose`, cookie httpOnly sameSite=strict
- Backend: `POST /auth/logout` (borra cookie)
- Backend: `GET /auth/me` (valida JWT → devuelve `{username}`)
- Backend: middleware auth guard en rutas `/api/*`
- Frontend: página `LoginPage` (shadcn/ui Card + Form)
- Frontend: Zustand store `useAuthStore` con `user` y `logout`
- Frontend: TanStack Router → redirect a `/login` si no hay sesión

Verificación:
```bash
curl -X POST localhost:3001/auth/login -d '{"username":"admin","password":"xxx"}' -c cookies.txt
curl -b cookies.txt localhost:3001/auth/me   # → {"username":"admin"}
curl -b cookies.txt localhost:3001/api/nodes # → 401 si headscale no responde, no 403
```
Commit: `feat: auth login/logout JWT httpOnly cookie`

---

### Fase 2 — Cliente Headscale + Endpoint Overview
**Objetivo**: el BFF puede hablar con Headscale y agregar estadísticas.

Tareas:
- Backend: módulo `headscale/client.ts` — fetch tipado con `Authorization: Bearer` para todos los endpoints usados
- Backend: tipos TypeScript de los recursos principales (Node, User, PreAuthKey, Route, DnsConfig)
- Backend: `GET /api/overview` → `{nodesTotal, nodesOnline, usersCount, lastSeen[]}` (online = last_seen < 3 min)
- Backend: SQLite setup con `better-sqlite3`, tabla `audit_log(id, action, actor, target, ts)`

Verificación:
```bash
curl -b cookies.txt localhost:3001/api/overview
# → {"nodesTotal":N,"nodesOnline":M,"usersCount":K,...}
```
Commit: `feat: headscale client + /api/overview + sqlite audit`

---

### Fase 3 — Dashboard UI
**Objetivo**: pantalla principal con métricas reales.

Tareas:
- Frontend: layout raíz — sidebar izquierdo con iconos Lucide + labels (Nodes, Users, Auth Keys, API Keys, Routes, DNS, ACL)
- Frontend: `DashboardPage` con 3 stat cards (nodos totales, online, usuarios)
- Frontend: feed "Recent Activity" con últimas 10 entradas de `audit_log`
- Frontend: TanStack Query hook `useOverview` — poll cada 15 s
- Frontend: skeleton loaders mientras carga, color palette dark por defecto

Verificación: abrir `http://localhost:5173` → dashboard muestra datos reales de Headscale.

Commit: `feat: dashboard overview UI with stats + activity feed`

---

### Fase 4 — Listado de Nodos
**Objetivo**: tabla de nodos con estado en tiempo real (polling).

Tareas:
- Backend: `GET /api/nodes` → lista de nodos con campo `online: boolean` calculado
- Frontend: `NodesPage` — tabla con columnas: hostname, IP, user, OS icon, last seen, badge online/offline
- Frontend: hook `useNodes` con TanStack Query poll 15 s
- Frontend: filter bar (por user, status: online/offline/expired)
- Frontend: búsqueda por hostname o IP

Verificación: tabla carga nodos, badge cambia de color, filtros reducen resultados.

Commit: `feat: nodes list with polling status badges + filters`

---

### Fase 5 — Acciones sobre Nodos
**Objetivo**: CRUD completo de nodos desde la UI.

Tareas:
- Backend: `PATCH /api/nodes/:id` (rename, update tags), `DELETE /api/nodes/:id`, `POST /api/nodes/:id/expire`
- Frontend: drawer lateral `NodeDetailDrawer` — info completa, rutas, expiry
- Frontend: menú de acciones por fila: Rename, Expire, Delete (con modal confirmación para Delete)
- Frontend: bulk actions (checkbox + toolbar): expire selected, delete selected
- Frontend: toast notifications (success/error) en todas las acciones

Verificación: renombrar nodo en UI → verificar cambio en Headscale CLI; delete → nodo desaparece.

Commit: `feat: node actions rename/expire/delete + bulk + drawer`

---

### Fase 6 — Gestión de Usuarios
**Objetivo**: CRUD completo de namespaces/usuarios.

Tareas:
- Backend: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:name`, `DELETE /api/users/:name`
- Frontend: `UsersPage` — tabla con columnas: nombre, nodos asignados, acciones
- Frontend: modal crear usuario (validación de nombre), modal renombrar, modal confirmar delete (warning si tiene nodos)
- Frontend: "Move node" — selector de usuario en NodeDetailDrawer

Verificación: crear usuario, asignarle un nodo, borrarlo (con warning).

Commit: `feat: users CRUD + move node between users`

---

### Fase 7 — Pre-Auth Keys
**Objetivo**: gestión de claves de pre-autenticación por usuario.

Tareas:
- Backend: `GET /api/users/:name/preauthkeys`, `POST /api/users/:name/preauthkeys`, `POST /api/users/:name/preauthkeys/:id/expire`
- Frontend: `AuthKeysPage` — tabla por usuario con: prefijo, creada, expiry, reusable, used count, tags
- Frontend: modal "Create Key" — selector usuario, expiry date picker, toggle reusable, tags input
- Frontend: modal "Copy Key" — muestra la clave completa una sola vez con botón copiar + aviso "save it now"
- Frontend: botón "Expire" con confirmación

Verificación: crear key, copiar, verificar en Headscale que existe, expirar, verificar que ya no aparece activa.

Commit: `feat: pre-auth keys list/create/expire + one-time copy modal`

---

### Fase 8 — API Keys
**Objetivo**: gestión de API keys de Headscale.

Tareas:
- Backend: `GET /api/apikeys`, `POST /api/apikeys`, `DELETE /api/apikeys/:prefix`
- Frontend: `ApiKeysPage` — tabla con prefijo + expiry
- Frontend: modal "Create API Key" con expiry, botón "Revoke" con confirmación

Verificación: crear API key desde la UI, verificar en Headscale, revocarla.

Commit: `feat: api keys CRUD page`

---

### Fase 9 — Rutas y Exit Nodes
**Objetivo**: gestionar rutas de subred y exit nodes por nodo.

Tareas:
- Backend: `GET /api/routes`, `POST /api/nodes/:id/routes/:routeId/enable`, `POST /api/nodes/:id/routes/:routeId/disable`
- Frontend: `RoutesPage` — lista de rutas agrupadas por nodo, toggle enable/disable
- Frontend: badge "Exit Node" en la tabla de nodos si el nodo lo es
- Frontend: opción "Mark as Exit Node" en NodeDetailDrawer

Verificación: activar una ruta en UI → confirmar en Headscale que está habilitada.

Commit: `feat: routes enable/disable + exit node indicator`

---

### Fase 10 — Configuración DNS
**Objetivo**: gestión de MagicDNS y nameservers desde la UI.

Tareas:
- Backend: `GET /api/dns`, `PATCH /api/dns`
- Frontend: `DnsPage` — toggle MagicDNS, input base domain, lista nameservers globales (add/remove), split DNS (per-domain overrides)

Verificación: desactivar MagicDNS desde UI → verificar en Headscale config.

Commit: `feat: DNS config page MagicDNS + nameservers + split DNS`

---

### Fase 11 — Editor ACL / Policy
**Objetivo**: editar la política HuJSON con validación.

Tareas:
- Backend: `GET /api/policy`, `PUT /api/policy`
- Frontend: `AclPage` — CodeMirror con sintaxis HuJSON, botón "Validate" (llama al endpoint de validación de Headscale), botón "Save"
- Frontend: timestamp "Last modified", diff view básico (antes/después)

Verificación: editar ACL, validar (debe pasar/fallar según contenido), guardar → confirmar en Headscale.

Commit: `feat: ACL policy editor with HuJSON syntax + validate`

---

### Fase 12 — SSE Real-time Status
**Objetivo**: estado online/offline de nodos sin polling, vía SSE.

Tareas:
- Backend: módulo `sse/broadcaster.ts` — poll Headscale cada 15 s, emite evento si `online` de algún nodo cambia
- Backend: `GET /api/events` — endpoint SSE, protegido por session JWT via query param token
- Frontend: hook `useNodeSSE` — suscribe al stream, actualiza caché TanStack Query con los deltas recibidos
- Frontend: badge de nodo se actualiza en tiempo real sin recargar la tabla

Verificación: desconectar un nodo de la VPN → badge cambia a offline en ≤ 20 s sin recargar página.

Commit: `feat: SSE real-time node online/offline broadcaster`

---

### Fase 13 — Docker Optimización & README
**Objetivo**: imágenes de producción optimizadas, deploy documentado.

Tareas:
- Backend `Dockerfile`: multi-stage (node:20-alpine build → node:20-alpine run), sin devDeps
- Frontend `Dockerfile`: multi-stage (node:20-alpine build → nginx:alpine serve), `nginx.conf` con SPA fallback
- `docker-compose.yml`: memory limits finales (backend 128m, frontend 64m)
- `README.md`: setup completo — `bash setup.sh` y listo

Verificación:
```bash
docker compose build
docker compose up -d
docker stats   # backend ≤ 128MB, frontend ≤ 64MB
```
Commit: `feat: optimized multi-stage dockerfiles + README`

---

## Progreso

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0    | Bootstrap + Git + Wizard | ⬜ Pendiente |
| 1    | Autenticación | ⬜ Pendiente |
| 2    | Cliente Headscale + Overview | ⬜ Pendiente |
| 3    | Dashboard UI | ⬜ Pendiente |
| 4    | Listado de Nodos | ⬜ Pendiente |
| 5    | Acciones sobre Nodos | ⬜ Pendiente |
| 6    | Gestión de Usuarios | ⬜ Pendiente |
| 7    | Pre-Auth Keys | ⬜ Pendiente |
| 8    | API Keys | ⬜ Pendiente |
| 9    | Rutas y Exit Nodes | ⬜ Pendiente |
| 10   | Configuración DNS | ⬜ Pendiente |
| 11   | Editor ACL / Policy | ⬜ Pendiente |
| 12   | SSE Real-time Status | ⬜ Pendiente |
| 13   | Docker Optimización & README | ⬜ Pendiente |

---

## Decisiones de arquitectura fijas

- **Auth**: bcrypt login + JWT httpOnly cookie (jose). Sin OAuth.
- **DB**: `better-sqlite3` — solo sesiones + audit_log. Sin PostgreSQL.
- **API Headscale**: REST gRPC-Gateway en `/api/v1/`. Header `Authorization: Bearer <API_KEY>`.
- **Online threshold**: `last_seen` < 3 min = online.
- **Pre-auth key**: devuelta solo una vez, nunca almacenada en BFF.
- **CORS**: no necesario en prod (mismo dominio vía NPM). Dev: Vite proxy `/api` → backend.
- **Red Docker**: `hs-net` externa, ya existe con Headscale.
