# Revisión de diseño Impeccable

## Dirección rectora

La interfaz se entiende como un **expediente de atención concierge**: una experiencia financiera sobria en la que cada solicitud conserva contexto, estado, responsables y trazabilidad, pero se presenta con la calma y el cuidado de un servicio personal. La expresión pública persuade mediante composición editorial e imagen arquitectónica; las áreas autenticadas operan como una mesa de atención precisa, legible y confiable.

La idea previa de “libro mayor de confianza digital” sigue siendo compatible como fundamento: líneas finas, columnas claras, marcas de estado y numeración tabular. “Expediente concierge” añade la capa humana que se ve en la narrativa, la asistencia contextual y el seguimiento de cada caso.

Principios visibles:

- La siguiente acción debe ser evidente sin convertir la pantalla en un tablero genérico.
- El navy estructura y contiene; el azul identifica interacción; el dorado señala jerarquía y precisión con moderación.
- La tipografía editorial aporta autoridad a títulos y momentos narrativos; la sans sostiene lectura, formularios y operación.
- La densidad aumenta con el rol: aire editorial para público y cliente, mayor compacidad para asesor y supervisor.
- Estados, historial, SLA, comentarios y correlación son parte del lenguaje de confianza, no detalles secundarios.

## Fuentes de verdad y precedencia

1. `PRODUCT.md` define producto, roles, contratos, restricciones y compromisos de marca.
2. `src/styles/tokens.css` es la fuente normativa de color, espacio, radios, sombras, tipografía, motion y capas.
3. `src/styles/global.css` y los componentes React definen el comportamiento visual realmente entregado.
4. `docs/superpowers/specs/2026-10-02-premium-ticket-portal-design.md` conserva la intención de experiencia.
5. `artifacts/screenshots/manifest.json` y sus imágenes son evidencia renderizada de las tres clases de dispositivo.

`design-system/banco-gnb-atención-digital/MASTER.md` es un artefacto generado anterior y **no debe prevalecer** sobre el frontend actual: todavía propone IBM Plex, `#0F172A` y otros valores que no coinciden con Cormorant Garamond, Manrope ni la paleta implementada. Si se regenera, debe alinearse con los tokens vigentes.

## Decisiones visuales vigentes

### Color

- Base institucional: navy profundo (`#061524`, `#0a2037`, `#12304f`) para hero, sidebar, módulos de confianza y superficies inversas.
- Acción: azul (`#0d4f8b`) y sus estados hover/foco; no sustituirlo por dorado en controles rutinarios.
- Acento premium: dorado sobrio (`#9b7725`, con variantes `#846319` y `#f3ead3`) para líneas, hitos, navegación activa y llamadas institucionales puntuales.
- Lienzo: marfil cálido (`#fbfaf7`, `#f5f1e8`) combinado con paneles blancos; evita la frialdad de un dashboard estándar.
- Estados semánticos: verde para éxito/SLA, ámbar para espera o prioridad alta, rojo para error/cancelación y azul claro para información.
- El foco visible usa azul luminoso (`#0b7fce`) y no depende solo del cambio de color de borde.

### Tipografía

- Display: Cormorant Garamond 600/700 para `h1`, `h2`, cifras expresivas y momentos de relato.
- Interfaz: Manrope 400/500/600/700 para navegación, controles, tablas, etiquetas y cuerpo.
- Los títulos usan escala fluida con `clamp`, interletraje ligeramente cerrado y balance de línea.
- Los datos operativos, códigos, fechas y métricas usan cifras tabulares cuando corresponde.
- La lectura larga se limita a `68ch`; el cuerpo mantiene ritmo de `1.6`.

### Espacio, forma y profundidad

- Ritmo basado en 4 px, con escala de `0.25rem` a `6rem`.
- Radios contenidos de 6, 10, 14 y 16 px; las píldoras se reservan para estados y prioridades, y los círculos para iconos, avatares e hitos.
- Sombras navy muy suaves distinguen paneles sin crear una interfaz flotante: baja en tarjetas, media en popovers y alta en overlays.
- Bordes claros y líneas de registro hacen la mayor parte del trabajo estructural. El dorado aparece como borde superior, línea activa o punto de timeline, no como relleno dominante.
- Motion de estado entre 150 y 300 ms; los revelados editoriales usan una salida suave y se desactivan con `prefers-reduced-motion`.

## Lenguaje por superficie

### Público — Persuade

- Hero de alto impacto con imagen arquitectónica a sangre, degradado navy, titular serif, dos acciones y recorrido de tres pasos.
- Alternancia de bandas editoriales, listas con divisores y composiciones imagen/texto; se evita una retícula repetitiva de tarjetas.
- Las secciones de confianza y atención humana combinan materialidad arquitectónica con mensajes verificables, sin métricas ni testimonios inventados.
- Header sticky, navegación sobria y CTA azul; footer navy con arquitectura de información en columnas.

### Autenticación

- Composición dividida: imagen y promesa de confianza a la izquierda, tarea enfocada a la derecha.
- Un solo formulario protagonista, mensajes de error asociados y acciones de recuperación cercanas.
- En mobile se retira el panel visual para priorizar marca, campos y finalización rápida.

### Cliente — Operate con calidez

- Shell operativo con títulos editoriales, resúmenes de estado y módulos de ayuda ilustrados.
- Solicitudes como filas/listas escaneables; el detalle se organiza en descripción, conversación, SLA, adjuntos e historial.
- Formularios largos combinan panel principal y ayuda contextual; la confirmación de creación concentra código, estado y siguientes acciones.
- FAQ y asistente conservan el lenguaje del sistema mediante búsqueda, categorías, conversación y advertencias de confianza.

### Asesor y supervisor — Operate de alta densidad

- Navegación persistente por rol, encabezado contextual, notificaciones y perfil.
- Bandejas, colas y auditoría priorizan código, asunto, prioridad, estado y actualización con alineación estable.
- Resúmenes usan tres métricas con borde superior dorado; los módulos críticos emplean navy para destacar control y SLA.
- Filtros viven en una banda marfil; editores administrativos aparecen como panel lateral sobre overlay, sin sacar al usuario del contexto.

## Patrones de componentes

- **BrandMark:** icono circular dorado, nombre serif y descriptor sans en versales; admite variante inversa.
- **Button / ButtonLink:** altura mínima de 48 px; variantes primaria, secundaria, quiet y danger. Hover cambia color/sombra sin escalar ni desplazar el layout; loading mantiene `aria-busy`.
- **PageIntro:** eyebrow opcional, título/descripcion y acciones; es el arranque común de las vistas autenticadas.
- **StatusBadge / PriorityBadge:** píldoras compactas y semánticas. El texto siempre acompaña al color.
- **Campos y búsqueda:** fondo blanco, borde sobrio, radio pequeño y anillo de foco de 3 px. Errores se asocian al campo y no se comunican solo por color.
- **Paneles:** blanco sobre marfil, borde tenue y sombra baja. Los títulos internos usan Manrope para no competir con la jerarquía de página.
- **Listas y tablas:** divisores, encabezados en versales pequeñas y datos tabulares. En mobile, la tabla operativa se convierte en tarjetas semánticas; tablas administrativas complejas conservan scroll horizontal.
- **Timeline e historial:** línea fina y nodos dorados; fecha y detalle permanecen juntos.
- **StatePanel y Skeleton:** cubren vacío, error, éxito, prohibido y carga; cada estado remoto debe incluir recuperación o siguiente acción cuando aplique.
- **Popover y diálogo lateral:** superficies blancas elevadas, foco operativo y jerarquía contenida; los diálogos ocupan el alto del viewport.
- **Chat:** cabecera navy, conversación sobre marfil, mensajes con variantes bot/usuario y compositor persistente.
- **ResponsiveImage:** `<picture>` con variantes mobile, tablet y desktop; el hero carga de forma prioritaria y el resto de forma diferida.

## Comportamiento responsive

Los puntos de cambio implementados son 1100 px y 760 px; las imágenes seleccionan recursos a 639 px y 1099 px.

| Clase            | Comportamiento                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop, 1440 px | Sidebar de 272 px persistente, header de 76 px, contenido hasta 1480 px, tablas completas y composiciones de dos columnas.                                                                                          |
| Tablet, 1024 px  | Sidebar pasa a drawer; paneles de detalle, formularios y reportes se apilan; métricas pueden permanecer en dos columnas; tablas operativas admiten desplazamiento.                                                  |
| Mobile, 390 px   | Header compacto, drawer lateral y navegación inferior fija de cinco destinos; filtros y formularios pasan a una columna; las tablas operativas se vuelven tarjetas; se reserva padding inferior para la navegación. |

Reglas importantes:

- El menú público se convierte en panel desplegable bajo el header.
- El hero cambia de degradado horizontal a vertical y apila acciones y pasos.
- Las composiciones imagen/texto se apilan sin perder el orden narrativo.
- El sidebar autenticado se oculta fuera de lienzo y vuelve como drawer; el contexto textual del header se oculta en mobile.
- La navegación inferior muestra como máximo los primeros cinco destinos del rol. Para supervisor, Reportes y Auditoría permanecen en el drawer; cualquier cambio de orden debe revisar esta consecuencia.
- El contenido debe conservar objetivos táctiles de al menos 44 px, foco visible, ausencia de scroll horizontal accidental y ninguna acción detrás de la barra inferior.

## Activos y evidencia generada

Hay cinco imágenes fuente en `src/assets/images/source`, cada una con variantes WebP desktop, tablet y mobile en `src/assets/images/web`:

| Activo                 | Uso                                                          |
| ---------------------- | ------------------------------------------------------------ |
| `landing-hero`         | Atrio contemporáneo del primer viewport público.             |
| `security-threshold`   | Seguridad y confianza mediante vidrio, metal y línea dorada. |
| `human-support`        | Atención humana en un entorno reservado.                     |
| `service-architecture` | Recorrido continuo representado como arquitectura abstracta. |
| `guided-empty-state`   | Estados vacíos y entrada guiada al asistente.                |

El manifiesto de capturas registra 96 resultados: 32 rutas en desktop 1440, tablet 1024 y mobile 390, sin entradas fallidas. Estas capturas son la línea base visual de la entrega, no un sustituto de probar estados interactivos, contenido extremo o accesibilidad.

## Checklist de mantenimiento

- [ ] Mantener `PRODUCT.md`, contratos reales y permisos por rol como límites de contenido; no inventar métricas, testimonios, estados ni operaciones.
- [ ] Añadir o modificar colores, espacio, radios, sombras o motion primero en `src/styles/tokens.css`; consumir variables semánticas en componentes.
- [ ] Conservar Cormorant Garamond para jerarquía editorial y Manrope para operación; no reintroducir IBM Plex desde el `MASTER.md` antiguo.
- [ ] Reservar navy para estructura, azul para interacción y dorado para énfasis escaso; verificar contraste WCAG AA.
- [ ] Reutilizar `Button`, `PageIntro`, badges, `StatePanel`, `Skeleton`, `BrandMark` y `ResponsiveImage` antes de crear variantes paralelas.
- [ ] Cubrir loading, success, empty, error, retry, disabled y permisos en cada nueva consulta o mutación.
- [ ] Mantener etiquetas, mensajes asociados, navegación por teclado, foco visible, regiones `aria-live` cuando corresponda y objetivos táctiles de 44 px.
- [ ] Respetar `prefers-reduced-motion`; evitar hovers con escala o desplazamiento de layout.
- [ ] Verificar 1440, 1024 y 390 px, incluyendo drawer, barra inferior, popovers, diálogos, filtros, tablas y contenido largo.
- [ ] Revisar explícitamente qué cinco destinos aparecen en la barra inferior de cada rol.
- [ ] Para cada imagen nueva, conservar fuente, texto alternativo útil y tres recortes WebP; actualizar `docs/image-manifest.md`.
- [ ] Regenerar la matriz de capturas tras cambios visuales y comprobar diferencias de las 32 rutas en los tres viewports.
- [ ] Ejecutar typecheck, lint, pruebas unitarias, build y Playwright antes de cerrar una modificación transversal de UI.
- [ ] Si se actualizan artefactos del sistema de diseño, sincronizarlos con la implementación actual y resolver de forma explícita cualquier divergencia de tokens.

## Criterio de aceptación visual

Una nueva pantalla pertenece a este sistema cuando puede leerse como parte del mismo expediente: jerarquía editorial clara, acción principal inequívoca, estados trazables, densidad proporcional al rol, detalles premium contenidos y una adaptación mobile deliberada. Si solo reproduce tarjetas genéricas, usa dorado como adorno, oculta el contexto del caso o depende del desktop para ser comprensible, todavía no está terminada.

## Cierre de auditoría independiente

La revisión final detectó tres riesgos de liberación y todos quedaron corregidos antes de la entrega:

- Los activos responsive ahora entran al grafo de Vite mediante `import.meta.glob`; el build contiene las 15 variantes WebP con hash y la vista previa de producción las carga sin respuestas fallidas.
- Dashboard, solicitudes, colas operativas, asignaciones y auditoría usan los totales reales del backend y exponen navegación paginada cuando hay más de una página.
- El drawer móvil y los diálogos transfieren, atrapan y restauran el foco; admiten cierre con `Escape` y conservan semántica accesible.

Tras las correcciones, Impeccable no reportó anti-patrones en código ni en la URL, la suite Playwright cerró con 19 pruebas aprobadas y una omisión deliberada, y las 96 capturas se regeneraron sin fallos registrados.
