# Banco GNB — Atención Digital

Frontend completo para el sistema de gestión de tickets. Está construido con React 19, Vite, TypeScript estricto, React Router, TanStack Query, React Hook Form, Zod, Motion y Lucide. Consume exclusivamente el backend FastAPI existente; no simula datos de negocio.

## Requisitos

- Node.js 20 o superior.
- Backend disponible en `http://localhost:8000`.
- Datos demo inicializados en el backend.

## Inicio local

```powershell
Copy-Item .env.example .env.local
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Accesos locales

| Rol        | Correo                | Contraseña local      |
| ---------- | --------------------- | --------------------- |
| Cliente    | `cliente@demo.com`    | `demo-password-local` |
| Asesor     | `asesor@demo.com`     | `demo-password-local` |
| Supervisor | `supervisor@demo.com` | `demo-password-local` |

Estas cuentas corresponden al seed del backend local y no deben reutilizarse fuera de desarrollo.

## Scripts

| Comando                | Uso                                           |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | servidor de desarrollo                        |
| `npm run build`        | compilación TypeScript y bundle de producción |
| `npm run typecheck`    | verificación TypeScript estricta              |
| `npm run lint`         | ESLint con reglas tipadas                     |
| `npm test`             | pruebas unitarias con Vitest                  |
| `npm run test:e2e`     | pruebas funcionales con Playwright            |
| `npm run api:types`    | regenera tipos desde OpenAPI real             |
| `npm run assets:build` | genera variantes WebP responsivas             |

## Estructura

```text
src/
  app/                 router y proveedores globales
  assets/images/       originales y variantes WebP
  features/auth/       sesión, roles y validaciones
  layouts/             shell público y autenticado
  pages/               páginas públicas, auth, portal y operación
  routes/              guardas RBAC
  shared/api/          cliente HTTP, endpoints y tipos OpenAPI
  shared/components/   componentes comunes
  styles/              tokens y estilos globales
tests/e2e/              flujos Playwright contra backend real
docs/                   arquitectura, matrices y evidencia
```

## Decisiones clave

- El backend sigue siendo la fuente de verdad para autorización y validación.
- La sesión se persiste en `localStorage` para este entorno y se revalida con `/auth/me` al restaurarse.
- Cada request agrega `Authorization` y `X-Request-ID`; los errores del backend se normalizan para la interfaz.
- Adjuntos usan `XMLHttpRequest` únicamente para mostrar progreso real de carga.
- La navegación se separa por rol y se complementa con guardas de ruta.
- Las imágenes generadas se sirven en tres anchos WebP mediante `<picture>`.

## Documentación

- [Arquitectura](docs/architecture.md)
- [Rutas y roles](docs/routes-and-roles.md)
- [Matriz de endpoints](docs/endpoint-matrix.md)
- [Sistema visual](docs/design-system.md)
- [Pruebas y capturas](docs/testing.md)
- [Gaps del backend](docs/backend-gaps.md)
