import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Download,
  FilePlus2,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { ticketSchema, type TicketValues } from "../features/auth/validation";
import {
  AssistantConversation,
  AssistantGuide,
} from "../features/chat/assistant-conversation";
import {
  api,
  uploadAttachment,
  type ChatTicket,
  type Conversation,
  type Preference,
  type Profile,
} from "../shared/api/endpoints";
import { ApiError } from "../shared/api/http";
import { getAssistantRequestErrorMessage } from "../features/chat/assistant-conversation.model";
import {
  clearPendingTicketConversion,
  prepareTicketConversionReturn,
} from "../features/chat/assistant-conversation.storage";
import {
  Button,
  ButtonLink,
  PageIntro,
  PaginationControls,
  PriorityBadge,
  ResponsiveImage,
  Skeleton,
  StatePanel,
  StatusBadge,
} from "../shared/components/ui";
import { ticketPriorityLabels } from "../shared/ticket-labels";
import { FaqLibrary } from "../shared/components/faq-library";
import { FaqPageHero } from "../shared/components/faq-page-hero";
import { useModalFocus } from "../shared/hooks/use-modal-focus";
import type {
  PageResult,
  Ticket,
  TicketHistoryEntry,
  TicketStatus,
} from "../shared/types/domain";
import {
  allowedTicketTransitions,
  getHistoryActorLabel,
  getHistoryActionLabel,
  getHistoryValueLabel,
  getParticipantInitials,
  getParticipantLabel,
  getParticipantRoleKey,
  isTerminalTicket,
} from "./staff-operations.model";

const ticketsFrom = (
  data: readonly Ticket[] | PageResult<Ticket> | undefined,
): readonly Ticket[] => (data ? ("items" in data ? data.items : data) : []);
const pageTotal = <T,>(data: readonly T[] | PageResult<T> | undefined) =>
  data ? ("total" in data ? data.total : data.length) : 0;
const pageCount = <T,>(data: readonly T[] | PageResult<T> | undefined) =>
  data && "total" in data
    ? (data.total_pages ?? data.pages ?? Math.ceil(data.total / data.page_size))
    : 1;
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

const slaStatusLabels: Readonly<Record<string, string>> = {
  ACTIVE: "En curso",
  PAUSED: "En pausa",
  COMPLETED: "Finalizado",
  BREACHED: "Vencido",
  CANCELLED: "Cancelado",
};

function NewTicketLink({ label }: { readonly label: string }) {
  return (
    <ButtonLink
      className="client-create-request-link"
      to="/app/nueva-solicitud"
    >
      <Plus className="client-create-request-link__icon" aria-hidden="true" />
      {label}
    </ButtonLink>
  );
}

export function ClientDashboardPage() {
  const { session } = useAuth();
  const ticketQuery = useQuery({
    queryKey: ["tickets", "mine", "dashboard"],
    queryFn: () => api.tickets.mine({ page: 1, page_size: 6 }),
  });
  const tickets = ticketsFrom(ticketQuery.data);
  const activeStatuses = [
    "NUEVO",
    "ASIGNADO",
    "EN_PROCESO",
    "PENDIENTE_CLIENTE",
    "RESUELTO",
  ] as const;
  const statusCounts = useQueries({
    queries: activeStatuses.map((status) => ({
      queryKey: ["tickets", "mine", "count", status],
      queryFn: () => api.tickets.mine({ status, page: 1, page_size: 1 }),
    })),
  });
  const activeCount = statusCounts.reduce(
    (total, query) => total + pageTotal(query.data),
    0,
  );
  const pendingCount = pageTotal(statusCounts[3]?.data);
  return (
    <>
      <PageIntro
        className="client-page-intro"
        title={`Hola, ${session?.user.full_name.split(" ")[0] ?? ""}`}
        description="Aquí tienes el estado actual de tu atención."
        actions={<NewTicketLink label="Nueva solicitud" />}
      />
      <section className="dashboard-summary">
        <article>
          <span>Solicitudes activas</span>
          <strong>{activeCount}</strong>
          <p>En seguimiento o atención.</p>
        </article>
        <article>
          <span>Requieren tu atención</span>
          <strong>{pendingCount}</strong>
          <p>El equipo espera información.</p>
        </article>
        <article>
          <span>Última actualización</span>
          <strong className="dashboard-summary__date">
            {tickets[0] ? formatDate(tickets[0].updated_at) : "Sin actividad"}
          </strong>
          <p>De tus solicitudes recientes.</p>
        </article>
      </section>
      <section className="content-section">
        <div className="section-bar">
          <div>
            <h2>Actividad reciente</h2>
            <p>Continúa desde la última conversación.</p>
          </div>
          <Link to="/app/solicitudes">
            Ver todas <ChevronRight aria-hidden="true" />
          </Link>
        </div>
        {ticketQuery.isLoading ? (
          <Skeleton rows={5} />
        ) : ticketQuery.isError ? (
          <StatePanel
            kind="error"
            title="No pudimos cargar tus solicitudes"
            message="Revisa tu conexión e inténtalo nuevamente."
            actionLabel="Reintentar"
            onAction={() => void ticketQuery.refetch()}
          />
        ) : tickets.length ? (
          <TicketList tickets={tickets} basePath="/app/solicitudes" />
        ) : (
          <EmptyTickets />
        )}
      </section>
      <section className="dashboard-help">
        <ResponsiveImage
          name="guided-empty-state"
          alt="Escultura circular clara con un marcador azul al inicio del recorrido"
        />
        <div>
          <h2>¿No sabes por dónde empezar?</h2>
          <p>
            Consulta respuestas frecuentes o conversa con el asistente antes de
            registrar una solicitud.
          </p>
          <div>
            <ButtonLink to="/app/faq" variant="secondary">
              Ver preguntas
            </ButtonLink>
            <ButtonLink to="/app/asistente">Abrir asistente</ButtonLink>
          </div>
        </div>
      </section>
    </>
  );
}

export function ClientTicketsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const ticketQuery = useQuery({
    queryKey: ["tickets", "mine", search, status, page],
    queryFn: () => api.tickets.mine({ page, page_size: 20, search, status }),
  });
  const tickets = ticketsFrom(ticketQuery.data);
  return (
    <>
      <PageIntro
        className="client-page-intro"
        title="Mis solicitudes"
        description="Consulta el estado y continúa cada conversación."
        actions={<NewTicketLink label="Crear solicitud" />}
      />
      <div className="filters client-ticket-filters">
        <div className="client-ticket-filters__heading">
          <span className="client-ticket-filters__heading-icon">
            <SlidersHorizontal aria-hidden="true" />
          </span>
          <div>
            <h2>Encuentra tu solicitud</h2>
            <p>Busca por sus datos o filtra por estado.</p>
          </div>
        </div>
        <div className="client-ticket-filters__search">
          <label className="client-ticket-filters__label" htmlFor="client-ticket-search">
            Buscar solicitud
          </label>
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              id="client-ticket-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por código, asunto o descripción…"
              autoComplete="off"
              aria-describedby="ticket-search-help"
            />
          </div>
          <p id="ticket-search-help">
            Puedes usar el código, asunto, descripción o datos del cliente.
          </p>
        </div>
        <label className="client-ticket-filters__status">
          <span className="client-ticket-filters__label">Estado</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos los estados</option>
            <option value="NUEVO">Nuevo</option>
            <option value="ASIGNADO">Asignado</option>
            <option value="EN_PROCESO">En proceso</option>
            <option value="PENDIENTE_CLIENTE">Pendiente del cliente</option>
            <option value="RESUELTO">Resuelto</option>
            <option value="CERRADO">Cerrado</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </label>
      </div>
      {ticketQuery.isLoading ? (
        <Skeleton rows={7} />
      ) : ticketQuery.isError ? (
        <StatePanel
          kind="error"
          title="No pudimos consultar tus solicitudes"
          message="Inténtalo nuevamente."
          actionLabel="Reintentar"
          onAction={() => void ticketQuery.refetch()}
        />
      ) : tickets.length ? (
        <>
          <TicketList tickets={tickets} basePath="/app/solicitudes" />
          <PaginationControls
            page={page}
            totalPages={pageCount(ticketQuery.data)}
            total={pageTotal(ticketQuery.data)}
            onPageChange={setPage}
          />
        </>
      ) : (
        <StatePanel
          kind="empty"
          title={
            search || status
              ? "No encontramos solicitudes"
              : "Aún no tienes solicitudes"
          }
          message={
            search || status
              ? "Cambia los filtros para ampliar la búsqueda."
              : "Crea tu primera solicitud y podrás seguirla desde aquí."
          }
        />
      )}
    </>
  );
}

export function NewTicketPage() {
  const navigate = useNavigate();
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const form = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category_id: "",
      subject: "",
      description: "",
      priority: "MEDIA",
    },
  });
  const submit = form.handleSubmit(async (values) => {
    setApiError(null);
    try {
      const ticket = await api.tickets.create(values);
      void navigate(`/app/solicitudes/${ticket.id}/creada`, {
        state: { ticket },
      });
    } catch (error) {
      setApiError(
        error instanceof ApiError
          ? error.message
          : "No pudimos crear la solicitud.",
      );
    }
  });
  return (
    <>
      <PageIntro
        title="Crear solicitud"
        description="Comparte la información necesaria para que el equipo pueda orientarte."
      />
      <div className="form-layout">
        <form className="ticket-form" onSubmit={(event) => void submit(event)}>
          <fieldset>
            <legend>Datos de la solicitud</legend>
            <FormField
              label="Categoría"
              error={form.formState.errors.category_id?.message}
            >
              <select
                {...form.register("category_id")}
                disabled={categories.isLoading}
              >
                <option value="">Selecciona una categoría</option>
                {categories.data
                  ?.filter((category) => category.is_active)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </FormField>
            <FormField
              label="Asunto"
              error={form.formState.errors.subject?.message}
            >
              <input
                {...form.register("subject")}
                maxLength={200}
                placeholder="Ej.: No puedo consultar mi saldo…"
                autoComplete="off"
              />
            </FormField>
            <FormField
              label="Descripción"
              hint="No incluyas contraseñas, códigos de seguridad ni información innecesaria."
              error={form.formState.errors.description?.message}
            >
              <textarea
                {...form.register("description")}
                rows={8}
                maxLength={10_000}
                placeholder="Describe qué ocurrió y qué orientación necesitas…"
                autoComplete="off"
              />
            </FormField>
            <FormField
              label="Prioridad"
              hint="Selecciona urgente solo si la atención no puede esperar."
            >
              <select {...form.register("priority")}>
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </FormField>
          </fieldset>
          {apiError ? (
            <div className="form-error" role="alert">
              {apiError}
            </div>
          ) : null}
          <div className="form-actions">
            <Button
              type="button"
              variant="quiet"
              onClick={() => void navigate(-1)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={form.formState.isSubmitting}>
              Crear solicitud
            </Button>
          </div>
        </form>
        <aside className="context-help">
          <h2>Antes de enviar</h2>
          <ul>
            <li>Describe una sola necesidad por solicitud.</li>
            <li>Incluye fechas o referencias útiles.</li>
            <li>Podrás adjuntar archivos después de crearla.</li>
          </ul>
          <div>
            <Sparkles aria-hidden="true" />
            <p>
              Si aún no sabes qué categoría usar, el asistente puede orientarte.
            </p>
            <Link to="/app/asistente">Abrir asistente</Link>
          </div>
        </aside>
      </div>
    </>
  );
}

export function TicketCreatedPage() {
  const { id } = useParams();
  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.tickets.get(id ?? ""),
    enabled: Boolean(id),
  });
  return (
    <div className="created-page">
      <div className="created-page__mark">
        <CircleSuccess />
      </div>
      <h1>Solicitud creada</h1>
      <p>Tu solicitud ya forma parte de la cola de atención.</p>
      {ticketQuery.isLoading ? (
        <Skeleton rows={3} />
      ) : ticketQuery.data ? (
        <div className="created-summary">
          <span>Código de seguimiento</span>
          <strong>{ticketQuery.data.tracking_code}</strong>
          <StatusBadge status={ticketQuery.data.status} />
        </div>
      ) : null}
      <div className="created-page__actions">
        <ButtonLink to={`/app/solicitudes/${id}`}>Ver detalle</ButtonLink>
        <ButtonLink to="/app/solicitudes" variant="secondary">
          Ir a mis solicitudes
        </ButtonLink>
      </div>
    </div>
  );
}

const CircleSuccess = () => <Check aria-hidden="true" />;

export function TicketDetailPage({
  basePath = "/app/solicitudes",
}: {
  readonly basePath?: string;
}) {
  const { id } = useParams();
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ticketQuery = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => api.tickets.get(id ?? ""),
    enabled: Boolean(id),
    retry: false,
  });
  const ticketAccessConfirmed = Boolean(
    id && ticketQuery.isSuccess && !ticketQuery.isFetching && ticketQuery.data,
  );
  const commentsQuery = useQuery({
    queryKey: ["ticket", id, "comments"],
    queryFn: () => api.tickets.comments(id ?? ""),
    enabled: ticketAccessConfirmed,
    retry: false,
  });
  const attachmentsQuery = useQuery({
    queryKey: ["ticket", id, "attachments"],
    queryFn: () => api.tickets.attachments(id ?? ""),
    enabled: ticketAccessConfirmed,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: ["ticket", id, "history"],
    queryFn: () => api.tickets.history(id ?? ""),
    enabled: ticketAccessConfirmed,
    retry: false,
  });
  const slaQuery = useQuery({
    queryKey: ["ticket", id, "sla"],
    queryFn: () => api.tickets.sla(id ?? ""),
    enabled: ticketAccessConfirmed,
    retry: false,
  });
  const commentMutation = useMutation({
    mutationFn: () =>
      api.tickets.comment(id ?? "", comment, ticketQuery.data?.version),
    onSuccess: async () => {
      setComment("");
      await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    },
  });
  const onFile = async (file: File | undefined) => {
    if (!file || !id || !ticketAccessConfirmed) return;
    setAttachmentError(null);
    setUploadProgress(0);
    try {
      await uploadAttachment(id, file, setUploadProgress);
      await attachmentsQuery.refetch();
    } catch (error) {
      setAttachmentError(
        error instanceof ApiError
          ? error.message
          : "No pudimos adjuntar el archivo.",
      );
    } finally {
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const downloadAttachment = async (attachment: {
    readonly id: string;
    readonly original_filename: string;
  }) => {
    setAttachmentError(null);
    try {
      const result = await api.tickets.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(result.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.original_filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAttachmentError(
        error instanceof ApiError
          ? error.message
          : "No pudimos descargar el archivo.",
      );
    }
  };
  if (ticketQuery.isLoading) return <Skeleton rows={9} />;
  if (ticketQuery.isError) {
    const error = ticketQuery.error;
    const forbidden = error instanceof ApiError && error.status === 403;
    const notFound = error instanceof ApiError && error.status === 404;
    const networkError =
      !(error instanceof ApiError) || error.status === 0;
    const returnLabel =
      basePath === "/app/solicitudes"
        ? "Volver a mis solicitudes"
        : "Volver a la bandeja";
    return (
      <StatePanel
        kind={forbidden ? "forbidden" : "error"}
        title={
          forbidden
            ? "No tienes acceso a esta solicitud"
            : notFound
              ? "No encontramos esta solicitud"
              : networkError
                ? "No pudimos conectar con el servicio"
                : "No pudimos abrir la solicitud"
        }
        message={
          forbidden
            ? "Tu perfil no puede consultar esta solicitud. Vuelve a la bandeja para continuar."
            : notFound
              ? "No encontramos una solicitud con este identificador."
              : networkError
                ? "Comprueba tu conexión e inténtalo nuevamente."
                : "Ocurrió un problema al cargar la solicitud. Inténtalo nuevamente."
        }
        actionLabel={forbidden || notFound ? returnLabel : "Reintentar"}
        onAction={() => {
          if (forbidden || notFound) {
            void navigate(basePath, { replace: true });
            return;
          }
          void ticketQuery.refetch();
        }}
      />
    );
  }
  if (!ticketQuery.data)
    return (
      <StatePanel
        kind="error"
        title="No pudimos abrir la solicitud"
        message="Inténtalo nuevamente desde la bandeja."
        actionLabel="Reintentar"
        onAction={() => void ticketQuery.refetch()}
      />
    );
  const ticket = ticketQuery.data;
  const terminal = ["CERRADO", "CANCELADO"].includes(ticket.status);
  const isClientPortal = basePath === "/app/solicitudes";
  const ticketDetailClass = isClientPortal
    ? "client-ticket-detail"
    : "staff-ticket-detail";
  const ticketIntroClass = isClientPortal
    ? "client-page-intro"
    : "staff-ticket-page-intro";
  return (
    <>
      <Link className="back-link" to={basePath}>
        Volver a solicitudes
      </Link>
      <div className={ticketDetailClass}>
        <PageIntro
          className={ticketIntroClass}
          title={ticket.subject}
          description={ticket.tracking_code}
          actions={
            <dl
              className={
                isClientPortal ? "client-ticket-facts" : "staff-ticket-facts"
              }
            >
              <div>
                <dt>Prioridad</dt>
                <dd>
                  <PriorityBadge priority={ticket.priority} />
                </dd>
              </div>
              <div>
                <dt>Estado</dt>
                <dd>
                  <StatusBadge status={ticket.status} />
                </dd>
              </div>
            </dl>
          }
        />
        <div className="ticket-detail">
          <div className="ticket-detail__main">
            <section className="detail-panel">
              <h2>Descripción</h2>
              <p className="ticket-description">{ticket.description}</p>
              <dl>
                <div>
                <dt>Cliente</dt>
                <dd>{ticket.client_name?.trim() || "Cliente"}</dd>
              </div>
              <div>
                <dt>Asesor responsable</dt>
                <dd>
                  {ticket.assigned_advisor_name?.trim() ||
                    (ticket.assigned_advisor_id
                      ? "Asesor asignado"
                      : "Sin responsable")}
                </dd>
              </div>
              <div>
                  <dt>Creada</dt>
                  <dd>{formatDate(ticket.created_at)}</dd>
                </div>
                <div>
                  <dt>Última actualización</dt>
                  <dd>{formatDate(ticket.updated_at)}</dd>
                </div>
                <div>
                  <dt>Origen</dt>
                  <dd>
                    {ticket.source === "CHATBOT"
                      ? "Asistente digital"
                      : "Registro manual"}
                  </dd>
                </div>
              </dl>
            </section>
            <section className="conversation">
              <div className="section-bar">
                <div>
                  <h2>Conversación</h2>
                  <p>
                    La información compartida quedará asociada a la solicitud.
                  </p>
                </div>
              </div>
              {commentsQuery.isLoading ? (
                <Skeleton rows={4} />
              ) : commentsQuery.data?.length ? (
                <div className="messages">
                  {commentsQuery.data.map((item) => (
                    <article key={item.id}>
                      <span
                        className={`message-avatar message-avatar--${getParticipantRoleKey(item.author_role)}`}
                        aria-hidden="true"
                      >
                        {getParticipantInitials(
                          item.author_role,
                          item.author_name,
                        )}
                      </span>
                      <div className="message-content">
                        <div className="message-header">
                          <strong>
                            {getParticipantLabel(
                              item.author_role,
                              item.author_name,
                            )}
                          </strong>
                          <time dateTime={item.created_at}>
                            {formatDate(item.created_at)}
                          </time>
                        </div>
                        <p>{item.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Aún no hay comentarios.</p>
              )}
              <form
                className="comment-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (comment.trim()) commentMutation.mutate();
                }}
              >
                <label>
                  <span className="sr-only">Agregar comentario</span>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    autoComplete="off"
                    placeholder={
                      terminal
                        ? "Esta solicitud está cerrada para nuevos comentarios."
                        : "Escribe una actualización o respuesta"
                    }
                    disabled={terminal}
                  />
                </label>
                <Button
                  className="comment-form__submit"
                  type="submit"
                  isLoading={commentMutation.isPending}
                  disabled={!comment.trim() || terminal}
                >
                  <span className="comment-form__submit-content">
                    <Send aria-hidden="true" />
                    Enviar comentario
                  </span>
                </Button>
              </form>
            </section>
          </div>
          <aside className="ticket-detail__side">
            {session?.user.role !== "CLIENTE" ? (
              <StaffActions
                ticket={ticket}
                role={
                  session?.user.role === "SUPERVISOR" ? "SUPERVISOR" : "ASESOR"
                }
                onChanged={async () => {
                  await queryClient.invalidateQueries({
                    queryKey: ["ticket", id],
                  });
                }}
              />
            ) : null}
            <section className="detail-panel">
              <h2>Tiempo de atención</h2>
              {slaQuery.isLoading ? (
                <Skeleton rows={3} />
              ) : slaQuery.data ? (
                <>
                  <strong
                    className={`sla-status sla-status--${slaQuery.data.status.toLowerCase()}`}
                  >
                    {slaStatusLabels[slaQuery.data.status] ??
                      slaQuery.data.status}
                  </strong>
                  <p>
                    {slaQuery.data.resolution_due_at
                      ? `Resolución prevista: ${formatDate(slaQuery.data.resolution_due_at)}`
                      : "El tiempo se calcula según la política aplicable."}
                  </p>
                </>
              ) : (
                <p>No hay información de SLA.</p>
              )}
            </section>
            <section className="detail-panel">
              <div className="section-bar">
                <h2>Adjuntos</h2>
                <button
                  className="icon-button"
                  aria-label="Adjuntar archivo"
                  onClick={() => fileInput.current?.click()}
                  disabled={terminal}
                >
                  <Paperclip aria-hidden="true" />
                </button>
              </div>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.gif,.txt"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              {uploadProgress !== null ? (
                <div className="upload-progress" role="status">
                  <span style={{ width: `${uploadProgress}%` }} />
                  <p>Cargando archivo: {uploadProgress}%</p>
                </div>
              ) : null}
              {attachmentError ? (
                <div className="form-error" role="alert">
                  {attachmentError}
                </div>
              ) : null}
              {attachmentsQuery.data?.length ? (
                <ul className="attachment-list">
                  {attachmentsQuery.data.map((attachment) => (
                    <li key={attachment.id}>
                      <FilePlus2 aria-hidden="true" />
                      <span>
                        {attachment.original_filename}
                        <small>
                          {Math.round(attachment.file_size / 1024)} KB
                        </small>
                      </span>
                      <button
                        aria-label={`Descargar ${attachment.original_filename}`}
                        onClick={() => void downloadAttachment(attachment)}
                      >
                        <Download aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No hay archivos adjuntos.</p>
              )}
            </section>
            <section className="detail-panel">
              <h2>Historial</h2>
              {historyQuery.isLoading ? (
                <Skeleton rows={4} />
              ) : (
                <HistoryView value={historyQuery.data} />
              )}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function StaffActions({
  ticket,
  role,
  onChanged,
}: {
  readonly ticket: Ticket;
  readonly role: "ASESOR" | "SUPERVISOR";
  readonly onChanged: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [advisorId, setAdvisorId] = useState("");
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const advisors = useQuery({
    queryKey: ["advisors"],
    queryFn: api.users.advisors,
    enabled: role === "SUPERVISOR",
  });
  const action = useMutation({
    mutationFn: async (
      kind: "take" | "release" | "status" | "assign" | "pause" | "resume",
    ) => {
      if (kind === "take") return api.tickets.take(ticket.id, ticket.version);
      if (kind === "release")
        return api.tickets.release(ticket.id, reason.trim(), ticket.version);
      if (kind === "assign")
        return api.tickets.assign(ticket.id, advisorId, ticket.version);
      if (kind === "pause") return api.tickets.pauseSla(ticket.id, reason);
      if (kind === "resume") return api.tickets.resumeSla(ticket.id, reason);
      if (!status) throw new Error("Selecciona el nuevo estado.");
      return api.tickets.changeStatus(
        ticket.id,
        status,
        reason.trim() || undefined,
        ticket.version,
      );
    },
    onSuccess: async (updated, kind) => {
      if (kind === "release" && role === "ASESOR") {
        queryClient.removeQueries({ queryKey: ["ticket", ticket.id] });
        void navigate("/asesor/panel", {
          replace: true,
          state: {
            ticketReleaseNotice:
              "El ticket volvió a Disponible y quedó sin responsable.",
          },
        });
        return;
      }
      if (kind === "pause" || kind === "resume") {
        await queryClient.invalidateQueries({
          queryKey: ["ticket", ticket.id, "sla"],
        });
      } else {
        queryClient.setQueryData(["ticket", ticket.id], updated);
      }
      await onChanged();
    },
    onError: async (error) => {
      if (error instanceof ApiError && error.status === 409) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] }),
          queryClient.invalidateQueries({ queryKey: ["operations"] }),
          queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        ]);
      }
    },
  });
  const terminal = isTerminalTicket(ticket);
  const ownsTicket = ticket.assigned_advisor_id === session?.user.id;
  const canTake =
    role === "ASESOR" &&
    ticket.status === "NUEVO" &&
    ticket.assigned_advisor_id === null;
  const canRelease =
    !terminal &&
    ticket.assigned_advisor_id !== null &&
    (role === "SUPERVISOR" || ownsTicket);
  const statusOptions = (allowedTicketTransitions[ticket.status] ?? []).filter(
    (next) =>
      (role === "SUPERVISOR" || next !== "CANCELADO") && next !== "ASIGNADO",
  );
  const actionError =
    action.error instanceof ApiError
      ? action.error.status === 403
        ? "No tienes permisos para realizar esta acción."
        : action.error.status === 409
          ? "El ticket cambió. Actualizamos la información; revisa el nuevo estado antes de continuar."
          : action.error.status === 0
            ? "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente."
            : action.error.message
      : (action.error?.message ?? "No pudimos completar la acción.");
  const requiresStatusReason =
    status === "CANCELADO" ||
    (ticket.status === "RESUELTO" && status === "EN_PROCESO");
  const showReason =
    !terminal && (role === "SUPERVISOR" || canRelease || requiresStatusReason);
  const reasonLabel =
    status === "CANCELADO"
      ? "Motivo de cancelación"
      : ticket.status === "RESUELTO" && status === "EN_PROCESO"
        ? "Motivo de reapertura"
        : role === "SUPERVISOR" && canRelease
          ? "Motivo para liberar globalmente"
          : canRelease
            ? "Motivo para liberar"
            : "Motivo o nota operativa";

  const confirmCritical = (kind: "release" | "status" | "assign") => {
    const targetStatus = kind === "status" ? status : null;
    if (
      kind === "release" &&
      !window.confirm(
        `¿Confirmas liberar ${ticket.tracking_code}? El historial se conservará.`,
      )
    )
      return;
    if (
      kind === "assign" &&
      !window.confirm(
        `¿Confirmas asignar ${ticket.tracking_code} al asesor seleccionado?`,
      )
    )
      return;
    if (targetStatus && ["CERRADO", "CANCELADO"].includes(targetStatus)) {
      if (
        !window.confirm(
          `¿Confirmas marcar ${ticket.tracking_code} como ${targetStatus === "CERRADO" ? "cerrado" : "cancelado"}?`,
        )
      )
        return;
    }
    action.mutate(kind);
  };

  return (
    <section className="detail-panel operation-actions">
      <h2>Acciones operativas</h2>
      {canTake ? (
        <Button
          onClick={() => action.mutate("take")}
          isLoading={action.isPending}
        >
          Tomar ticket
        </Button>
      ) : null}
      {role === "SUPERVISOR" && !terminal ? (
        <label className="field">
          <span>Asignar o reasignar</span>
          <select
            value={advisorId}
            onChange={(event) => setAdvisorId(event.target.value)}
          >
            <option value="">Selecciona un asesor</option>
            {advisors.data?.map((advisor) => (
              <option key={advisor.id} value={advisor.id}>
                {advisor.full_name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {role === "SUPERVISOR" && !terminal ? (
        <Button
          variant="secondary"
          disabled={!advisorId || action.isPending}
          isLoading={action.isPending && action.variables === "assign"}
          onClick={() => confirmCritical("assign")}
        >
          Asignar o reasignar
        </Button>
      ) : null}
      {!terminal && statusOptions.length ? (
        <>
          <label className="field">
            <span>Cambiar estado</span>
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as TicketStatus | "")
              }
            >
              <option value="">Selecciona una transición</option>
              {statusOptions.map((next) => (
                <option key={next} value={next}>
                  {next === "CERRADO"
                    ? "Cerrado"
                    : next === "CANCELADO"
                      ? "Cancelado"
                      : next === "PENDIENTE_CLIENTE"
                        ? "Esperando al cliente"
                        : next === "EN_PROCESO"
                          ? "En atención"
                          : next === "RESUELTO"
                            ? "Resuelto por cerrar"
                            : "Por atender"}
                </option>
              ))}
            </select>
          </label>
          {status ? (
            <Button
              disabled={
                action.isPending || (requiresStatusReason && !reason.trim())
              }
              isLoading={action.isPending && action.variables === "status"}
              onClick={() => confirmCritical("status")}
            >
              Actualizar estado
            </Button>
          ) : null}
        </>
      ) : null}
      {showReason ? (
        <label className="field">
          <span>{reasonLabel}</span>
          <textarea
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Indica el motivo requerido para esta acción…"
            autoComplete="off"
          />
        </label>
      ) : null}
      <div className="button-stack">
        {canRelease ? (
          <Button
            variant="quiet"
            disabled={!reason.trim() || action.isPending}
            isLoading={action.isPending && action.variables === "release"}
            onClick={() => confirmCritical("release")}
          >
            {role === "SUPERVISOR"
              ? "Liberar ticket globalmente"
              : "Liberar ticket"}
          </Button>
        ) : null}
        {role === "SUPERVISOR" && !terminal ? (
          <>
            <Button
              variant="quiet"
              disabled={!reason.trim() || action.isPending}
              onClick={() => action.mutate("pause")}
            >
              Pausar SLA
            </Button>
            <Button
              variant="quiet"
              disabled={!reason.trim() || action.isPending}
              onClick={() => action.mutate("resume")}
            >
              Reanudar SLA
            </Button>
          </>
        ) : null}
      </div>
      {terminal ? (
        <p className="form-notice">
          Este ticket está{" "}
          {ticket.status === "CERRADO" ? "cerrado" : "cancelado"}; las acciones
          operativas están deshabilitadas.
        </p>
      ) : null}
      {role === "ASESOR" && ticket.assigned_advisor_id && !ownsTicket ? (
        <p className="form-notice">Este ticket pertenece a otro asesor.</p>
      ) : null}
      {action.error ? (
        <p className="form-error" role="alert">
          {actionError}
          {action.error instanceof ApiError && action.error.status === 0 ? (
            <button
              type="button"
              onClick={() => {
                if (action.variables) action.mutate(action.variables);
              }}
            >
              Reintentar
            </button>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function HistoryView({
  value,
}: {
  readonly value: readonly TicketHistoryEntry[] | undefined;
}) {
  const items = value ?? [];
  return items.length ? (
    <ol className="timeline">
      {items.map((row) => {
        const statusTransition = row.action.toUpperCase() === "STATUS_CHANGED";
        const oldStatus = getHistoryValueLabel(row.old_value);
        const newStatus = getHistoryValueLabel(row.new_value);
        const actor = getHistoryActorLabel(row.actor_role, row.actor_name);
        const context = statusTransition
          ? null
          : row.description?.trim() || null;
        return (
          <li key={row.id}>
            <span />
            <div>
              <strong>{getHistoryActionLabel(row.action)}</strong>
              {statusTransition && (oldStatus || newStatus) ? (
                <p className="history-transition">
                  {oldStatus || "Estado anterior no disponible"} → {newStatus || "Estado nuevo no disponible"}
                </p>
              ) : null}
              {context ? <p>{context}</p> : null}
              {actor ? <small className="history-actor">Por {actor}</small> : null}
              <time dateTime={row.created_at}>{formatDate(row.created_at)}</time>
            </div>
          </li>
        );
      })}
    </ol>
  ) : (
    <p className="muted">Sin eventos adicionales.</p>
  );
}

export function ClientFaqPage() {
  return (
    <div className="client-faq-page">
      <FaqPageHero
        title="Preguntas frecuentes"
        description="Encuentra orientación del equipo de atención para resolver tus dudas."
      />
      <FaqLibrary audience="client" />
    </div>
  );
}

export function ChatbotPage() {
  const [conversion, setConversion] = useState<{
    readonly conversation: Conversation;
    readonly description: string;
  } | null>(null);
  const onConvert = useCallback(
    (conversation: Conversation, description: string) => {
      setConversion({ conversation, description });
    },
    [],
  );
  const closeConversion = useCallback(() => {
    if (conversion) {
      clearPendingTicketConversion(conversion.conversation.id);
    }
    setConversion(null);
  }, [conversion]);
  return (
    <>
      <PageIntro
        title="Asistente digital"
        description="Obtén orientación en la base de conocimiento y solicita seguimiento cuando la respuesta no sea suficiente."
      />
      <div className="assistant-page-layout">
        <AssistantConversation
          authenticated
          onConvert={onConvert}
        />
        <AssistantGuide />
      </div>
      <AssistantGuide mobile />
      {conversion ? (
        <ConvertConversationDialog
          conversation={conversion.conversation}
          description={conversion.description}
          onClose={closeConversion}
        />
      ) : null}
    </>
  );
}

function ConvertConversationDialog({
  conversation,
  description,
  onClose,
}: {
  readonly conversation: Conversation;
  readonly description: string;
  readonly onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const dialogRef = useModalFocus<HTMLElement>(onClose);
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
  });
  const [apiError, setApiError] = useState<string | null>(null);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [draft, setDraft] = useState<TicketValues | null>(null);
  const [createdTicket, setCreatedTicket] = useState<ChatTicket | null>(null);
  const confirmationInFlight = useRef(false);
  const form = useForm<TicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category_id: "",
      subject: "Consulta iniciada en el asistente",
      description,
      priority: "MEDIA",
    },
  });

  const conversion = useMutation({
    mutationFn: (values: TicketValues) =>
      api.chat.convert(conversation.id, values),
    onSuccess: async (ticket) => {
      clearPendingTicketConversion(conversation.id);
      setCreatedTicket(ticket);
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) {
        prepareTicketConversionReturn(conversation.id);
      }
      setApiError(
        getAssistantRequestErrorMessage(
          error instanceof ApiError ? error.status : -1,
          "ticket",
          error instanceof ApiError ? error.message : undefined,
        ),
      );
    },
  });

  const review = form.handleSubmit((values) => {
    setApiError(null);
    setDraft(values);
    setStep("review");
  });

  const confirmCreation = () => {
    if (!draft || confirmationInFlight.current || conversion.isPending) return;
    confirmationInFlight.current = true;
    conversion.mutate(draft, {
      onSettled: () => {
        confirmationInFlight.current = false;
      },
    });
  };

  const close = () => {
    clearPendingTicketConversion(conversation.id);
    onClose();
  };

  const selectedCategory = categories.data
    ?.filter((category) => category.is_active)
    .find((category) => category.id === draft?.category_id);

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={close}>
      <section
        ref={dialogRef}
        className="editor-dialog assistant-ticket-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="convert-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-dialog__head">
          <div>
            <span className="eyebrow">Conversación del asistente</span>
            <h2 id="convert-title">
              {createdTicket
                ? "Solicitud creada"
                : step === "review"
                  ? "Revisa la solicitud"
                  : "Crear solicitud"}
            </h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={close}
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {createdTicket ? (
          <div className="assistant-ticket-success" role="status">
            <span>Código de seguimiento</span>
            <strong>{createdTicket.tracking_code}</strong>
            <p>Guardamos tu solicitud y su contexto para continuar la atención.</p>
            <div className="form-actions">
              <Button type="button" variant="quiet" onClick={close}>
                Cerrar
              </Button>
              <ButtonLink to={`/app/solicitudes/${createdTicket.id}`}>
                Ver detalle de la solicitud
              </ButtonLink>
            </div>
          </div>
        ) : step === "review" && draft ? (
          <div className="assistant-ticket-review">
            <p>Confirma los datos. La solicitud se enviará después de esta acción.</p>
            <dl>
              <div>
                <dt>Categoría</dt>
                <dd>{selectedCategory?.name ?? draft.category_id}</dd>
              </div>
              <div>
                <dt>Asunto</dt>
                <dd>{draft.subject}</dd>
              </div>
              <div>
                <dt>Descripción</dt>
                <dd>{draft.description}</dd>
              </div>
              <div>
                <dt>Prioridad</dt>
                <dd>{ticketPriorityLabels[draft.priority]}</dd>
              </div>
            </dl>
            {apiError ? (
              <div className="form-error" role="alert">
                {apiError}
              </div>
            ) : null}
            <div className="form-actions">
              <Button
                type="button"
                variant="quiet"
                disabled={conversion.isPending}
                onClick={() => {
                  setApiError(null);
                  setStep("edit");
                }}
              >
                Editar solicitud
              </Button>
              <Button
                type="button"
                disabled={conversion.isPending}
                isLoading={conversion.isPending}
                onClick={confirmCreation}
              >
                Confirmar creación de solicitud
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void review(event)}>
            <FormField
              label="Categoría"
              error={form.formState.errors.category_id?.message}
            >
              <select
                {...form.register("category_id")}
                autoFocus
                disabled={categories.isLoading || categories.isError}
              >
                <option value="">
                  {categories.isLoading
                    ? "Cargando categorías…"
                    : "Selecciona una categoría"}
                </option>
                {categories.data
                  ?.filter((category) => category.is_active)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </FormField>
            {categories.isError ? (
              <div className="form-error" role="alert">
                No pudimos cargar las categorías. Inténtalo nuevamente.
              </div>
            ) : null}
            <FormField
              label="Asunto"
              error={form.formState.errors.subject?.message}
            >
              <input
                {...form.register("subject")}
                maxLength={200}
                autoComplete="off"
              />
            </FormField>
            <FormField
              label="Descripción"
              hint="Revisa el contexto de la conversación y elimina cualquier contraseña, código de seguridad o dato bancario."
              error={form.formState.errors.description?.message}
            >
              <textarea
                {...form.register("description")}
                rows={8}
                maxLength={10_000}
                autoComplete="off"
              />
            </FormField>
            <FormField label="Prioridad">
              <select {...form.register("priority")}>
                <option value="BAJA">Baja</option>
                <option value="MEDIA">Media</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </FormField>
            {apiError ? (
              <div className="form-error" role="alert">
                {apiError}
              </div>
            ) : null}
            <div className="form-actions">
              <Button type="button" variant="quiet" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit" disabled={categories.isError}>
                Revisar resumen
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export function ProfilePage() {
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: api.users.profile,
  });
  const preferences = useQuery({
    queryKey: ["preferences"],
    queryFn: api.users.preferences,
  });
  const profileMutation = useMutation({
    mutationFn: (body: Partial<Profile>) => api.users.updateProfile(body),
    onSuccess: (data) => queryClient.setQueryData(["profile"], data),
  });
  const preferenceMutation = useMutation({
    mutationFn: (body: Partial<Preference>) =>
      api.users.updatePreferences(body),
    onSuccess: (data) => queryClient.setQueryData(["preferences"], data),
  });
  if (profile.isLoading || preferences.isLoading) return <Skeleton rows={8} />;
  return (
    <>
      <PageIntro
        title="Perfil y preferencias"
        description="Mantén tus datos de contacto y la forma en que deseas recibir novedades."
      />
      <div className="settings-grid">
        <section className="detail-panel">
          <Settings2 aria-hidden="true" />
          <h2>Datos personales</h2>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              const fullName = formData.get("full_name");
              const phone = formData.get("phone");
              profileMutation.mutate({
                full_name: typeof fullName === "string" ? fullName : "",
                phone: typeof phone === "string" ? phone : "",
              });
            }}
          >
            <FormField label="Nombre completo">
              <input
                name="full_name"
                autoComplete="name"
                defaultValue={profile.data?.full_name}
              />
            </FormField>
            <FormField label="Correo">
              <input
                value={profile.data?.email ?? ""}
                autoComplete="email"
                disabled
              />
            </FormField>
            <FormField label="Teléfono">
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={profile.data?.phone ?? ""}
              />
            </FormField>
            <Button type="submit" isLoading={profileMutation.isPending}>
              Guardar datos
            </Button>
          </form>
        </section>
        <section className="detail-panel">
          <Settings2 aria-hidden="true" />
          <h2>Notificaciones</h2>
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.data?.in_app_notifications ?? true}
              onChange={(event) =>
                preferenceMutation.mutate({
                  in_app_notifications: event.target.checked,
                })
              }
            />
            <span />
            Notificaciones dentro del portal
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.data?.email_notifications ?? true}
              onChange={(event) =>
                preferenceMutation.mutate({
                  email_notifications: event.target.checked,
                })
              }
            />
            <span />
            Notificaciones por correo
          </label>
        </section>
      </div>
    </>
  );
}

function TicketList({
  tickets,
  basePath,
}: {
  readonly tickets: readonly Ticket[];
  readonly basePath: string;
}) {
  return (
    <div className="ticket-list client-ticket-list">
      {tickets.map((ticket) => (
        <Link key={ticket.id} to={`${basePath}/${ticket.id}`}>
          <div className="ticket-list__code">
            <strong>{ticket.tracking_code}</strong>
            <time dateTime={ticket.updated_at}>
              {formatDate(ticket.updated_at)}
            </time>
          </div>
          <div className="ticket-list__subject">
            <h3>{ticket.subject}</h3>
            <p>{ticket.description}</p>
          </div>
          <div className="ticket-list__signals">
            <span className="sr-only">Prioridad: </span>
            <PriorityBadge priority={ticket.priority} />
            <span className="sr-only">Estado: </span>
            <StatusBadge status={ticket.status} />
          </div>
          <ChevronRight aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

function EmptyTickets() {
  return (
    <div className="empty-illustrated">
      <ResponsiveImage
        name="guided-empty-state"
        alt="Escultura circular clara con un marcador azul al inicio del recorrido"
      />
      <div>
        <h2>Aún no tienes solicitudes</h2>
        <p>
          Cuando necesites orientación, crea una solicitud y sigue cada
          actualización desde aquí.
        </p>
        <ButtonLink to="/app/nueva-solicitud">Crear solicitud</ButtonLink>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  error,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {error ? (
        <small className="field__error" role="alert">
          {error}
        </small>
      ) : hint ? (
        <small>{hint}</small>
      ) : null}
    </label>
  );
}
