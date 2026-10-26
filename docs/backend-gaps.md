# Gaps y límites del backend

El frontend no modifica ni sustituye el backend. Durante la integración se observaron estos límites:

- No existe un endpoint específico de formulario de contacto; `/ayuda` orienta hacia los canales y flujos existentes.
- El proveedor de correo local puede estar configurado como `noop`; recuperación y verificación muestran el estado del flujo, pero la entrega real depende del proveedor del backend.
- El asistente puede operar con IA deshabilitada y respuestas basadas en conocimiento, según la configuración del servicio.
- No hay endpoint para subir avatar de usuario; el perfil utiliza iniciales.
- Salud y readiness son endpoints operativos, no pantallas de usuario.
- La respuesta de chat contiene `resolved`, `offers_ticket`, `requires_clarification`, `fallback_reason`, `conversation_status` y `response_source`; la conversación también expone `detected_intent` y `pending_question`. No hay un campo específico que indique si se debe ofrecer escalación humana (`offers_escalation`) ni una intención de saludo definida por el contrato. La interfaz no puede distinguir esos casos sin adivinar a partir del texto.

### Verificación local del chatbot — 2026-10-10

Se consultó `GET /openapi.json` en `http://localhost:8000` y se enviaron mensajes a `POST /api/v1/chat/conversations/{conversation_id}/messages` dentro de conversaciones locales nuevas. No se llamaron los endpoints de escalación ni conversión a ticket.

El backend local no cumple todavía el comportamiento esperado: `Hola`, `Hola, ¿cómo consulto el estado de mi solicitud?` y una consulta desconocida regresaron `resolved: false`, `offers_ticket: true`, `requires_clarification: false`, `fallback_reason: "LOW_CONFIDENCE"`, `response_source: "FALLBACK"` y `conversation_status: "ESCALATED"`. En el saludo, además, `bot_message.intent` llegó como `null`; el esquema admite una intención nullable como texto libre y no define un valor para saludos. Por ello el frontend no puede producir un saludo cordial ni una aclaración fiable para esas respuestas sin ignorar los campos de negocio que el backend devuelve o analizar el texto de la respuesta. Al respetar `offers_ticket: true`, la interfaz sí presenta la oferta de ticket que el backend envió, incluso para ese saludo. La interfaz usa `requires_clarification` para pedir aclaración, `offers_ticket` para mostrar conversión y estado activo/no fallback para habilitar el seguimiento explícito. Se requiere corregir el comportamiento del backend y, para controlar por separado la oferta de escalación, ampliar el contrato con una señal específica.

La matriz completa de operaciones disponibles está en `docs/endpoint-matrix.md`.
