# Rutas y roles

## Públicas

`/`, `/como-funciona`, `/preguntas-frecuentes`, `/nosotros`, `/ayuda`, `/privacidad`, `/terminos`, `/ingresar`, `/registro`, `/recuperar-acceso`, `/restablecer-acceso`, `/verificar-cuenta`.

## Cliente

| Ruta                          | Propósito                           |
| ----------------------------- | ----------------------------------- |
| `/app/inicio`                 | resumen y actividad reciente        |
| `/app/solicitudes`            | búsqueda y filtros                  |
| `/app/nueva-solicitud`        | alta validada                       |
| `/app/solicitudes/:id`        | detalle, conversación y adjuntos    |
| `/app/solicitudes/:id/creada` | confirmación y tracking             |
| `/app/faq`                    | conocimiento publicado              |
| `/app/asistente`              | conversación, feedback y conversión |
| `/app/perfil`                 | datos, preferencias y contraseña    |

## Asesor

`/asesor/panel`, `/asesor/bandeja`, `/asesor/conocimiento`, `/asesor/tickets/:id`, `/asesor/perfil`.

## Supervisor

`/supervisor/operacion`, `/supervisor/cola`, `/supervisor/asignaciones`, `/supervisor/contenido`, `/supervisor/sla`, `/supervisor/reportes`, `/supervisor/auditoria`, `/supervisor/tickets/:id`, `/supervisor/perfil`.

Las rutas incompatibles redirigen a `/sin-acceso`; las inexistentes terminan en la vista 404.
