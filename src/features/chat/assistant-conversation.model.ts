import type {
  BotMessageResponse,
  ChatbotUIOption,
  ChatbotTicketDraft,
  ChatbotTicketDraftField,
  TicketCreateInput,
} from "../../shared/api/endpoints";
import { ticketPriorityLabels } from "../../shared/ticket-labels";

export type ReadyTicketDraftPayload = Pick<
  TicketCreateInput,
  "category_id" | "subject" | "description"
> & { readonly priority: NonNullable<TicketCreateInput["priority"]> };

type TicketQuery = NonNullable<BotMessageResponse["ticket_query"]>;
type TicketCard = NonNullable<TicketQuery["ticket"]>;
type TicketPagination = NonNullable<TicketQuery["pagination"]>;
type AuthenticationAction = NonNullable<
  TicketQuery["authentication_actions"]
>[number];

export type AssistantTicketQueryPresentation =
  | {
      readonly kind: "authentication";
      readonly authenticationActions: readonly AuthenticationAction[];
    }
  | { readonly kind: "clarify-ticket-code" }
  | {
      readonly kind: "tickets";
      readonly queryType: "TICKET_LIST" | "CLIENT_ACTION_REQUIRED";
      readonly tickets: readonly TicketCard[];
      readonly total: number | null;
      readonly pagination: TicketPagination | null;
    }
  | { readonly kind: "count"; readonly total: number | null }
  | {
      readonly kind: "ticket";
      readonly queryType: "TICKET_STATUS" | "LATEST_TICKET";
      readonly ticket: TicketCard;
    }
  | {
      readonly kind: "advisor-status";
      readonly advisorResponded: boolean;
      readonly ticket: TicketCard | null;
    }
  | {
      readonly kind: "advisor-reply";
      readonly advisorResponded: boolean | null;
      readonly latestAdvisorResponse: NonNullable<
        TicketQuery["latest_advisor_response"]
      > | null;
      readonly ticket: TicketCard | null;
    };

export interface AssistantReplyPresentation {
  readonly needsClarification: boolean;
  readonly canRequestFollowup: boolean;
  readonly showTicketOffer: boolean;
}

export type AssistantResponseStatus = "ai" | "fallback" | null;

export type AssistantRequestContext = "conversation" | "ticket";

export type AssistantClarificationChoice =
  | { readonly kind: "structured"; readonly option: ChatbotUIOption }
  | { readonly kind: "text"; readonly label: string };

function normalizeClarificationLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es-PE")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function getAssistantClarificationChoices(
  structuredOptions: readonly ChatbotUIOption[],
  clarificationOptions: readonly string[] = [],
): readonly AssistantClarificationChoice[] {
  const choices: AssistantClarificationChoice[] = [];
  const seenLabels = new Set<string>();

  for (const option of structuredOptions) {
    const normalizedLabel = normalizeClarificationLabel(option.label);
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) continue;
    seenLabels.add(normalizedLabel);
    choices.push({ kind: "structured", option });
  }

  for (const label of clarificationOptions) {
    const trimmedLabel = label.trim();
    const normalizedLabel = normalizeClarificationLabel(trimmedLabel);
    if (!normalizedLabel || seenLabels.has(normalizedLabel)) continue;
    seenLabels.add(normalizedLabel);
    choices.push({ kind: "text", label: trimmedLabel });
  }

  return choices;
}

const assistantCategoryLabels: Record<string, string> = {
  TARJETAS: "tarjetas",
  CUENTAS: "cuentas",
  BANCA_DIGITAL: "banca digital",
  CREDITOS: "créditos",
  RECLAMOS_SIMPLES: "reclamos",
};

const assistantCategoryTokenPattern =
  /\b(?:TARJETAS|CUENTAS|BANCA_DIGITAL|CREDITOS|RECLAMOS_SIMPLES)(?:\s*,\s*(?:TARJETAS|CUENTAS|BANCA_DIGITAL|CREDITOS|RECLAMOS_SIMPLES))*\b/giu;

/** Presents database category keys as conversational Spanish labels. */
export function formatAssistantMessage(content: string): string {
  return content
    .replace(assistantCategoryTokenPattern, (list) => {
      const labels = list
        .split(/\s*,\s*/u)
        .map((token) => assistantCategoryLabels[token.toLocaleUpperCase("es-PE")]);
      if (labels.length < 2) return labels[0] ?? list;
      return `${labels.slice(0, -1).join(", ")} y ${labels.at(-1)}`;
    })
    .replace(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/gu, (token) =>
      token
        .split("_")
        .map((word) => word.toLocaleLowerCase("es-PE"))
        .join(" "),
    );
}

const ticketDraftFieldLabels: Record<ChatbotTicketDraftField, string> = {
  CATEGORY_ID: "Categoría",
  SUBJECT: "Asunto",
  DESCRIPTION: "Descripción",
  PRIORITY: "Prioridad",
};

export function getTicketDraftFieldLabel(
  field: ChatbotTicketDraftField,
): string {
  return ticketDraftFieldLabels[field];
}

export function getTicketDraftPayload(
  draft: ChatbotTicketDraft | null | undefined,
): ReadyTicketDraftPayload | null {
  if (draft?.status !== "READY_FOR_CONFIRMATION") return null;

  const fields = draft.fields;
  if (
    !fields?.category_id ||
    !fields.subject?.trim() ||
    !fields.description?.trim() ||
    !fields.priority ||
    draft.missing_fields?.length ||
    draft.validation_errors?.length
  ) {
    return null;
  }

  return {
    category_id: fields.category_id,
    subject: fields.subject,
    description: fields.description,
    priority: fields.priority,
  };
}

export function ticketDraftCorrectionMessage(
  values: ReadyTicketDraftPayload,
  categoryName: string,
): string {
  return [
    "Quiero corregir los datos del borrador de ticket:",
    `Categoría: ${categoryName} (${values.category_id})`,
    `Asunto: ${values.subject}`,
    `Descripción: ${values.description}`,
    `Prioridad: ${ticketPriorityLabels[values.priority]}`,
  ].join("\n");
}

export function getAssistantRequestErrorMessage(
  status: number,
  context: AssistantRequestContext,
  backendMessage?: string,
  authenticated = true,
): string {
  if (status === 0) {
    return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.";
  }
  if (status === 401) {
    return authenticated
      ? "Tu sesión venció. Inicia sesión de nuevo para continuar."
      : "El asistente no pudo atender esta consulta. Inténtalo nuevamente.";
  }
  if (status === 403) {
    return "No tienes permisos para completar esta operación.";
  }
  if (status === 404) {
    return context === "ticket"
      ? "No encontramos esta conversación. Conservamos el formulario para que revises los datos."
      : "No encontramos esta conversación. Puedes reiniciarla e intentarlo nuevamente.";
  }
  if (status === 409) {
    return context === "ticket"
      ? "La solicitud ya está registrada. Revisa su detalle antes de volver a intentarlo."
      : "No pudimos procesar el mensaje con el estado actual de la conversación. Inténtalo nuevamente.";
  }
  if (status === 429) {
    return "Llegaste al límite de solicitudes. Espera un momento e inténtalo nuevamente.";
  }
  if (status === 422) {
    return (
      backendMessage ||
      "Hay datos que necesitan corrección. Revisa el borrador e inténtalo nuevamente."
    );
  }
  if (status >= 500) {
    return context === "ticket"
      ? backendMessage ||
          "El servicio no pudo confirmar la creación. Tu borrador sigue disponible para volver a intentarlo."
      : backendMessage ||
          "El servicio presenta una demora. Tu conversación sigue disponible para volver a intentarlo.";
  }
  return (
    backendMessage ||
    (context === "ticket"
      ? "No pudimos crear la solicitud. Revisa el formulario e inténtalo nuevamente."
      : "No pudimos completar la consulta. Inténtalo nuevamente.")
  );
}

export function getAssistantReplyPresentation(
  reply: BotMessageResponse,
  conversationStatus: string,
): AssistantReplyPresentation {
  const action = reply.suggested_action;
  const status = (conversationStatus || reply.conversation_status).toUpperCase();
  const isActive = status === "ACTIVE";
  const needsClarification =
    action === "ASK_CLARIFICATION" || reply.requires_clarification;

  return {
    needsClarification,
    canRequestFollowup: action === "CONTACT_ADVISOR" && isActive,
    showTicketOffer: action === "CONVERT_TO_TICKET" && isActive,
  };
}

export function getAssistantResponseStatus(reply: {
  readonly response_source?: BotMessageResponse["response_source"] | null;
  readonly fallback_reason?: BotMessageResponse["fallback_reason"];
}): AssistantResponseStatus {
  if (reply.fallback_reason || reply.response_source === "FALLBACK") {
    return "fallback";
  }
  return reply.response_source === "AI" ? "ai" : null;
}

export function getSafeAssistantSourceUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["bancognb.com.pe", "www.bancognb.com.pe"].includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export function getAssistantTicketQueryPresentation(
  reply: BotMessageResponse,
): AssistantTicketQueryPresentation | null {
  const query = reply.ticket_query;
  if (!query) return null;

  const action = reply.suggested_action;
  switch (action) {
    case "AUTHENTICATION_REQUIRED":
      return query.query_type === "AUTHENTICATION_REQUIRED" &&
        query.authentication_required
        ? {
            kind: "authentication",
            authenticationActions: query.authentication_actions ?? [],
          }
        : null;
    case "LIST_MY_TICKETS":
      if (query.query_type === "TICKET_LIST") {
        return {
          kind: "tickets",
          queryType: "TICKET_LIST",
          tickets: query.tickets ?? [],
          total: query.total ?? null,
          pagination: query.pagination ?? null,
        };
      }
      if (query.query_type === "LATEST_TICKET") {
        return query.found === false || !query.ticket
          ? null
          : { kind: "ticket", queryType: "LATEST_TICKET", ticket: query.ticket };
      }
      return null;
    case "COUNT_MY_TICKETS":
      return query.query_type === "TICKET_COUNT"
        ? { kind: "count", total: query.total ?? null }
        : null;
    case "TICKET_STATUS":
      return query.query_type === "TICKET_STATUS" ||
        query.query_type === "LATEST_TICKET"
        ? query.found === false || !query.ticket
          ? null
          : { kind: "ticket", queryType: query.query_type, ticket: query.ticket }
        : null;
    case "ADVISOR_RESPONSE_STATUS":
      return query.query_type === "ADVISOR_RESPONSE_STATUS" &&
        query.found !== false &&
        typeof query.advisor_responded === "boolean"
        ? {
            kind: "advisor-status",
            advisorResponded: query.advisor_responded,
            ticket: query.ticket ?? null,
          }
        : null;
    case "LATEST_ADVISOR_RESPONSE":
      return query.query_type === "ADVISOR_REPLY" && query.found !== false
        ? {
            kind: "advisor-reply",
            advisorResponded: query.advisor_responded ?? null,
            latestAdvisorResponse: query.latest_advisor_response ?? null,
            ticket: query.ticket ?? null,
          }
        : null;
    case "CLIENT_ACTION_REQUIRED":
      return query.query_type === "CLIENT_ACTION_REQUIRED"
        ? {
            kind: "tickets",
            queryType: "CLIENT_ACTION_REQUIRED",
            tickets: query.tickets ?? [],
            total: query.total ?? null,
            pagination: query.pagination ?? null,
          }
        : null;
    case "CLARIFY_TICKET_CODE":
      return query.query_type === "CLARIFY_TICKET_CODE"
        ? { kind: "clarify-ticket-code" }
        : null;
    default:
      return null;
  }
}
