# Banco GNB Atención Digital — Diseño del producto

## Alcance validado

El encargo define una implementación completa, no una exploración abierta. Se construirá un frontend React desde cero contra el OpenAPI activo, con tres experiencias autenticadas y una landing pública editorial. La instrucción de continuar sin aprobaciones intermedias se toma como aprobación del brief y de sus restricciones.

## Dirección de experiencia

La landing opera en modo **Persuade**: explica el servicio, demuestra el recorrido y conduce a iniciar sesión o crear una solicitud. Las zonas autenticadas operan en modo **Operate**: priorizan escaneo, estados, acciones, permisos y recuperación ante errores.

La metáfora rectora es un **libro mayor de confianza digital**: columnas editoriales amplias, líneas finas de registro, marcas de estado nítidas y superficies claras sobre una base navy. El dorado se reserva para foco narrativo y acciones institucionales; el azul de acción identifica interacción y navegación.

## Primer viewport

El primer viewport de la landing combina un titular editorial con una imagen arquitectónica financiera original. Debe comunicar en segundos qué es el portal, qué resuelve y cómo empezar. Un panel de progreso sintetiza el mecanismo real —crear, seguir, resolver— sin inventar métricas.

## Arquitectura

- `app`: proveedores globales, router y bootstrap.
- `routes` y `layouts`: rutas públicas, autenticadas y shells por rol.
- `features`: verticales de autenticación, tickets, conocimiento, chatbot, notificaciones, SLA, reportes y auditoría.
- `shared`: cliente HTTP, contratos, componentes base, utilidades, hooks y estilos.
- `pages`: composición de cada ruta; sin lógica HTTP embebida.

El cliente HTTP añade `Authorization: Bearer`, genera `X-Request-ID`, captura el correlativo de respuesta y normaliza el contrato `{ code, message, details, request_id }`. Un 401 limpia sesión y dirige a Login con contexto; los demás estados se convierten en mensajes accionables y preservan el correlativo.

## Sistema visual

Tokens en tres capas: primitivos, semánticos y de componente. Escala espacial de 4/8 px, radios sobrios, sombras contenidas y tipografía con serif editorial para titulares y sans humanista para lectura y operación. Se alternan hero, bandas editoriales, tablas, listas, timeline, paneles y módulos de ayuda; se evita una cuadrícula uniforme de tarjetas.

## Interacción y responsive

Motion se limita a 150–300 ms, con transiciones de página, revelado de secciones, menús, feedback y skeletons. En reduced motion se elimina el desplazamiento y se mantiene el feedback por opacidad/estado.

- 1440 px: shell completo, sidebar persistente y tablas amplias.
- 1024 px: navegación compacta, paneles reordenados y filtros colapsables.
- 390 px: navegación inferior por rol, acciones primarias fijas cuando corresponde, tablas convertidas en listas semánticas y formularios en una columna.

## Estados y errores

Cada consulta remota expone loading/skeleton, success, empty, error y retry. Autorización y sesión tienen pantallas dedicadas. Los conflictos muestran una acción para recargar datos; 413/415 explican límites de adjuntos; 422 vincula errores a campos; 429 ofrece espera; 500/503 permiten reintento y muestran el identificador de solicitud.

## Estrategia de pruebas

Se aplica TDD a cliente HTTP, sesión, guards, validaciones, mapeos de estado y flujos críticos. React Testing Library cubre comportamiento accesible; MSW simula exactamente contratos existentes. Playwright ejecuta recorridos por rol contra respuestas contractuales controladas y valida 1440, 1024 y 390 px. La integración real se verifica con health/OpenAPI y, cuando las credenciales locales lo permiten, con los usuarios de desarrollo documentados por el backend.

## Integridad

No se agregan endpoints ni respuestas ocultas. Toda función visual sin respaldo se documenta como brecha y se representa como no disponible, nunca como operación exitosa. No se escriben ni registran secretos.
