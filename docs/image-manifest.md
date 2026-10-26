# Manifiesto de imágenes

Todas las imágenes fueron generadas con la herramienta integrada de creación de imágenes y se almacenan en `src/assets/images/source`. `npm run assets:build` produce WebP optimizados en `src/assets/images/web`.

| Recurso                | Propósito                | Texto alternativo                                                     | Desktop   | Tablet    | Mobile   |
| ---------------------- | ------------------------ | --------------------------------------------------------------------- | --------- | --------- | -------- |
| `landing-hero`         | Hero público             | Atrio contemporáneo en tonos navy, piedra clara y latón               | 1920×1080 | 1280×1024 | 780×1040 |
| `security-threshold`   | Seguridad y confianza    | Umbral de vidrio y metal con una línea dorada de precisión            | 1920×1080 | 1280×1024 | 780×1040 |
| `human-support`        | Atención humana          | Asesor orientando a una persona en un espacio de atención reservado   | 1920×1080 | 1280×1024 | 780×1040 |
| `service-architecture` | Recorrido del servicio   | Arquitectura abstracta con una ruta azul continua entre etapas        | 1920×1080 | 1280×1024 | 780×1040 |
| `guided-empty-state`   | Estados vacíos y chatbot | Escultura circular clara con un marcador azul al inicio del recorrido | 1920×1080 | 1280×1024 | 780×1040 |
| `personal-banking`     | Banca Personal           | Asesora conversando con un cliente en un espacio de atención cercano  | 1920×1080 | 1280×1024 | 780×1040 |
| `business-banking`     | Banca Empresarial        | Equipo empresarial reunido alrededor de una mesa de trabajo           | 1920×1080 | 1280×1024 | 780×1040 |

Los recortes se consumen mediante `picture` y `media` para evitar descargar una variante mayor que la necesaria.
