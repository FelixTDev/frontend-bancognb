# Integración completa del asistente

## Alcance

Reestructurar únicamente la experiencia del asistente existente: página autenticada,
widget anónimo exclusivo de Landing, estados del contrato real y documentación de
endpoints consumidos. No se modifica el backend ni se crean endpoints o imágenes.

## Criterios verificables

1. El chat es el contenido principal y el compositor permanece visible en
   1440×900, 1024×768 y 390×844.
2. El estado vacío no usa `guided-empty-state`; la guía secundaria reutiliza
   `human-support` y contiene “Cómo usar el asistente”.
3. El widget aparece solo en Landing, usa conversación anónima real, atrapa el
   foco, cierra con Escape y devuelve el foco al lanzador.
4. El flujo representa aclaraciones, opciones, confianza baja, errores, 429,
   reintento, reinicio, feedback, escalamiento, vinculación y conversión.
5. La conversión anónima muestra enlaces a Login y Registro; nunca promete chat
   humano en tiempo real.
6. La matriz de endpoints refleja únicamente consumos efectivos del frontend.

## Ejecución

1. Escribir y ejecutar pruebas E2E en rojo para estructura, estados, navegación,
   foco y visibilidad responsive.
2. Tipar el contrato del chat y construir un componente de conversación común.
3. Sustituir la página autenticada y añadir el widget solo a `HomePage`.
4. Añadir estilos `assistant-*`, incluidos breakpoints y reduced motion.
5. Actualizar `docs/endpoint-matrix.md` con evidencia del código.
6. Ejecutar pruebas focalizadas y revisar la UI contra backend real con consola y
   red en los tres viewports.
7. Ejecutar `npm run typecheck`, `npm run lint`, `npm test`,
   `npm run test:e2e` y `npm run build` y reportar cualquier brecha.

## Inventario de QA

| Superficie | Estados | Interacciones | Evidencia |
| --- | --- | --- | --- |
| `/app/asistente` | vacío, carga, respuesta, aclaración, baja confianza, error, 429 | enviar, reintentar, reiniciar, valorar, escalar, convertir | E2E + capturas 1440/1024/390 |
| Widget Landing | cerrado, abierto, conversación anónima, autenticación requerida | abrir, Tab, Escape, enviar, Login/Registro | E2E + inspección de foco/red |
| Landing/footer | CTA y footer en viewport | scroll, ausencia de superposición | inspección visual y geométrica |
| Login/Registro | ruta pública | ausencia del widget | E2E |
| Shell móvil | navegación inferior | compositor por encima de la barra | captura y bounds DOM |

