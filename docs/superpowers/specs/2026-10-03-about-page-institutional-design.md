# Diseño institucional premium para `/nosotros`

## Objetivo

Transformar exclusivamente la ruta pública `/nosotros` en una experiencia institucional editorial que comunique trayectoria, presencia en Perú, atención personalizada y respaldo de Banco GNB Sudameris. La implementación conservará el header, footer, sistema de tokens, tipografías y arquitectura actuales, sin modificar el backend ni el comportamiento de otras rutas.

## Fuente factual

Todo el contenido institucional se limitará a la información vigente de la página oficial de Banco GNB Perú:

- Banco GNB Perú forma parte del grupo Banco GNB Sudameris S.A.
- Inició operaciones en Perú en octubre de 2013.
- Cuenta con 10 agencias a nivel nacional: 6 en Lima y 4 en provincias.
- Cuenta con más de 500 colaboradores.
- Banco GNB Sudameris tiene más de 100 años de trayectoria en el mercado financiero colombiano.
- El grupo tiene presencia en Perú y Latinoamérica.
- Atiende los segmentos de Banca Personal y Banca Empresarial.
- Su propuesta se basa en una atención personalizada y calificada.
- El cierre institucional puede utilizar “Juntos llegamos más lejos”.

Fuente: <https://www.bancognb.com.pe/inicio/banco-gnb-peru/quienes-somos>

No se incorporarán cifras, productos, premios, certificaciones, directivos, ubicaciones de agencias, afirmaciones de liderazgo, misión ni visión que no estén confirmados por esa fuente.

## Dirección visual

La página tendrá una narrativa editorial continua, no una cuadrícula de tarjetas. La composición combinará navy profundo, azul institucional, dorado sobrio, blanco cálido y superficies marfil. Cormorant Garamond se reservará para titulares y cifras expresivas; Manrope se usará en contenido funcional.

Los estilos nuevos quedarán aislados bajo el prefijo `about-*`. No se cambiarán selectores globales compartidos salvo una necesidad estrictamente accesible y comprobada.

## Arquitectura de contenido

### 1. Hero institucional

- Etiqueta “Banco GNB Perú”.
- H1 “Una historia de confianza que sigue avanzando”.
- Introducción breve sobre trayectoria, cercanía y atención clara.
- Imagen `landing-hero` reutilizada como pieza arquitectónica principal.
- CTA primario “Crear una solicitud” hacia `/registro`.
- CTA secundario “Ir a preguntas frecuentes” hacia `/preguntas-frecuentes`.
- El texto permanecerá fuera de la imagen o sobre una superficie con contraste AA; no se saturará la fotografía con contenido.

### 2. Quiénes somos

Composición en dos columnas que explique la relación con Banco GNB Sudameris, el inicio de operaciones en octubre de 2013, la presencia en Perú y Latinoamérica y la propuesta de atención personalizada y calificada. En mobile se convertirá en una sola columna siguiendo el orden de lectura natural.

### 3. Trayectoria y presencia

Secuencia editorial con una línea continua, divisores finos y cifras de gran escala:

- Más de 100 años — trayectoria del grupo en Colombia.
- Desde 2013 — operaciones en Perú.
- 10 agencias — presencia nacional.
- Más de 500 — colaboradores.

Las cifras formarán una narrativa temporal y territorial; no serán tarjetas independientes.

### 4. Presencia nacional

Composición tipográfica y abstracta, sin mapa con ubicaciones inventadas:

- 6 agencias en Lima.
- 4 agencias en provincias.
- Atención para personas y empresas.

La sección utilizará `service-architecture` como metáfora visual de una red conectada y continua.

### 5. Banca Personal y Banca Empresarial

Díptico editorial con dos imágenes originales:

- **Banca Personal:** asesoría humana en un entorno financiero contemporáneo, premium y reservado.
- **Banca Empresarial:** colaboración entre profesionales en un espacio corporativo luminoso y sobrio.

El texto solo afirmará que Banco GNB ofrece productos y servicios para ambos segmentos. No se enumerará un catálogo de productos.

Las imágenes serán fotorealistas, sin logos, texto ni marcas de agua. Cada original se optimizará a WebP en variantes desktop (1920×1080), tablet (1280×1024) y mobile (780×1040), con textos alternativos descriptivos en español.

### 6. Atención humana y calificada

Se reutilizará `human-support` para conectar la propuesta institucional con el portal de atención digital: registro de solicitudes, seguimiento claro, conversación con asesores y conservación de la trazabilidad. No se presentarán capacidades que el portal no tenga.

### 7. Cierre institucional

Bloque navy de alto contraste con el titular “Juntos llegamos más lejos”, un texto breve sobre confianza y acompañamiento, y dos CTA:

- “Crear una solicitud” → `/registro`.
- “Preguntas frecuentes” → `/preguntas-frecuentes`.

## Imágenes

Se reutilizarán sin alterar sus archivos:

- `landing-hero` en el hero.
- `service-architecture` en presencia nacional.
- `human-support` en atención humana.

Se generarán dos nuevos originales y sus variantes responsive:

- `personal-banking`.
- `business-banking`.

La generación no incluirá ni recreará el logo oficial de Banco GNB.

## Componentes y límites técnicos

- `AboutPage` dejará de usar `StandardPage` para permitir una composición de ancho completo dentro del layout público existente.
- Se reutilizarán `ResponsiveImage`, `Reveal` y `ButtonLink`.
- `ResponsiveImage` seguirá resolviendo las variantes desktop, tablet y mobile mediante el patrón actual.
- No se añadirán dependencias, endpoints ni estado remoto.
- La ruta `/nosotros` y la navegación existente permanecerán sin cambios.

## Motion

Las secciones usarán `Reveal` para una entrada progresiva y discreta. Los CTA e imágenes tendrán transiciones sutiles de color, borde o escala. Las reglas existentes de `prefers-reduced-motion` anularán desplazamientos y transiciones no esenciales; si el componente actual no cubre algún caso, la corrección quedará limitada a selectores `about-*`.

## Responsive

### Desktop — 1440 px

- Hero editorial de dos columnas con fotografía dominante.
- Secciones de texto e imagen alternadas.
- Secuencia de cifras en una línea horizontal o composición escalonada.

### Tablet — 1024 px

- Hero y bloques editoriales conservan dos columnas cuando el contenido mantiene legibilidad.
- Márgenes, tamaños de titulares y separaciones se reducen mediante `clamp()`.
- La secuencia de cifras puede dividirse en dos filas sin convertirse en tarjetas.

### Mobile — 390 px

- Todas las composiciones pasan a una columna.
- Las imágenes se recortan con variantes verticales y `object-fit: cover`.
- El H1 mantiene un tamaño legible sin palabras cortadas.
- CTA con área táctil mínima de 44 px y ancho completo cuando mejore el uso.
- No habrá scroll horizontal, contenido superpuesto ni secciones innecesariamente altas.

## Accesibilidad

- Un solo H1 y jerarquía H2/H3 secuencial.
- Uso de `section`, `article`, listas y elementos decorativos con `aria-hidden` cuando corresponda.
- Textos alternativos en español para todas las imágenes significativas.
- Contraste WCAG AA en texto y CTA.
- Foco visible heredado o reforzado exclusivamente en `about-*`.
- Los números incluirán contexto textual; el color nunca será el único portador de significado.
- Navegación completa mediante teclado.

## Pruebas y validación

Se añadirá una prueba E2E específica de `/nosotros` que verifique:

- H1 y secciones institucionales principales.
- Presencia de las cinco imágenes y ausencia de imágenes rotas.
- Navegación de “Crear una solicitud” a `/registro`.
- Navegación de FAQ a `/preguntas-frecuentes`.
- Ausencia de scroll horizontal.
- Ausencia de errores inesperados en consola.

La validación manual y automatizada se realizará en 1440×900, 1024×768 y 390×844. También se comprobará que Landing, FAQ, Login y una ruta autenticada continúen funcionando mediante las suites existentes.

Antes de finalizar se ejecutarán, en este orden:

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
```

Después se regenerarán únicamente las capturas responsive de `/nosotros` y se actualizará la documentación de pruebas o imágenes solo con resultados observados.
