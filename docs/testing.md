# Verificación

## Automatización

- Vitest cubre transporte HTTP, persistencia de sesión, validaciones y matriz de roles.
- Playwright cubre portada, ingreso, acceso por rol, navegación móvil y tablet, gestión de solicitudes, foco de drawer/diálogos y rutas autenticadas.
- `tests/e2e/assistant-phase1.spec.ts` cubre acciones estructuradas y consulta libre, fuentes con URLs seguras, aclaraciones, seguimiento explícito, revisión y confirmación del ticket, doble envío, retorno desde ingreso/registro, vinculación con `link-user`, reinicio y recarga, errores `401`, `403`, `404`, `409`, `429` y red.
- Las mutaciones del E2E de Fase 1 se interceptan en Playwright. No crean tickets ni modifican el backend. Las pruebas unitarias verifican el mapeo de acciones, mensajes de error, persistencia mínima de conversación y retorno seguro de autenticación.
- La matriz de endpoints documenta el contrato completo; el reinicio de Fase 1 usa la creación de conversación y no llama a la operación `/reset`.

## Capturas

`scripts/capture-screenshots.mjs` produce capturas de las rutas principales en:

- 1440 × 900
- 1024 × 768
- 390 × 844

Para el asistente, `scripts/capture-assistant.mjs` genera seis capturas en desktop, tablet y móvil con respuestas API simuladas, sin iniciar sesión contra el backend ni crear datos. El manifiesto queda en `artifacts/screenshots/assistant-phase1-mock/assistant-manifest.json`; el directorio es independiente de las capturas previas.

## Comandos de cierre

```powershell
npm run typecheck
npx tsc --noEmit -p tsconfig.e2e.json
npm run lint
npm test
npm run test:e2e
npm run build
node scripts/capture-assistant.mjs
```

La validación OpenAPI puede hacerse sin levantar el backend importando la aplicación y leyendo `app.openapi()` en el entorno de backend. Esa lectura no ejecuta operaciones de conversación ni crea datos. Los E2E y las capturas anteriores usan respuestas simuladas; no prueban conectividad con un backend desplegado.
