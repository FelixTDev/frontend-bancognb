# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19, TypeScript estricto, Vite, React Router, TanStack Query, React Hook Form, Zod, Lucide React, Motion for React, CSS organizado con variables semánticas, Vitest, React Testing Library y Playwright.

## Users

- Clientes que necesitan registrar, seguir y complementar solicitudes de atención digital.
- Asesores que atienden una bandeja operativa, responden, gestionan estados y controlan SLA.
- Supervisores que administran la cola, asignaciones, conocimiento, políticas SLA, reportes y auditoría.

## Product Purpose

Banco GNB Atención Digital centraliza solicitudes, orientación y seguimiento en una experiencia web confiable. El éxito significa que cada persona entiende qué puede hacer, encuentra su siguiente acción y completa su flujo con estados, errores y trazabilidad claros.

## Positioning

Una experiencia de atención financiera que une orientación autoservicio, asistencia conversacional y gestión operativa trazable sin presentar el portal como un dashboard genérico.

## Operating Context

El cliente inicia desde una landing pública, consulta preguntas frecuentes o el asistente, se autentica y gestiona tickets. Asesores y supervisores trabajan en superficies operativas de alta densidad con búsqueda, filtros, asignaciones, SLA, reportes y auditoría.

## Capabilities and Constraints

- El frontend consume exclusivamente la API FastAPI real bajo `/api/v1` mediante `VITE_API_BASE_URL`.
- Los roles públicos son `CLIENTE`, `ASESOR` y `SUPERVISOR`.
- Los estados reales de ticket son `NUEVO`, `ASIGNADO`, `EN_PROCESO`, `PENDIENTE_CLIENTE`, `RESUELTO`, `CERRADO` y `CANCELADO`.
- Los códigos de seguimiento respetan `TCK-YYYYMMDD-XXXXXXXXXX`.
- No se inventan endpoints, respuestas, métricas comerciales, testimonios ni capacidades.
- No se usan emojis ni se exponen tokens, credenciales o secretos.
- El backend es de solo lectura para este trabajo.

## Brand Commitments

- Nombre visible: Banco GNB Atención Digital.
- Personalidad: financiera, confiable, moderna, sobria, humana y precisa.
- Dirección vinculante: acabado editorial premium con navy profundo, azul institucional, blanco cálido y dorado sobrio.
- Iconografía: una sola familia, Lucide React.
- La referencia `https://uupm.cc/demo/legal-services` fija el nivel de jerarquía, ritmo, imagen y acabado, no su identidad ni contenido.

## Evidence on Hand

- Backend FastAPI activo en `http://localhost:8000` con OpenAPI real y documentación Swagger.
- Datos y contratos verificables en `C:\dev\sistema-gestion-tickets\backend`.
- La carpeta frontend comenzó vacía; no existían Login, cliente HTTP, estilos, pruebas ni assets que conservar.
- No hay testimonios, cifras de impacto ni logos oficiales adicionales suministrados; no deben fabricarse.

## Product Principles

1. La siguiente acción siempre es visible y comprensible.
2. La confianza se demuestra con trazabilidad, estados y lenguaje preciso.
3. La densidad operativa aumenta por rol sin sacrificar jerarquía ni accesibilidad.
4. Cada integración refleja el contrato real del backend y declara cualquier brecha.
5. La experiencia se adapta de forma intencional a desktop, tablet y mobile.

## Accessibility & Inclusion

Cumplimiento WCAG AA, navegación completa por teclado, foco visible, etiquetas y mensajes asociados, contraste suficiente, objetivos táctiles de al menos 44 px y respeto por `prefers-reduced-motion`.
