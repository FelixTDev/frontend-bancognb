# Inventario de QA

## Claims visibles a validar

- La portada comunica atención segura, trazable y humana con una estética bancaria premium.
- La interfaz se adapta sin desbordamiento horizontal a 1440, 1024 y 390 px.
- Cliente, asesor y supervisor llegan únicamente a sus rutas autorizadas.
- Las vistas consumen el backend real y representan carga, vacío, error y datos cuando corresponda.
- Formularios, filtros, navegación, sesión, notificaciones, comentarios, adjuntos y acciones operativas ofrecen feedback visible.

## Controles y estados

| Área       | Control/flujo                                                    | Estado esperado                          | Evidencia                  |
| ---------- | ---------------------------------------------------------------- | ---------------------------------------- | -------------------------- |
| Público    | navegación, menú móvil, FAQ                                      | ruta o expansión visible                 | captura escritorio y móvil |
| Auth       | ingreso válido e inválido                                        | error accesible o redirección por rol    | aserción E2E               |
| Cliente    | listado, filtros, alta, detalle                                  | datos del API, validación y confirmación | captura y aserción         |
| Cliente    | FAQ, asistente, perfil                                           | búsqueda, conversación, guardado         | captura y aserción         |
| Asesor     | panel, bandeja, ticket                                           | cola y acciones autorizadas              | captura y aserción         |
| Supervisor | operación, cola, asignación, contenido, SLA, reportes, auditoría | datos operativos y permisos              | captura y aserción         |
| Global     | notificaciones, cierre de sesión                                 | popover y retorno a ingreso              | aserción E2E               |

## Escenarios exploratorios

- Acceso directo a una ruta de supervisor usando sesión de cliente.
- Carga de una ruta inexistente y respuesta temporalmente fallida del API.
- Contenido denso en tabla operativa y navegación móvil a 390 px.
- Sesión persistida inválida o expirada al recargar.
