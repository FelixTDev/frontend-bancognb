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
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  api,
  type BotMessageResponse,
  type ChatbotConvertedTicketSummary,
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
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<readonly VisibleMessage[]>([]);
  const [value, setValue] = useState("");
  const [lastReply, setLastReply] = useState<BotMessageResponse | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
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
  const messagesRef = useRef<HTMLDivElement>(null);
  const conversionInFlightRef = useRef(false);
  const resumedPendingConversionRef = useRef<string | null>(null);
  const linkedConversationIdsRef = useRef(new Set<string>());
  const pendingLinkRequestsRef = useRef(new Map<string, Promise<void>>());
  const pendingRestoreRequestsRef = useRef(
    new Map<string, Promise<Conversation>>(),
  );
  const queryClient = useQueryClient();
  const ticketDraft = conversation?.ticket_draft ?? lastReply?.ticket_draft;
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
    enabled:
      authenticated &&
      Boolean(
        ticketDraft &&
          ticketDraft.status !== "INACTIVE" &&
          ticketDraft.status !== "CANCELLED",
      ),
  });

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
      content,
      appendUser,
    }: {
      readonly content: string;
      readonly appendUser: boolean;
    }) => {
      let activeConversation = conversation;
      if (!activeConversation) {
        activeConversation = await api.chat.create();
        saveActiveConversationId(activeConversation.id);
        clearPendingTicketConversion();
        setConversation(activeConversation);
      }
      const response = await api.chat.message(activeConversation.id, content);
      return { content, appendUser, response, conversation: activeConversation };
    },
    onMutate: ({ content, appendUser }) => {
      setError(null);
      setFailedReset(false);
      setEscalationMessage(null);
      if (appendUser) {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), content, sender: "user" },
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
      setFailedPrompt(null);
      setFeedback(null);
    },
    onError: (mutationError, variables) => {
      setError(errorDetails(mutationError, "conversation", authenticated));
      setFailedPrompt(variables.content);
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
      setFailedPrompt(null);
      setFailedReset(false);
      setError(null);
      setFeedback(null);
      setEscalationMessage(null);
      setRetryTicketPayload(null);
      setConversionConflict(false);
      setValue("");
    },
    onError: () => {
      setFailedReset(true);
      setFailedPrompt(null);
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
      if (!normalized || chat.isPending || isRestoring) return;
      chat.mutate({ content: normalized, appendUser });
    },
    [chat, isRestoring],
  );

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

  return (
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
          onClick={() => reset.mutate()}
          aria-label="Reiniciar conversación"
          title="Reiniciar conversación"
        >
          <RotateCcw aria-hidden="true" />
          <span className="assistant-panel__reset-label">Reiniciar</span>
        </Button>
      </header>

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

                      {ticketDraft ||
                      conversation?.converted_ticket ||
                      conversation?.status === "CONVERTED_TO_TICKET" ? (
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
                            if (conversation) {
                              saveActiveConversationId(conversation.id);
                            }
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
                      ) : null}

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
        ) : (
          <div className="assistant-welcome">
            <div className="assistant-welcome__intro">
              <span aria-hidden="true">
                <Bot />
              </span>
              <div>
                <h2>¿Qué necesitas resolver hoy?</h2>
                <p>
                  Hola, soy el asistente GNB. Elige un tema o cuéntame qué
                  necesitas.
                </p>
              </div>
            </div>
            <div className="assistant-topic-grid" role="group" aria-label="Temas de atención">
              {assistantTopics.map(({ label, prompt, Icon }) => (
                <button
                  type="button"
                  key={label}
                  disabled={isRestoring || chat.isPending}
                  onClick={() => submit(prompt)}
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
                    disabled={isRestoring || chat.isPending}
                    onClick={() => submit(question)}
                  >
                    {question}
                    <ChevronRight aria-hidden="true" />
                  </button>
                ))}
              </div>
            </details>
          </div>
        )}

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
            {failedPrompt ? (
              <Button
                variant="secondary"
                onClick={() => submit(failedPrompt, false)}
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

        {!lastReply &&
        conversation &&
        (ticketDraft ||
          conversation.converted_ticket ||
          conversation.status === "CONVERTED_TO_TICKET") ? (
          <AssistantTicketDraft
            conversationStatus={conversation.status}
            draft={ticketDraft}
            convertedTicket={conversation.converted_ticket}
            categories={categories.data}
            categoriesLoading={categories.isLoading}
            categoriesError={categories.isError}
            authenticated={authenticated}
            chatPending={chat.isPending}
            conversionPending={ticketConversion.isPending}
            conversionRetryAvailable={Boolean(retryTicketPayload)}
            conversionConflict={conversionConflict}
            onRequireAuth={() => saveActiveConversationId(conversation.id)}
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
        ) : null}
      </div>
      </div>

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
            rows={variant === "widget" ? 1 : 2}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Escribe tu consulta…"
            autoComplete="off"
            maxLength={10000}
            disabled={isRestoring}
          />
        </label>
        <Button
          type="submit"
          disabled={!value.trim() || chat.isPending || isRestoring}
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
    </section>
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
