# MISIÓN — REFINAMIENTO VISUAL PREMIUM DEL PORTAL BANCO GNB

Actúa como diseñador/a UI/UX senior, especialista en sistemas de diseño y desarrollador/a frontend con experiencia en React, TypeScript e interfaces bancarias, cuando esas tecnologías correspondan a la implementación real del repositorio.

Realiza un refinamiento visual integral, pero controlado, sobre las páginas indicadas y sobre el chatbot EXISTENTE del frontend premium del prototipo académico Banco GNB.

No se solicita rehacer el portal. Mejora la jerarquía visual, consistencia, tipografía, iconografía, imágenes, espaciado, accesibilidad y experiencia responsive, conservando la arquitectura y el comportamiento que ya funcionan.

## 1. REPOSITORIO Y LÍMITES DE TRABAJO

Trabaja exclusivamente en:

`C:\dev\sistema-gestion-tickets-portal-premium-lab`

Repositorio remoto de referencia: `FelixTDev/frontend-bancognb`.

No utilices `C:\dev\sistema-gestion-tickets\frontend`: es un checkout anterior y no corresponde al frontend premium.

El portal público de referencia es `https://portal.felixtintaya.com/`, pero todos los cambios y pruebas deben realizarse localmente contra el checkout indicado. No uses producción para pruebas que escriban datos.

No hagas commit, push, merge ni despliegue. No modifiques Cloudflare, Contabo ni el backend FastAPI. Conserva los cambios locales existentes, incluidos los que pudieran estar desarrollándose en otras sesiones.

Antes de editar, revisa `git status`, las instrucciones aplicables de `AGENTS.md` y el diff de cualquier archivo que ya tenga modificaciones. No reviertas ni sobrescribas cambios ajenos a esta tarea.

## 2. OBJETIVO Y DIRECCIÓN VISUAL

Todas las secciones intervenidas deben sentirse parte de la misma experiencia: banca digital premium, moderna, elegante, sobria, limpia y centrada en el usuario.

Prioriza jerarquía tipográfica clara, espaciado equilibrado, colores institucionales coherentes, buen contraste, iconos consistentes, imágenes pertinentes, transiciones sutiles, diseño responsive y componentes reutilizables. La calidad de composición debe producir la sensación premium.

Evita exceso de tarjetas, bordes y sombras; gradientes decorativos sin propósito; iconos mezclados; imágenes genéricas; espacios vacíos injustificados; títulos gigantes sin razón; animaciones excesivas y elementos que dificulten la lectura.

## 3. SKILLS: DESCUBRIMIENTO Y USO

Antes de implementar, comprueba las skills realmente disponibles en la sesión y lee por completo el `SKILL.md` de cada skill que vayas a aplicar. Consulta también `AGENTS.md`. La lista siguiente refleja nombres encontrados en el catálogo de skills de esta sesión; la disponibilidad puede variar en otra sesión. Verifica el catálogo actual y usa únicamente las que existan y sean pertinentes.

Skills de diseño y UI que pueden aplicar:

- `ui-ux-pro-max`: análisis y decisiones de experiencia e interfaz.
- `ui-styling`: implementación de interfaces visuales accesibles y cuidadas.
- `design-system`: tokens, tipografía, componentes y consistencia del sistema de diseño.
- `impeccable`: crítica y refinamiento de calidad visual de interfaces.
- `web-design-guidelines`: revisión de buenas prácticas de interfaces web.
- `brainstorming`: explorar requisitos y alternativas para trabajo creativo. Como esta misión ya autoriza explícitamente auditar e implementar, no detengas el trabajo para pedir aprobación de un diseño de rutina. Pide aclaración solo si aparece una decisión material que no pueda resolverse con el contexto ni con una alternativa local segura.

Skills de implementación y revisión técnica, solo si corresponden a la tecnología encontrada:

- `typescript`: cambios o revisión de TypeScript.
- `vercel-react-best-practices`: optimización y buenas prácticas de React; úsala si el proyecto utiliza React y la skill está disponible. No asumas que el proyecto es Next.js.
- `test-driven-development`: cambios de comportamiento o correcciones que requieran cobertura de pruebas; no agregues pruebas sin una necesidad concreta.
- `systematic-debugging`: fallos de pruebas, errores de ejecución o defectos que debas diagnosticar.

Skills de inspección visual y verificación:

- `playwright-interactive`: inspección e interacción en navegador si la herramienta y el entorno están disponibles.
- `screenshot`: capturas cuando ayuden a comparar la interfaz o sean requeridas por el entorno.
- `verification-before-completion`: revisión final de las afirmaciones y verificaciones antes de informar el resultado.

Aplica el conjunto mínimo pertinente; no ejecutes todas las skills por obligación. No llames “skill” a un rol de agente, paquete, herramienta o biblioteca. No inventes skills ni capacidades. Si una skill o herramienta no está disponible, indícalo brevemente en el informe y continúa con la alternativa disponible. La skill solo complementa esta misión: no autoriza cambios fuera de sus límites.

## 4. PRIMERA ACTIVIDAD — AUDITORÍA DEL PROYECTO

Antes de modificar archivos, entiende la implementación real. No asumas que una página, estilo o funcionalidad vive en un único archivo.

### 4.1 Chatbot existente

Localiza y revisa el componente principal, componentes secundarios, hooks y estado conversacional, estilos, layout, navegación, fuentes consultadas, feedback, menús, borradores, estados, controles de entrada y comportamiento responsive.

Un archivo relevante es `src/features/chat/assistant-conversation.tsx`; úsalo como pista y localiza el resto de la estructura.

El chatbot ya existe y tiene funcionalidades integradas. No lo reconstruyas, dupliques ni cambies sus funcionalidades de backend.

### 4.2 Páginas

Revisa las implementaciones locales de `/`, `/nosotros`, `/como-funciona`, `/preguntas-frecuentes` y `/ayuda`. Examina cómo se renderiza cada página y cómo se relacionan sus componentes; no inspecciones CSS aislado únicamente.

Identifica componentes reutilizables, estructura de cada hero, tipografía, fuentes, pesos, tamaños, alturas de línea, anchos máximos, espaciados, contenedores, colores, imágenes, iconos y breakpoints, además de las diferencias entre páginas.

### 4.3 Sistema de diseño y assets

Identifica tokens y convenciones vigentes. Cormorant Garamond para títulos, Manrope para interfaz y Lucide para iconografía son referencias previas: comprueba si siguen siendo las elecciones del proyecto antes de reutilizarlas. No agregues tipografías, librerías visuales o dependencias pesadas innecesariamente. Prioriza la identidad actual del Banco GNB.

Audita los assets locales antes de incorporar recursos. Reutiliza recursos existentes y optimizados cuando sean pertinentes. Solo incorpora recursos nuevos con licencia o autorización adecuada; no uses URLs externas inestables ni imágenes con marca de agua. Si no hay un recurso apropiado, resuelve la composición con los elementos locales y explica la limitación.

Al terminar la auditoría, comunica un plan breve de intervención y continúa con la implementación autorizada. Mantén el trabajo enfocado; evita refactorizaciones no relacionadas.

## 5. TIPOGRAFÍA — CÓMO FUNCIONA Y AYUDA

Usa el título principal de Preguntas frecuentes como referencia tipográfica para los títulos principales de Cómo funciona y Ayuda. Inspecciona los componentes y estilos reales: familia, tamaño, peso, line-height, letter-spacing, ancho máximo, relación con subtítulos y comportamiento responsive.

Iguala el tratamiento completo, no solo `font-size`. Reutiliza un token, clase o patrón compartido cuando encaje con la arquitectura. No modifiques Preguntas frecuentes innecesariamente. Respeta los breakpoints reales para móvil, tablet y escritorio.

## 6. PÁGINA CÓMO FUNCIONA

Revisa los pasos descritos y añade o mejora iconos solo para las etapas respaldadas por el contenido y el funcionamiento real, como registro, evaluación, asignación o atención, seguimiento y resolución. No inventes procesos.

Mejora la distribución de pasos, relación entre texto e iconos, separación entre secciones, flujo visual y composición móvil. Incorpora imágenes o ilustraciones existentes solo cuando ayuden a entender el portal. No agregues una imagen por párrafo ni recursos nuevos sin licencia/autorización adecuada.

## 7. PÁGINA AYUDA

Iguala la jerarquía tipográfica del título principal con Preguntas frecuentes.

Usa iconos coherentes con funciones reales: preguntas frecuentes, asistente virtual, consulta de tickets, registro de solicitudes, atención humana y canales de orientación. No presentes atención humana en tiempo real si el sistema no la ofrece.

Evalúa una imagen o ilustración editorial de atención digital, soporte o asistencia, integrada con el contenido. Evita un banner genérico o excesivamente alto.

Organiza la página para que el usuario encuentre rápidamente dónde buscar respuestas, cómo utilizar el chatbot, consultar un caso, registrar una solicitud y solicitar atención. Limítate a capacidades existentes y evita duplicar las preguntas frecuentes completas.

## 8. PÁGINA NOSOTROS — HERO

Compara el hero local de `/nosotros` con el de `/`. Comprueba si la diferencia detectada previamente —una escala mayor y line-height más comprimido en Nosotros— sigue presente.

Haz que el título de Nosotros tenga una escala tipográfica equivalente a Inicio. Revisa también line-height, letter-spacing, ancho del texto y comportamiento móvil. Conserva una composición equilibrada y la identidad propia de Nosotros. No cambies sin necesidad la imagen de fondo, los textos, composición, contraste ni decoración existentes.

## 9. REFINAMIENTO DEL CHATBOT EXISTENTE

La prioridad es mejorar la presentación del asistente sin reconstruirlo ni cambiar sus contratos de backend.

### 9.1 Controles de conversación

Elimina el encabezado y contenedor independiente “ACCIONES”, pero conserva las funciones “Volver al menú” y “Finalizar”. Reubícalas compactamente como controles secundarios, preferentemente bajo el encabezado del chatbot.

“Volver al menú” debe tener etiqueta comprensible, icono consistente, estilo discreto y estados hover/focus. “Finalizar” debe comunicar cierre de conversación —no cierre de sesión—, usar un icono adecuado y conservar la confirmación para evitar cierres accidentales. En móvil, mantén áreas táctiles accesibles sin consumir espacio excesivo.

### 9.2 Fuentes consultadas

Sustituye el bloque prominente actual por un control compacto “Ver fuente” o “Ver fuentes”, según corresponda. El control debe expandir título real, URL oficial, categoría y fecha de verificación cuando estén disponibles.

La información debe provenir exclusivamente del contrato del backend. Conserva fuentes y trazabilidad; no inventes URLs ni elimines metadatos. Usa un disclosure accesible o un patrón equivalente existente. Evita que títulos largos dominen la conversación.

### 9.3 Feedback

Compacta “¿Te ayudó esta respuesta?” y sus controles. Usa iconos Lucide consistentes de pulgar arriba y abajo, espaciado reducido, estados hover/focus/seleccionado, etiquetas accesibles y confirmación discreta. Conserva la persistencia y el endpoint existentes.

Evalúa colocar feedback junto al control de fuentes cuando haya espacio. En pantallas pequeñas permite otra línea sin desbordamiento.

### 9.4 Mensajes y conversación

Revisa mensajes del usuario y del bot, bordes, sombras, colores, tamaños, avatares, espacios, párrafos largos, enlaces y errores. La conversación debe ser protagonista. Reduce contenedores anidados que no aporten y conserva contraste y legibilidad.

### 9.5 Campo de escritura

Revisa altura, padding, botón e icono de envío, alineación, estados deshabilitados, carga, responsive y scroll. Evita que campo, footer y controles se superpongan.

### 9.6 Navegación y estados

Conserva la navegación dinámica. Verifica `ui.options`, `option_id`, menú principal, categorías, subcategorías, navegación hacia atrás, opciones persistentes, restauración de conversación, borradores pausados, confirmaciones y cierre.

No inventes IDs ni categorías. No conviertas botones en mensajes si el contrato contiene una acción estructurada. Presenta opciones con estilos elegantes, coherentes y compactos.

Refina visualmente bienvenida, carga, respuesta, consulta sin resultados, error de red, fallback, solicitud de autenticación, conversación cerrada y ticket confirmado, cuando existan. No expongas estados internos de proveedores de IA.

## 10. ICONOS E IMÁGENES

Utiliza la biblioteca instalada —preferentemente Lucide si sigue siendo la vigente— y mantén consistencia de tamaño, trazo, color, espaciado, alineación y significado. No mezcles emojis e iconos como sustitutos funcionales.

Usa assets optimizados y pertinentes, `alt` descriptivos, dimensiones apropiadas y `loading="lazy"` cuando corresponda, sin retrasar la imagen principal del hero. Evita cambios de layout y recursos que compitan con el contenido.

## 11. RESPONSIVE Y ACCESIBILIDAD

Comprueba escritorio, laptop, tablet y móvil con anchos de referencia de 1440, 1024, 768, 390 y 360 px, adaptados a breakpoints reales.

Verifica desbordamientos, recortes, jerarquía tipográfica, menús, hero, imágenes, chatbot, áreas táctiles, foco visible, contraste, teclado y controles expandibles. Respeta `prefers-reduced-motion` si aplicas animaciones. No sacrifiques funcionalidad por estética.

## 12. RESTRICCIONES ABSOLUTAS

Trabaja solo en el frontend premium. No modifiques backend FastAPI, RAG, guardrails, integración OpenAI, MySQL, migraciones, Brevo, recuperación de contraseña, Google/Microsoft OAuth, Cloudflare, Contabo ni configuración de producción.

No alteres textos funcionales, procedimientos bancarios ni datos reales sin necesidad. No rompas contratos existentes. No hagas commit, push, merge ni despliegue. Conserva cambios locales ajenos. Inspecciona el diff antes de tocar archivos previamente modificados.

No realices llamadas reales a OpenAI. Usa mocks en pruebas del chatbot. No uses servicios productivos para pruebas que escriban datos.

## 13. PROCEDIMIENTO DE EJECUCIÓN

### Etapa A — Auditoría y plan breve

1. Revisa `git status`, instrucciones `AGENTS.md` y diffs de archivos que pudieran estar modificados.
2. Aplica las skills pertinentes que estén disponibles; lee sus instrucciones antes de usarlas.
3. Examina el chatbot, las cinco páginas, tokens, componentes, assets e iconos.
4. Identifica problemas de jerarquía y oportunidades de reutilización.
5. Resume el diagnóstico y el plan en pocas líneas y continúa con la implementación autorizada.

### Etapa B — Implementación

Aplica cambios en los componentes existentes y prioriza:

1. Jerarquía del chatbot y reubicación de acciones.
2. Fuentes y feedback.
3. Mensajes, iconografía y controles del chatbot.
4. Títulos de Cómo funciona y Ayuda.
5. Hero de Nosotros.
6. Recursos gráficos pertinentes en páginas informativas.
7. Responsive y accesibilidad.

Reutiliza componentes existentes cuando sean adecuados y crea otros solo cuando den una separación útil y coherente.

### Etapa C — Inspección visual

Usa Playwright o las herramientas de navegador disponibles para comprobar localmente Inicio, Nosotros, Cómo funciona, Preguntas frecuentes, Ayuda y chatbot abierto, en escritorio y móvil. Toma capturas antes/después si es viable. Guarda artefactos locales fuera del seguimiento de Git; comprueba que cualquier carpeta dentro del repositorio esté ignorada antes de guardar allí. Corrige defectos visibles.

Si Playwright, navegador o el servidor local no están disponibles, informa qué faltó y usa las verificaciones locales posibles. No afirmes inspección visual si no se realizó.

### Etapa D — Verificación

Ejecuta verificaciones pertinentes que ya soporte el proyecto: typecheck de TypeScript, ESLint, tests existentes, build, E2E con Playwright, pruebas visuales pertinentes y `git diff --check`. Usa mocks para el chatbot. No añadas pruebas solo por rutina; crea o modifica pruebas únicamente si el cambio de comportamiento lo requiere.

Registra los comandos ejecutados y los resultados reales. Distingue entre éxito, fallo y prueba no ejecutada. No declares que una verificación pasó si no la ejecutaste.

## 14. CRITERIOS DE ACEPTACIÓN

La tarea está terminada cuando:

- Cómo funciona y Ayuda tienen jerarquía tipográfica equivalente a Preguntas frecuentes.
- El título del hero de Nosotros tiene escala coherente con Inicio.
- Los recursos gráficos aportan valor y los iconos son consistentes.
- El chatbot ya no tiene la barra independiente “ACCIONES”.
- Volver al menú y Finalizar siguen disponibles y están correctamente reubicados.
- Fuentes y feedback tienen presentación compacta y siguen funcionando.
- Se conserva el comportamiento anterior del chatbot y sus contratos.
- No hay desbordamientos móviles en los tamaños revisados.
- Se conserva la accesibilidad pertinente.
- Pasan las verificaciones ejecutadas que correspondan, o se declaran sus fallos/limitaciones.
- No se modifica producción.

## 15. INFORME FINAL

Entrega un informe breve, factual y verificable con:

**A. Diagnóstico inicial:** problemas visuales encontrados.

**B. Skills utilizadas:** nombres exactos disponibles en esta sesión y para qué se aplicaron. Distingue las no disponibles que afectaron la verificación.

**C. Cambios por página:** Inicio, Nosotros, Cómo funciona, Preguntas frecuentes y Ayuda. Indica claramente si alguna solo se inspeccionó y no requirió cambios.

**D. Cambios del chatbot:** controles de conversación, fuentes, feedback, botones, iconos y jerarquía.

**E. Recursos visuales:** imágenes e iconos reutilizados o incorporados.

**F. Responsive y accesibilidad:** tamaños y aspectos comprobados, según evidencia real.

**G. Pruebas:** comandos y resultado real de typecheck, lint, build y Playwright u otras verificaciones aplicables.

**H. Archivos modificados:** archivo y propósito del cambio.

**I. Pendientes o limitaciones:** solo los que existan.

**J. Revisión manual:** rutas locales para revisar el resultado.

## INSTRUCCIÓN FINAL

Analiza primero el diseño y los componentes reales, comprende la identidad del portal y luego implementa un refinamiento profesional coherente en las páginas informativas y en el chatbot existente. Respeta lo que ya funciona, conserva los contratos, no reescribas el portal ni modifiques el backend. Deja una versión local verificada y lista para que el usuario la revise antes de publicar.
