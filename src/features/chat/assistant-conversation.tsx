import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Landmark,
  Link2,
  List,
  LogOut,
  MessageCircleMore,
  RefreshCw,
  RotateCcw,
  Send,
  Smartphone,
  ThumbsDown,
  ThumbsUp,
  UserRound,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  api,
  type BotMessageResponse,
  type ChatbotConvertedTicketSummary,
  type ChatbotUI,
  type ChatbotUIOption,
  type ChatMessageCreateInput,
  type Conversation,
} from "../../shared/api/endpoints";
import { ApiError } from "../../shared/api/http";
import { Button, ResponsiveImage } from "../../shared/components/ui";
import { formatCategoryDisplayName } from "../../shared/ticket-labels";
import {
  type AssistantTicketQueryPresentation,
  getAssistantTicketQueryPresentation,
  getAssistantReplyPresentation,
  getAssistantRequestErrorMessage,
  formatAssistantMessage,
  ticketDraftCorrectionMessage,
  type ReadyTicketDraftPayload,
} from "./assistant-conversation.model";
import { AssistantTicketDraft } from "./assistant-ticket-draft";
import {
  clearPendingTicketConversion,
  getActiveConversationId,
  getPendingTicketConversionId,
  prepareTicketConversionReturn,
  removeActiveConversationId,
  saveActiveConversationId,
} from "./assistant-conversation.storage";

const exampleQuestions = [
  "¿Qué canales de atención están disponibles?",
  "¿Qué requisitos necesito para solicitar una tarjeta?",
  "¿Qué hago si mi tarjeta está bloqueada?",
  "¿Cómo solicito un estado de cuenta?",
] as const;

const assistantTopics = [
  {
    label: "Tarjetas",
    prompt: "Necesito ayuda con una tarjeta.",
    Icon: CreditCard,
  },
  {
    label: "Cuentas",
    prompt: "Necesito ayuda con una cuenta.",
    Icon: Landmark,
  },
  {
    label: "Banca digital",
    prompt: "Necesito ayuda con la banca digital.",
    Icon: Smartphone,
  },
  {
    label: "Créditos y reclamos",
    prompt: "Necesito ayuda con un crédito o un reclamo.",
    Icon: MessageCircleMore,
  },
] as const;

interface ChatSubmission {
  readonly body: ChatMessageCreateInput;
  readonly displayContent: string;
  readonly appendUser: boolean;
}

const endConversationCommands = new Set([
  "salir",
  "terminar",
  "finalizar",
  "cerrar chat",
  "cerrar conversacion",
  "finalizar chat",
  "finalizar conversacion",
  "terminar chat",
  "terminar conversacion",
  "quiero salir",
  "quiero terminar",
  "quiero finalizar",
  "quiero cerrar",
  "cerrar",
]);

function normalizeLifecycleCommand(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim()
    .replace(/[.!?,;:¿¡]+$/g, "");
}

function AssistantWelcomeMenu({
  disabled,
  onSubmit,
}: {
  readonly disabled: boolean;
  readonly onSubmit: (prompt: string) => void;
}) {
  return (
    <div className="assistant-welcome">
      <div className="assistant-welcome__intro">
        <span aria-hidden="true">
          <Bot />
        </span>
        <div>
          <h2>¿Qué necesitas resolver hoy?</h2>
          <p>
            Hola, soy el asistente GNB. Elige un tema o cuéntame qué necesitas.
          </p>
        </div>
      </div>
      <div className="assistant-topic-grid" role="group" aria-label="Temas de atención">
        {assistantTopics.map(({ label, prompt, Icon }) => (
          <button
            type="button"
            key={label}
            disabled={disabled}
            onClick={() => onSubmit(prompt)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
      </div>
      <details className="assistant-faq-suggestions">
        <summary>
          Preguntas frecuentes
          <ChevronDown aria-hidden="true" />
        </summary>
        <div className="assistant-examples">
          {exampleQuestions.map((question) => (
            <button
              type="button"
              key={question}
              disabled={disabled}
              onClick={() => onSubmit(question)}
            >
              {question}
              <ChevronRight aria-hidden="true" />
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}

const interactiveOptionHeadings: Record<ChatbotUI["type"], string> = {
  MAIN_MENU: "Elige un tema",
  FAQ_CATEGORY_CHOICES: "Elige una categoría",
  FAQ_SUBCATEGORY_CHOICES: "Elige un subtema",
  FAQ_CHOICES: "Preguntas frecuentes",
};

function AssistantInteractiveOptions({
  ui,
  disabled,
  onSelect,
}: {
  readonly ui: ChatbotUI | null | undefined;
  readonly disabled: boolean;
  readonly onSelect: (option: ChatbotUIOption) => void;
}) {
  const options = ui?.options ?? [];
  if (!ui || options.length === 0) return null;

  const heading = interactiveOptionHeadings[ui.type];
  return (
    <section
      className="assistant-interactive-options"
      aria-label={heading}
    >
      <h3>{heading}</h3>
      <div role="group" aria-label={heading}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(option)}
          >
            <span>{option.label}</span>
            <ChevronRight aria-hidden="true" />
          </button>
        ))}
      </div>
    </section>
  );
}

function AssistantPausedDraft({
  disabled,
  onResume,
}: {
  readonly disabled: boolean;
  readonly onResume: () => void;
}) {
  return (
    <section className="assistant-draft-paused" role="status">
      <div>
        <strong>Tu borrador está guardado.</strong>
        <p>Cuando quieras, puedes continuar donde lo dejaste.</p>
      </div>
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={onResume}
      >
        <RotateCcw aria-hidden="true" /> Continuar borrador
      </Button>
    </section>
  );
}

type AssistantTicketCard = NonNullable<
  NonNullable<BotMessageResponse["ticket_query"]>["ticket"]
>;

interface VisibleMessage {
  readonly id: string;
  readonly content: string;
  readonly sender: "user" | "bot";
}

interface AssistantConversationProps {
  readonly authenticated: boolean;
  readonly variant?: "page" | "widget";
  readonly onConvert?: (
    conversation: Conversation,
    transcript: string,
  ) => void;
}

const toVisibleMessages = (
  conversation: Conversation,
): readonly VisibleMessage[] =>
  (conversation.messages ?? []).map((message) => ({
    id: message.id,
    content: message.content,
    sender: message.sender_type.toUpperCase() === "USER" ? "user" : "bot",
  }));

const toTranscript = (messages: readonly VisibleMessage[]): string =>
  messages
    .map(
      (message) =>
        `${message.sender === "user" ? "Cliente" : "Asistente"}: ${message.content}`,
    )
    .join("\n\n");

const errorDetails = (
  error: unknown,
  context: "conversation" | "ticket" = "conversation",
  authenticated = true,
) => {
  if (error instanceof ApiError) {
    return {
      message: getAssistantRequestErrorMessage(
        error.status,
        context,
        error.message,
        authenticated,
      ),
      requestId: error.requestId,
    };
  }
  return {
    message: getAssistantRequestErrorMessage(-1, context, undefined, authenticated),
    requestId: null,
  };
};

const safeSourceUrl = (value: string | null | undefined): string | null => {
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
};

const sourceVerificationLabel = (verifiedAt: string | null | undefined) => {
  if (!verifiedAt) return null;
  const date = new Date(verifiedAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
  return `Verificada el ${formatted}`;
};

const formatAssistantDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

function AssistantTicketCardView({
  ticket,
}: {
  readonly ticket: AssistantTicketCard;
}) {
  return (
    <li className="assistant-ticket-card">
      <div className="assistant-ticket-card__identity">
        <code>{ticket.tracking_code}</code>
        <h4>{ticket.subject}</h4>
      </div>
      <dl>
        <div>
          <dt>Estado</dt>
          <dd className="assistant-ticket-card__status">{ticket.status_label}</dd>
        </div>
        <div>
          <dt>Prioridad</dt>
          <dd>{ticket.priority_label}</dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>{formatAssistantDate(ticket.updated_at)}</dd>
        </div>
      </dl>
    </li>
  );
}

function AssistantTicketQueryResult({
  presentation,
  disabled,
  onRequestPage,
  onSubmitTicketCode,
}: {
  readonly presentation: AssistantTicketQueryPresentation;
  readonly disabled: boolean;
  readonly onRequestPage: (page: number) => void;
  readonly onSubmitTicketCode: (code: string) => void;
}) {
  switch (presentation.kind) {
    case "authentication":
      return (
        <section className="assistant-ticket-query assistant-auth-prompt" role="status">
          <strong>Para consultar tus tickets, inicia sesión o regístrate.</strong>
          <div>
            {presentation.authenticationActions.includes("LOGIN") ? (
              <Link to="/ingresar?returnTo=%2Fapp%2Fasistente">
                Iniciar sesión
              </Link>
            ) : null}
            {presentation.authenticationActions.includes("REGISTER") ? (
              <Link to="/registro?returnTo=%2Fapp%2Fasistente">
                Registrarme
              </Link>
            ) : null}
          </div>
        </section>
      );
    case "clarify-ticket-code":
      return (
        <form
          className="assistant-clarification assistant-code-clarification"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const input = form.elements.namedItem("ticket-code");
            const code =
              input instanceof HTMLInputElement ? input.value.trim() : "";
            if (code && !disabled) {
              onSubmitTicketCode(code);
              form.reset();
            }
          }}
        >
          <label htmlFor="assistant-ticket-code">
            Ingresa un código de seguimiento
          </label>
          <div className="assistant-code-clarification__controls">
            <input
              id="assistant-ticket-code"
              name="ticket-code"
              type="text"
              maxLength={128}
              required
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder="Ej.: TCK-20261010-AB12CD34EF"
              disabled={disabled}
            />
            <Button type="submit" disabled={disabled}>
              Consultar código
            </Button>
          </div>
        </form>
      );
    case "tickets":
      return (
        <section className="assistant-ticket-query">
          <h3>
            {presentation.queryType === "CLIENT_ACTION_REQUIRED"
              ? "Tickets que esperan una acción tuya"
              : "Tus tickets"}
          </h3>
          {presentation.total !== null ? (
            <p className="assistant-ticket-query__total">
              Total encontrado: {presentation.total}{" "}
              {presentation.total === 1 ? "ticket" : "tickets"}
            </p>
          ) : null}
          {presentation.tickets.length ? (
            <ul aria-label="Tickets encontrados">
              {presentation.tickets.map((ticket) => (
                <AssistantTicketCardView
                  key={ticket.tracking_code}
                  ticket={ticket}
                />
              ))}
            </ul>
          ) : (
            <p className="assistant-ticket-query__empty" role="status">
              No se encontraron tickets.
            </p>
          )}
          {presentation.pagination && presentation.pagination.total_pages > 1 ? (
            <nav
              className="assistant-ticket-pagination"
              aria-label="Paginación de tickets"
            >
              <button
                type="button"
                disabled={disabled || presentation.pagination.page <= 1}
                aria-label="Ver página anterior"
                onClick={() =>
                  onRequestPage(presentation.pagination!.page - 1)
                }
              >
                Anterior
              </button>
              <span aria-live="polite">
                Página {presentation.pagination.page} de{" "}
                {presentation.pagination.total_pages} ·{" "}
                {presentation.pagination.page_size} por página
              </span>
              <button
                type="button"
                disabled={
                  disabled ||
                  presentation.pagination.page >=
                    presentation.pagination.total_pages
                }
                aria-label="Ver página siguiente"
                onClick={() =>
                  onRequestPage(presentation.pagination!.page + 1)
                }
              >
                Siguiente
              </button>
            </nav>
          ) : null}
        </section>
      );
    case "count":
      return presentation.total === null ? null : (
        <section className="assistant-ticket-query" aria-label="Conteo de tickets">
          <h3>Consulta de tickets</h3>
          <p className="assistant-ticket-query__total" role="status">
            Total encontrado: {presentation.total}{" "}
            {presentation.total === 1 ? "ticket" : "tickets"}
          </p>
        </section>
      );
    case "ticket":
      return (
        <section className="assistant-ticket-query">
          <h3>
            {presentation.queryType === "LATEST_TICKET"
              ? "Tu ticket más reciente"
              : "Estado del ticket"}
          </h3>
          <ul aria-label="Ticket consultado">
            <AssistantTicketCardView ticket={presentation.ticket} />
          </ul>
        </section>
      );
    case "advisor-status":
      return (
        <section className="assistant-ticket-query" aria-label="Respuesta del asesor">
          <p className="assistant-ticket-query__status" role="status">
            {presentation.advisorResponded
              ? "El asesor ya respondió."
              : "Aún no se registra una respuesta del asesor."}
          </p>
          {presentation.ticket ? (
            <ul aria-label="Ticket consultado">
              <AssistantTicketCardView ticket={presentation.ticket} />
            </ul>
          ) : null}
        </section>
      );
    case "advisor-reply":
      return (
        <section className="assistant-ticket-query" aria-label="Respuesta más reciente del asesor">
          {presentation.advisorResponded !== null ? (
            <p className="assistant-ticket-query__status" role="status">
              {presentation.advisorResponded
                ? "El asesor ya respondió."
                : "Aún no se registra una respuesta del asesor."}
            </p>
          ) : null}
          {presentation.latestAdvisorResponse?.content ? (
            <blockquote className="assistant-advisor-response">
              <p>{presentation.latestAdvisorResponse.content}</p>
              <footer>
                {presentation.latestAdvisorResponse.author_name} ·{" "}
                {formatAssistantDate(
                  presentation.latestAdvisorResponse.created_at,
                )}
              </footer>
            </blockquote>
          ) : null}
          {presentation.ticket ? (
            <ul aria-label="Ticket consultado">
              <AssistantTicketCardView ticket={presentation.ticket} />
            </ul>
          ) : null}
        </section>
      );
  }
}

export function AssistantConversation({
  authenticated,
  variant = "page",
  onConvert,
}: AssistantConversationProps) {
  const lifecycleId = useId();
  const lifecycleDialogTitleId = `${lifecycleId}-title`;
  const lifecycleDialogDescriptionId = `${lifecycleId}-description`;
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<readonly VisibleMessage[]>([]);
  const [value, setValue] = useState("");
  const [lastReply, setLastReply] = useState<BotMessageResponse | null>(null);
  const [failedSubmission, setFailedSubmission] =
    useState<ChatSubmission | null>(null);
  const [failedReset, setFailedReset] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorDetails> | null>(
    null,
  );
  const [isRestoring, setRestoring] = useState(() =>
    Boolean(getActiveConversationId()),
  );
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [escalationMessage, setEscalationMessage] = useState<string | null>(
    null,
  );
  const [retryTicketPayload, setRetryTicketPayload] =
    useState<ReadyTicketDraftPayload | null>(null);
  const [conversionConflict, setConversionConflict] = useState(false);
  const [lifecycleConfirmation, setLifecycleConfirmation] = useState<
    "end" | "restart" | null
  >(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const lifecycleDialogRef = useRef<HTMLElement>(null);
  const lifecycleCancelRef = useRef<HTMLButtonElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const lifecycleTriggerRef = useRef<HTMLElement | null>(null);
  const conversionInFlightRef = useRef(false);
  const resumedPendingConversionRef = useRef<string | null>(null);
  const linkedConversationIdsRef = useRef(new Set<string>());
  const pendingLinkRequestsRef = useRef(new Map<string, Promise<void>>());
  const pendingRestoreRequestsRef = useRef(
    new Map<string, Promise<Conversation>>(),
  );
  const queryClient = useQueryClient();
  const ticketDraft = conversation?.ticket_draft ?? lastReply?.ticket_draft;
  const currentUi = conversation?.ui ?? lastReply?.ui ?? null;
  const terminalConversation = Boolean(
    conversation &&
      ["CLOSED", "EXPIRED", "CONVERTED_TO_TICKET"].includes(
        conversation.status,
      ),
  );

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
    enabled:
      authenticated &&
      Boolean(
        ticketDraft &&
          !ticketDraft.paused &&
          ticketDraft.status !== "INACTIVE" &&
          ticketDraft.status !== "CANCELLED",
      ),
  });

  useEffect(() => {
    if (!lifecycleConfirmation) return;
    lifecycleCancelRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setLifecycleConfirmation(null);
        lifecycleTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = lifecycleDialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled])",
      );
      if (!controls?.length) return;
      const first = controls.item(0);
      const last = controls.item(controls.length - 1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [lifecycleConfirmation]);

  useEffect(() => {
    const id = getActiveConversationId();
    if (!id) return;
    let active = true;
    void (async () => {
      try {
        if (authenticated) {
          if (!linkedConversationIdsRef.current.has(id)) {
            let linkRequest = pendingLinkRequestsRef.current.get(id);
            if (!linkRequest) {
              linkRequest = api.chat
                .link(id)
                .then(() => {
                  linkedConversationIdsRef.current.add(id);
                })
                .catch((linkError: unknown) => {
                  if (
                    linkError instanceof ApiError &&
                    linkError.status === 409
                  ) {
                    linkedConversationIdsRef.current.add(id);
                    return;
                  }
                  throw linkError;
                })
                .finally(() => {
                  pendingLinkRequestsRef.current.delete(id);
                });
              pendingLinkRequestsRef.current.set(id, linkRequest);
            }
            await linkRequest;
          }
        }
        let restoreRequest = pendingRestoreRequestsRef.current.get(id);
        if (!restoreRequest) {
          restoreRequest = api.chat.get(id).finally(() => {
            pendingRestoreRequestsRef.current.delete(id);
          });
          pendingRestoreRequestsRef.current.set(id, restoreRequest);
        }
        const restored = await restoreRequest;
        if (!active) return;
        setConversation(restored);
        const restoredMessages = toVisibleMessages(restored);
        setMessages(restoredMessages);
        const pendingConversionId = getPendingTicketConversionId();
        if (pendingConversionId && pendingConversionId !== restored.id) {
          clearPendingTicketConversion(pendingConversionId);
        } else if (
          pendingConversionId === restored.id &&
          (restored.converted_ticket ||
            (restored.ticket_draft &&
              restored.ticket_draft.status !== "INACTIVE"))
        ) {
          clearPendingTicketConversion(restored.id);
        } else if (
          pendingConversionId === restored.id &&
          onConvert &&
          resumedPendingConversionRef.current !== restored.id
        ) {
          resumedPendingConversionRef.current = restored.id;
          onConvert(restored, toTranscript(restoredMessages));
        }
      } catch (restoreError) {
        if (!active) return;
        if (
          restoreError instanceof ApiError &&
          [403, 404].includes(restoreError.status)
        ) {
          removeActiveConversationId();
          clearPendingTicketConversion();
        } else {
          setError(errorDetails(restoreError, "conversation", authenticated));
          if (
            !authenticated &&
            restoreError instanceof ApiError &&
            restoreError.status === 401
          ) {
            setFailedReset(true);
          }
        }
      } finally {
        if (active) setRestoring(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [authenticated, onConvert]);

  useEffect(() => {
    const element = messagesRef.current;
    if (!element) return;

    const latestVisibleMessage = messages[messages.length - 1];
    const latestReplyElement = element.querySelector<HTMLElement>(
      "[data-latest-reply='true']",
    );
    if (
      lastReply &&
      latestVisibleMessage?.id === lastReply.bot_message.id &&
      latestReplyElement
    ) {
      const scrollport = element.getBoundingClientRect();
      const reply = latestReplyElement.getBoundingClientRect();
      const topPadding = Number.parseFloat(getComputedStyle(element).paddingTop) || 0;
      const replyTop =
        element.scrollTop +
        reply.top -
        (scrollport.top + element.clientTop + topPadding);
      const bottomScrollTop = element.scrollHeight - element.clientHeight;

      if (replyTop < bottomScrollTop) {
        element.scrollTop = Math.max(0, replyTop + topPadding / 2);
        return;
      }
    }

    element.scrollTop = element.scrollHeight;
  }, [messages, error, lastReply]);

  const chat = useMutation({
    mutationFn: async ({
      body,
      displayContent,
      appendUser,
    }: ChatSubmission) => {
      let activeConversation = conversation;
      if (!activeConversation) {
        activeConversation = await api.chat.create();
        saveActiveConversationId(activeConversation.id);
        clearPendingTicketConversion();
        setConversation(activeConversation);
      }
      const response = await api.chat.message(activeConversation.id, body);
      return {
        displayContent,
        appendUser,
        response,
        conversation: activeConversation,
      };
    },
    onMutate: ({ displayContent, appendUser }) => {
      setError(null);
      setFailedReset(false);
      setEscalationMessage(null);
      setFailedSubmission(null);
      if (appendUser) {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), content: displayContent, sender: "user" },
        ]);
        setValue("");
      }
    },
    onSuccess: ({ response, conversation: activeConversation }) => {
      setConversation({
        ...activeConversation,
        status: response.conversation_status ?? activeConversation.status,
        last_confidence: response.confidence,
        ticket_draft: response.ticket_draft ?? activeConversation.ticket_draft,
        menu_open: response.menu_open ?? false,
        ui: response.ui ?? null,
      });
      setConversionConflict(false);
      setMessages((current) => [
        ...current,
        {
          id: response.bot_message.id,
          content: response.bot_message.content,
          sender: "bot",
        },
      ]);
      setLastReply(response);
      setFailedSubmission(null);
      setFeedback(null);
    },
    onError: (mutationError, variables) => {
      setError(errorDetails(mutationError, "conversation", authenticated));
      setFailedSubmission(variables);
    },
  });

  const reset = useMutation({
    mutationFn: () => api.chat.create(),
    onSuccess: (next) => {
      saveActiveConversationId(next.id);
      clearPendingTicketConversion();
      setConversation(next);
      setMessages([]);
      setLastReply(null);
      setFailedSubmission(null);
      setFailedReset(false);
      setError(null);
      setFeedback(null);
      setEscalationMessage(null);
      setRetryTicketPayload(null);
      setConversionConflict(false);
      setValue("");
      window.requestAnimationFrame(() => composerRef.current?.focus());
    },
    onError: () => {
      setFailedReset(true);
      setFailedSubmission(null);
      setError({
        message:
          "No pudimos iniciar una conversación nueva. Tu conversación actual sigue disponible.",
        requestId: null,
      });
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: (isHelpful: boolean) => {
      if (!conversation) throw new Error("No active conversation");
      return api.chat.feedback(conversation.id, { is_helpful: isHelpful });
    },
    onSuccess: (_response, isHelpful) => setFeedback(isHelpful),
    onError: (mutationError) =>
      setError(errorDetails(mutationError, "conversation", authenticated)),
  });

  const escalate = useMutation({
    mutationFn: () => {
      if (!conversation) throw new Error("No active conversation");
      return api.chat.escalate(
        conversation.id,
        "Solicitud de seguimiento desde el asistente digital",
      );
    },
    onSuccess: (next) => {
      setConversation(next);
      setEscalationMessage(
        "Registramos tu solicitud de seguimiento. No es un chat humano en tiempo real; el equipo continuará la atención por el canal correspondiente.",
      );
    },
    onError: (mutationError) =>
      setError(errorDetails(mutationError, "conversation", authenticated)),
  });

  const ticketConversion = useMutation({
    mutationFn: (body: ReadyTicketDraftPayload) => {
      if (!conversation) throw new Error("No active conversation");
      return api.chat.convert(conversation.id, body);
    },
    onMutate: () => {
      setError(null);
      setConversionConflict(false);
    },
    onSuccess: async (ticket) => {
      const convertedTicket: ChatbotConvertedTicketSummary = {
        id: ticket.id,
        tracking_code: ticket.tracking_code,
        subject: ticket.subject,
        status: ticket.status,
      };
      setConversation((current) =>
        current
          ? {
              ...current,
              status: "CONVERTED_TO_TICKET",
              converted_ticket: convertedTicket,
            }
          : current,
      );
      setError(null);
      setRetryTicketPayload(null);
      clearPendingTicketConversion(conversation?.id);
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (mutationError, payload) => {
      const status =
        mutationError instanceof ApiError ? mutationError.status : -1;
      setError(errorDetails(mutationError, "ticket", authenticated));
      setRetryTicketPayload(
        status === 0 || status === 429 || status >= 500 ? payload : null,
      );
      if (status === 401 && conversation) {
        saveActiveConversationId(conversation.id);
      }
      if (status === 409) setConversionConflict(true);
      if ((status === 409 || status === 422) && conversation) {
        void api.chat
          .get(conversation.id)
          .then(setConversation)
          .catch(() => undefined);
      }
    },
  });

  const submit = useCallback(
    (content: string, appendUser = true) => {
      const normalized = content.trim();
      if (
        !normalized ||
        chat.isPending ||
        reset.isPending ||
        isRestoring ||
        terminalConversation
      ) {
        return;
      }
      if (
        appendUser &&
        endConversationCommands.has(normalizeLifecycleCommand(normalized))
      ) {
        setValue("");
        lifecycleTriggerRef.current = composerRef.current;
        setLifecycleConfirmation("end");
        return;
      }
      chat.mutate({
        body: { content: normalized },
        displayContent: normalized,
        appendUser,
      });
    },
    [chat, isRestoring, reset.isPending, terminalConversation],
  );

  const submitOption = useCallback(
    (option: ChatbotUIOption) => {
      const displayContent = option.label.trim();
      if (
        !option.id ||
        !displayContent ||
        chat.isPending ||
        reset.isPending ||
        isRestoring ||
        terminalConversation
      ) {
        return;
      }
      chat.mutate({
        body: { option_id: option.id },
        displayContent,
        appendUser: true,
      });
    },
    [chat, isRestoring, reset.isPending, terminalConversation],
  );

  const confirmEndConversation = () => {
    setLifecycleConfirmation(null);
    setValue("");
    chat.mutate({
      body: { content: "salir" },
      displayContent: "salir",
      appendUser: true,
    });
  };

  const confirmRestartConversation = () => {
    setLifecycleConfirmation(null);
    reset.mutate();
  };

  const closeLifecycleConfirmation = () => {
    setLifecycleConfirmation(null);
    lifecycleTriggerRef.current?.focus();
  };

  const terminalMessage =
    conversation?.status === "CLOSED"
      ? "Esta conversación finalizó. El historial se conserva y no se generó un ticket al cerrarla."
      : conversation?.status === "EXPIRED"
        ? "Esta conversación venció. Su historial permanece disponible; inicia una nueva para continuar."
        : "Esta conversación ya se convirtió en una solicitud. Puedes consultar su detalle o iniciar otra conversación.";

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(value);
    }
  };

  const transcript = toTranscript(messages);
  const replyPresentation = lastReply
    ? getAssistantReplyPresentation(
        lastReply,
        conversation?.status ?? lastReply.conversation_status ?? "",
      )
    : null;
  const ticketQueryPresentation = lastReply
    ? getAssistantTicketQueryPresentation(lastReply)
    : null;
  const legacyTicketOffer = Boolean(
    replyPresentation?.showTicketOffer &&
      (!ticketDraft || ticketDraft.status === "INACTIVE") &&
      !conversation?.converted_ticket &&
      conversation?.status !== "CONVERTED_TO_TICKET",
  );
  const confirmTicket = (payload: ReadyTicketDraftPayload) => {
    if (
      !conversation ||
      !authenticated ||
      ticketConversion.isPending ||
      conversionInFlightRef.current
    ) {
      return;
    }
    conversionInFlightRef.current = true;
    saveActiveConversationId(conversation.id);
    ticketConversion.mutate(payload, {
      onSettled: () => {
        conversionInFlightRef.current = false;
      },
    });
  };
  const retryTicketConversion = () => {
    if (retryTicketPayload) confirmTicket(retryTicketPayload);
  };
  const renderTicketDraft = () => {
    if (ticketDraft?.paused && !conversation?.converted_ticket) {
      return (
        <AssistantPausedDraft
          disabled={isRestoring || chat.isPending}
          onResume={() => submit("Continúa con mi borrador de ticket")}
        />
      );
    }
    if (
      !ticketDraft &&
      !conversation?.converted_ticket &&
      conversation?.status !== "CONVERTED_TO_TICKET"
    ) {
      return null;
    }
    return (
      <AssistantTicketDraft
        conversationStatus={conversation?.status}
        draft={ticketDraft}
        convertedTicket={conversation?.converted_ticket}
        categories={categories.data}
        categoriesLoading={categories.isLoading}
        categoriesError={categories.isError}
        authenticated={authenticated}
        chatPending={chat.isPending}
        conversionPending={ticketConversion.isPending}
        conversionRetryAvailable={Boolean(retryTicketPayload)}
        conversionConflict={conversionConflict}
        onRequireAuth={() => {
          if (conversation) saveActiveConversationId(conversation.id);
        }}
        onSelectCategory={(id, name) =>
          submit(
            `Selecciono la categoría ${formatCategoryDisplayName(name)} (${id}).`,
          )
        }
        onCorrect={(body, categoryName) =>
          submit(ticketDraftCorrectionMessage(body, categoryName))
        }
        onCancel={() =>
          submit("Cancela el borrador del ticket. No deseo continuar con su creación.")
        }
        onConfirm={confirmTicket}
        onRetry={retryTicketConversion}
      />
    );
  };

  return (
    <>
    <section className={`assistant-panel assistant-panel--${variant}`}>
      <header className="assistant-panel__head">
        <span className="assistant-panel__avatar" aria-hidden="true">
          <Bot />
        </span>
        <div>
          <strong>Asistente GNB</strong>
          <small>
            {chat.isPending
              ? "Preparando una respuesta…"
              : isRestoring
                ? "Recuperando conversación"
                : "Orientación digital"}
          </small>
        </div>
        <Button
          className="assistant-panel__reset"
          variant="quiet"
          disabled={!conversation || reset.isPending || chat.isPending}
          isLoading={reset.isPending}
          onClick={(event) => {
            lifecycleTriggerRef.current = event.currentTarget;
            setLifecycleConfirmation("restart");
          }}
          aria-label="Reiniciar conversación"
          title="Reiniciar conversación"
        >
          <RotateCcw aria-hidden="true" />
          <span className="assistant-panel__reset-label">Reiniciar</span>
        </Button>
      </header>

      {conversation && !terminalConversation ? (
        <div
          className="assistant-lifecycle-controls"
          role="group"
          aria-label="Acciones de conversación"
        >
          <span className="assistant-lifecycle-controls__label">Acciones</span>
          {messages.length > 0 && !conversation.menu_open ? (
            <Button
              className="assistant-lifecycle-controls__back"
              variant="primary"
              disabled={isRestoring || chat.isPending || reset.isPending}
              onClick={() => submit("volver al menú")}
            >
              <List aria-hidden="true" /> Volver al menú
            </Button>
          ) : null}
          <Button
            className="assistant-lifecycle-controls__end"
            variant="quiet"
            disabled={isRestoring || chat.isPending || reset.isPending}
            onClick={(event) => {
              lifecycleTriggerRef.current = event.currentTarget;
              setLifecycleConfirmation("end");
            }}
          >
            <LogOut aria-hidden="true" /> Finalizar
          </Button>
        </div>
      ) : null}

      <div
        className="assistant-messages"
        ref={messagesRef}
        role="log"
        aria-label="Conversación con el asistente"
        aria-live="polite"
        aria-relevant="additions text"
        aria-atomic="false"
        tabIndex={0}
      >
        {messages.length ? (
          messages.map((message, messageIndex) => {
            const isLatestReply =
              message.sender === "bot" &&
              messageIndex === messages.length - 1 &&
              message.id === lastReply?.bot_message.id;

            return (
              <article
                key={`${message.id}-${messageIndex}`}
                className={`assistant-message assistant-message--${message.sender}`}
                data-latest-reply={isLatestReply ? "true" : undefined}
              >
                <span
                  className={`assistant-message__avatar assistant-message__avatar--${message.sender}`}
                  aria-hidden="true"
                >
                  {message.sender === "bot" ? <Bot /> : <UserRound />}
                </span>
                <div className="assistant-message__body">
                  <p>
                    {message.sender === "bot"
                      ? formatAssistantMessage(message.content)
                      : message.content}
                  </p>
                  {isLatestReply ? (
                    <div className="assistant-message__details">
                      {replyPresentation?.needsClarification ? (
                        <div className="assistant-clarification">
                          <strong>
                            {lastReply?.clarification_options?.length
                              ? "Para orientarte mejor, elige una opción:"
                              : "Para orientarte mejor, aclara un poco tu consulta."}
                          </strong>
                          {lastReply?.clarification_options?.length ? (
                            <div>
                              {lastReply.clarification_options.map((option) => (
                                <button
                                  key={option}
                                  type="button"
                                  disabled={isRestoring || chat.isPending}
                                  onClick={() => submit(option)}
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {renderTicketDraft()}

                      {ticketQueryPresentation ? (
                        <AssistantTicketQueryResult
                          key={lastReply?.bot_message.id}
                          presentation={ticketQueryPresentation}
                          disabled={isRestoring || chat.isPending}
                          onRequestPage={(page) =>
                            submit(`Muéstrame mis tickets recientes página ${page}`)
                          }
                          onSubmitTicketCode={(code) => submit(code)}
                        />
                      ) : null}

                      {lastReply?.sources?.length ? (
                        <section
                          className="assistant-sources"
                          aria-label="Fuentes consultadas"
                        >
                          <h3>Fuentes consultadas</h3>
                          <ul>
                            {lastReply.sources.map((source, index) => {
                              const href = safeSourceUrl(source.url);
                              const verifiedAt = sourceVerificationLabel(
                                source.verified_at,
                              );
                              return (
                                <li
                                  key={`${source.title}-${source.url ?? "source"}-${index}`}
                                >
                                  <div className="assistant-source__details">
                                    {href ? (
                                      <a
                                        href={href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        <span>{source.title}</span>
                                        <ExternalLink aria-hidden="true" />
                                        <span className="sr-only">
                                          {" "}(abre en una pestaña nueva)
                                        </span>
                                      </a>
                                    ) : (
                                      <strong>{source.title}</strong>
                                    )}
                                    {source.category ? (
                                      <span className="assistant-source__category">
                                        {formatCategoryDisplayName(source.category)}
                                      </span>
                                    ) : null}
                                  </div>
                                  {verifiedAt ? <small>{verifiedAt}</small> : null}
                                </li>
                              );
                            })}
                          </ul>
                        </section>
                      ) : null}

                      {lastReply ? (
                        <div className="assistant-reply-actions">
                          <span>¿Te ayudó esta respuesta?</span>
                          <button
                            type="button"
                            aria-label="La respuesta fue útil"
                            aria-pressed={feedback === true}
                            disabled={feedbackMutation.isPending}
                            onClick={() => feedbackMutation.mutate(true)}
                          >
                            <ThumbsUp aria-hidden="true" /> Sí
                          </button>
                          <button
                            type="button"
                            aria-label="La respuesta no fue útil"
                            aria-pressed={feedback === false}
                            disabled={feedbackMutation.isPending}
                            onClick={() => feedbackMutation.mutate(false)}
                          >
                            <ThumbsDown aria-hidden="true" /> No
                          </button>
                          {feedback !== null ? (
                            <small>
                              <Check aria-hidden="true" /> Gracias por tu opinión.
                            </small>
                          ) : null}
                        </div>
                      ) : null}

                      {conversation &&
                      lastReply &&
                      (replyPresentation?.canRequestFollowup ||
                        (legacyTicketOffer && authenticated && onConvert)) ? (
                        <div className="assistant-followup">
                          {replyPresentation?.canRequestFollowup ? (
                            <Button
                              variant="quiet"
                              disabled={escalate.isPending}
                              isLoading={escalate.isPending}
                              onClick={() => escalate.mutate()}
                            >
                              <Link2 aria-hidden="true" /> Solicitar seguimiento
                            </Button>
                          ) : null}
                          {legacyTicketOffer && authenticated && onConvert ? (
                            <Button
                              onClick={() => {
                                prepareTicketConversionReturn(conversation.id);
                                onConvert(conversation, transcript);
                              }}
                            >
                              Convertir en solicitud
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      {conversation && legacyTicketOffer && !authenticated ? (
                        <div className="assistant-auth-prompt">
                          <strong>
                            ¿Quieres convertir esta conversación en solicitud?
                          </strong>
                          <p>
                            Ingresa o crea una cuenta para continuar con esta
                            conversación.
                          </p>
                          <div>
                            <Link
                              to="/ingresar?returnTo=%2Fapp%2Fasistente"
                              onClick={() =>
                                prepareTicketConversionReturn(conversation.id)
                              }
                            >
                              Iniciar sesión
                            </Link>
                            <Link
                              to="/registro?returnTo=%2Fapp%2Fasistente"
                              onClick={() =>
                                prepareTicketConversionReturn(conversation.id)
                              }
                            >
                              Registrarme
                            </Link>
                          </div>
                        </div>
                      ) : null}

                      {escalationMessage ? (
                        <p className="assistant-escalation" role="status">
                          {escalationMessage}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : currentUi?.options?.length ? (
          <AssistantInteractiveOptions
            ui={currentUi}
            disabled={isRestoring || chat.isPending}
            onSelect={submitOption}
          />
        ) : (
          <AssistantWelcomeMenu
            disabled={isRestoring || chat.isPending}
            onSubmit={submit}
          />
        )}

        {messages.length > 0 && conversation?.menu_open ? (
          currentUi?.options?.length ? (
            <AssistantInteractiveOptions
              ui={currentUi}
              disabled={isRestoring || chat.isPending || terminalConversation}
              onSelect={submitOption}
            />
          ) : (
            <AssistantWelcomeMenu
              disabled={isRestoring || chat.isPending}
              onSubmit={submit}
            />
          )
        ) : null}

        {messages.length > 0 &&
        !conversation?.menu_open &&
        currentUi?.options?.length ? (
          <AssistantInteractiveOptions
            ui={currentUi}
            disabled={isRestoring || chat.isPending || terminalConversation}
            onSelect={submitOption}
          />
        ) : null}

        {terminalConversation ? (
          <section className="assistant-terminal" role="status">
            <strong>Conversación finalizada</strong>
            <p>{terminalMessage}</p>
            <Button
              variant="secondary"
              autoFocus
              disabled={reset.isPending}
              isLoading={reset.isPending}
              onClick={(event) => {
                lifecycleTriggerRef.current = event.currentTarget;
                setLifecycleConfirmation("restart");
              }}
            >
              <RotateCcw aria-hidden="true" /> Iniciar conversación nueva
            </Button>
          </section>
        ) : null}

        {chat.isPending ? (
          <article className="assistant-message assistant-message--bot assistant-message--typing">
            <span
              className="assistant-message__avatar assistant-message__avatar--bot"
              aria-hidden="true"
            >
              <Bot />
            </span>
            <div className="assistant-message__body">
              <p className="assistant-typing">
                <span>Preparando una respuesta</span>
                <span className="assistant-typing__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </p>
            </div>
          </article>
        ) : null}

      <div className="assistant-statuses">
        {error ? (
          <div className="assistant-notice assistant-notice--error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>{error.message}</strong>
              {error.requestId ? (
                <small>Referencia: {error.requestId}</small>
              ) : null}
            </div>
            {failedSubmission ? (
              <Button
                variant="secondary"
                onClick={() =>
                  chat.mutate({ ...failedSubmission, appendUser: false })
                }
              >
                <RefreshCw aria-hidden="true" /> Reintentar
              </Button>
            ) : failedReset ? (
              <Button
                variant="secondary"
                disabled={reset.isPending}
                isLoading={reset.isPending}
                onClick={() => reset.mutate()}
              >
                <RefreshCw aria-hidden="true" /> Iniciar una conversación nueva
              </Button>
            ) : null}
          </div>
        ) : null}

        {!lastReply ? renderTicketDraft() : null}
      </div>
      </div>

      {!terminalConversation ? (
      <form
        className="assistant-composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit(value);
        }}
      >
        <label>
          <span className="sr-only">Escribe tu consulta</span>
          <textarea
            ref={composerRef}
            rows={variant === "widget" ? 1 : 2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Escribe tu consulta…"
            autoComplete="off"
            maxLength={10000}
            disabled={isRestoring || chat.isPending || reset.isPending}
          />
        </label>
        <Button
          type="submit"
          disabled={!value.trim() || chat.isPending || isRestoring || reset.isPending}
          isLoading={chat.isPending}
          aria-label="Enviar consulta"
        >
          <Send aria-hidden="true" />
        </Button>
        <p>
          <AlertTriangle aria-hidden="true" />
          <span>No compartas contraseñas ni códigos de seguridad.</span>
          <span>Evita ingresar información financiera personal.</span>
        </p>
      </form>
      ) : null}
    </section>
    {lifecycleConfirmation ? (
      <div
        className="assistant-lifecycle-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeLifecycleConfirmation();
        }}
      >
        <section
          ref={lifecycleDialogRef}
          className="assistant-lifecycle-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby={lifecycleDialogTitleId}
          aria-describedby={lifecycleDialogDescriptionId}
        >
          <span className="assistant-lifecycle-dialog__icon" aria-hidden="true">
            {lifecycleConfirmation === "end" ? <LogOut /> : <RotateCcw />}
          </span>
          <div className="assistant-lifecycle-dialog__copy">
            <h2 id={lifecycleDialogTitleId}>
              {lifecycleConfirmation === "end"
                ? "¿Finalizar esta conversación?"
                : "¿Iniciar una conversación nueva?"}
            </h2>
            <p id={lifecycleDialogDescriptionId}>
              {lifecycleConfirmation === "end"
                ? "Se cerrará esta conversación y se conservará su historial. No se creará un ticket; si hay un borrador sin confirmar, se cancelará."
                : "La conversación actual permanecerá guardada. Abriremos una nueva para que puedas consultar otro tema desde el inicio."}
            </p>
          </div>
          <div className="assistant-lifecycle-dialog__actions">
            <button
              ref={lifecycleCancelRef}
              type="button"
              className="button button--secondary"
              onClick={closeLifecycleConfirmation}
            >
              {lifecycleConfirmation === "end" ? "Seguir conversando" : "Seguir aquí"}
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={chat.isPending || reset.isPending}
              onClick={
                lifecycleConfirmation === "end"
                  ? confirmEndConversation
                  : confirmRestartConversation
              }
            >
              {lifecycleConfirmation === "end"
                ? "Finalizar conversación"
                : "Reiniciar conversación"}
            </button>
          </div>
        </section>
      </div>
    ) : null}
    </>
  );
}

function GuideContent() {
  return (
    <>
      <ResponsiveImage
        name="human-support"
        alt="Asesor orientando a una persona en un espacio de atención reservado"
        className="assistant-guide__image"
      />
      <div className="assistant-guide__content">
        <span className="eyebrow">Orientación paso a paso</span>
        <h2>Cómo usar el asistente</h2>
        <ol>
          <li>
            <strong>1</strong>
            <span>Describe tu consulta con el contexto necesario.</span>
          </li>
          <li>
            <strong>2</strong>
            <span>Responde las aclaraciones para afinar la orientación.</span>
          </li>
          <li>
            <strong>3</strong>
            <span>Solicita seguimiento cuando la respuesta no sea suficiente.</span>
          </li>
        </ol>
        <p>
          El seguimiento no es un chat humano en tiempo real. Si conviertes la
          conversación en solicitud, el equipo continuará la atención por el
          canal correspondiente.
        </p>
      </div>
    </>
  );
}

export function AssistantGuide({ mobile = false }: { readonly mobile?: boolean }) {
  if (mobile) {
    return (
      <details className="assistant-guide assistant-guide--mobile">
        <summary>Cómo usar el asistente</summary>
        <GuideContent />
      </details>
    );
  }
  return (
    <aside className="assistant-guide" aria-label="Cómo usar el asistente">
      <GuideContent />
    </aside>
  );
}
