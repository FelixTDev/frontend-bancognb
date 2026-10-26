# Matriz de endpoints, pantallas y roles

> Generada desde `http://localhost:8000/openapi.json`. El backend conserva la autoridad final de permisos; la columna de rol documenta la superficie del frontend.

| Método | Endpoint                                                         | Pantalla/flujo                                       | Rol de interfaz                             | Estado      |
| ------ | ---------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- | ----------- |
| DELETE | `/api/v1/attachments/{attachment_id}`                            | Detalle de solicitud                                 | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/attachments/{attachment_id}/download`                   | Detalle de solicitud                                 | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/audit`                                                  | /supervisor/auditoria                                | Supervisor                                  | Integrado   |
| POST   | `/api/v1/auth/change-password`                                   | /app/perfil                                          | Cliente, Asesor, Supervisor                 | Integrado   |
| POST   | `/api/v1/auth/forgot-password`                                   | /recuperar-acceso · /restablecer-acceso              | Público                                     | Integrado   |
| POST   | `/api/v1/auth/login`                                             | /ingresar                                            | Público                                     | Integrado   |
| POST   | `/api/v1/auth/logout`                                            | Shell autenticado                                    | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/auth/me`                                                | Shell autenticado                                    | Cliente, Asesor, Supervisor                 | Integrado   |
| POST   | `/api/v1/auth/register`                                          | /registro · /verificar-cuenta                        | Público                                     | Integrado   |
| POST   | `/api/v1/auth/reset-password`                                    | /recuperar-acceso · /restablecer-acceso              | Público                                     | Integrado   |
| POST   | `/api/v1/auth/verify-email`                                      | /registro · /verificar-cuenta                        | Público                                     | Integrado   |
| GET    | `/api/v1/categories`                                             | Alta de solicitud · FAQ · contenido                  | Público, Cliente, Supervisor                | Integrado   |
| POST   | `/api/v1/categories`                                             | /supervisor/contenido                                | Supervisor                                  | Integrado   |
| PATCH  | `/api/v1/categories/{category_id}`                               | /supervisor/contenido                                | Supervisor                                  | Integrado   |
| PATCH  | `/api/v1/categories/{category_id}/status`                        | /supervisor/contenido                                | Supervisor                                  | Integrado   |
| POST   | `/api/v1/chat/conversations`                                     | Widget de Landing · /app/asistente                   | Público, Cliente                            | Integrado   |
| GET    | `/api/v1/chat/conversations/{conversation_id}`                   | Widget de Landing · /app/asistente                   | Público, Cliente                            | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/convert-to-ticket` | /app/asistente                                       | Cliente                                     | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/escalate`          | Widget de Landing · /app/asistente                   | Público, Cliente                            | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/feedback`          | Widget de Landing · /app/asistente                   | Público, Cliente                            | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/link-user`         | Vinculación al entrar en /app/asistente              | Cliente                                     | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/messages`          | Widget de Landing · /app/asistente                   | Público, Cliente                            | Integrado   |
| POST   | `/api/v1/chat/conversations/{conversation_id}/reset`             | Operación disponible en contrato; el botón Reiniciar crea otra conversación | Público, Cliente              | No consumido por el reinicio de Fase 1 |
| GET    | `/api/v1/faqs`                                                   | FAQ pública · FAQ cliente · conocimiento · contenido | Público, Cliente, Asesor, Supervisor        | Integrado   |
| POST   | `/api/v1/faqs`                                                   | FAQ cliente · /supervisor/contenido                  | Supervisor                                  | Integrado   |
| GET    | `/api/v1/faqs/{faq_id}`                                          | FAQ pública · FAQ cliente · conocimiento · contenido | Público, Cliente, Asesor, Supervisor        | Integrado   |
| PATCH  | `/api/v1/faqs/{faq_id}`                                          | FAQ cliente · /supervisor/contenido                  | Supervisor                                  | Integrado   |
| POST   | `/api/v1/faqs/{faq_id}/feedback`                                 | FAQ cliente · /supervisor/contenido                  | Cliente                                     | Integrado   |
| GET    | `/api/v1/faqs/{faq_id}/history`                                  | FAQ pública · FAQ cliente · conocimiento · contenido | Público, Cliente, Asesor, Supervisor        | Integrado   |
| PATCH  | `/api/v1/faqs/{faq_id}/status`                                   | FAQ cliente · /supervisor/contenido                  | Supervisor                                  | Integrado   |
| PATCH  | `/api/v1/faqs/{faq_id}/workflow`                                 | FAQ cliente · /supervisor/contenido                  | Supervisor                                  | Integrado   |
| GET    | `/api/v1/faqs/admin`                                             | /supervisor/contenido                                | Supervisor                                  | Integrado   |
| GET    | `/api/v1/faqs/admin/metrics/utility`                             | /supervisor/contenido                                | Supervisor                                  | Integrado   |
| GET    | `/api/v1/health`                                                 | Diagnóstico de despliegue                            | Operación técnica                           | Diagnóstico |
| GET    | `/api/v1/health/ready`                                           | Diagnóstico de despliegue                            | Operación técnica                           | Diagnóstico |
| GET    | `/api/v1/notifications`                                          | Cabecera del portal                                  | Cliente, Asesor, Supervisor                 | Integrado   |
| PATCH  | `/api/v1/notifications/{notification_id}/read`                   | Cabecera del portal                                  | Cliente, Asesor, Supervisor                 | Integrado   |
| POST   | `/api/v1/notifications/read-all`                                 | Cabecera del portal                                  | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/notifications/unread-count`                             | Cabecera del portal                                  | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/reports/{report_name}/export`                           | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| GET    | `/api/v1/reports/by-category`                                    | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| GET    | `/api/v1/reports/by-priority`                                    | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| GET    | `/api/v1/reports/by-status`                                      | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| GET    | `/api/v1/reports/resolution-time`                                | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| GET    | `/api/v1/reports/summary`                                        | /supervisor/reportes · operación                     | Supervisor                                  | Integrado   |
| POST   | `/api/v1/sla/evaluate`                                           | /supervisor/sla                                      | Supervisor                                  | Integrado   |
| GET    | `/api/v1/sla/policies`                                           | /supervisor/sla                                      | Supervisor                                  | Integrado   |
| POST   | `/api/v1/sla/policies`                                           | /supervisor/sla                                      | Supervisor                                  | Integrado   |
| PATCH  | `/api/v1/sla/policies/{policy_id}`                               | /supervisor/sla                                      | Supervisor                                  | Integrado   |
| GET    | `/api/v1/tickets`                                                | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets`                                                | /app/nueva-solicitud                                 | Cliente                                     | Integrado   |
| GET    | `/api/v1/tickets/{ticket_id}`                                    | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/assignments`                        | Asignaciones · detalle                               | Supervisor                                  | Integrado   |
| GET    | `/api/v1/tickets/{ticket_id}/attachments`                        | Detalle de solicitud                                 | Cliente, Asesor, Supervisor                 | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/attachments`                        | Detalle de solicitud                                 | Cliente, Asesor, Supervisor                 | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/cancel`                             | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/close`                              | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| GET    | `/api/v1/tickets/{ticket_id}/comments`                           | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/comments`                           | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| GET    | `/api/v1/tickets/{ticket_id}/history`                            | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/release`                            | Detalle de ticket                                    | Asesor                                      | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/reopen`                             | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| GET    | `/api/v1/tickets/{ticket_id}/sla`                                | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/sla/pause`                          | Detalle de ticket                                    | Supervisor                                  | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/sla/resume`                         | Detalle de ticket                                    | Supervisor                                  | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/status`                             | Listado · detalle de ticket                          | Cliente, Asesor, Supervisor según operación | Integrado   |
| POST   | `/api/v1/tickets/{ticket_id}/take`                               | Detalle de ticket                                    | Asesor                                      | Integrado   |
| GET    | `/api/v1/tickets/mine`                                           | Inicio · solicitudes cliente                         | Cliente                                     | Integrado   |
| GET    | `/api/v1/tickets/operations`                                     | Panel y cola operativa                               | Asesor, Supervisor                          | Integrado   |
| GET    | `/api/v1/users/advisors`                                         | /supervisor/asignaciones · detalle                   | Supervisor                                  | Integrado   |
| GET    | `/api/v1/users/me/preferences`                                   | /app/perfil                                          | Cliente, Asesor, Supervisor                 | Integrado   |
| PATCH  | `/api/v1/users/me/preferences`                                   | /app/perfil                                          | Cliente, Asesor, Supervisor                 | Integrado   |
| GET    | `/api/v1/users/me/profile`                                       | /app/perfil                                          | Cliente, Asesor, Supervisor                 | Integrado   |
| PATCH  | `/api/v1/users/me/profile`                                       | /app/perfil                                          | Cliente, Asesor, Supervisor                 | Integrado   |

Total: 74 operaciones documentadas.
