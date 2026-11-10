import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  History,
  LockKeyhole,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { api, uploadAttachment, type SlaInfo } from "../shared/api/endpoints";
import { ApiError } from "../shared/api/http";
import {
  Button,
  PageIntro,
  PriorityBadge,
  Skeleton,
  StatePanel,
  StatusBadge,
} from "../shared/components/ui";
import type {
  Attachment,
  Category,
  Comment,
  Ticket,
  TicketHistoryEntry,
  TicketStatus,
} from "../shared/types/domain";
import {
  allowedTicketTransitions,
  getHistoryActionLabel,
  getHistoryActorLabel,
  getHistoryValueLabel,
  getParticipantInitials,
  getParticipantLabel,
  getParticipantRoleLabel,
  isTerminalTicket,
} from "./staff-operations.model";
import "./staff-operations.css";

type StaffRole = "ASESOR" | "SUPERVISOR";
type OperationKind = "assign" | "status" | "release" | "pause" | "resume";
interface OperationInput {
  readonly kind: OperationKind;
  readonly version: number;
  readonly status?: TicketStatus;
  readonly advisorId?: string;
  readonly reason?: string;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "No informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No informado"
    : new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(date);
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "No tienes permiso para consultar esta información.";
    if (error.status === 404) return "La información solicitada ya no está disponible.";
    if (error.status === 409) return "El ticket cambió mientras lo atendías. Actualiza la información antes de continuar.";
    if (error.status === 0) return "No pudimos conectar con el servicio. Revisa tu conexión.";
    return error.message;
  }
  return "No pudimos completar la solicitud. Inténtalo nuevamente.";
}

function isStatus(error: unknown, status: number): boolean {
  return error instanceof ApiError && error.status === status;
}

function ReadError({
  error,
  onRetry,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const status = error instanceof ApiError ? error.status : 0;
  const forbidden = status === 403;
  return (
    <div className="staff-detail-error" role="alert">
      <AlertCircle aria-hidden="true" />
      <div>
        <strong>
          {forbidden
            ? "Acceso no disponible"
            : status === 404
              ? "Información no encontrada"
              : status === 409
                ? "Información desactualizada"
                : status === 0
                  ? "Sin conexión con el servicio"
                  : "No pudimos cargar esta información"}
        </strong>
        <p>{errorMessage(error)}</p>
      </div>
      {!forbidden && status !== 404 ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Reintentar consulta
        </Button>
      ) : null}
    </div>
  );
}

function SlaStatusLabel({ value }: { readonly value: string }) {
  const labels: Readonly<Record<string, string>> = {
    ACTIVE: "En curso",
    PAUSED: "En pausa",
    COMPLETED: "Completado",
    BREACHED: "Vencido",
    CANCELLED: "Cancelado",
  };
  return <>{labels[value] ?? "Estado no informado"}</>;
}

function InfoSection({
  title,
  icon,
  aside,
  children,
  className = "",
}: {
  readonly title: string;
  readonly icon: React.ReactNode;
  readonly aside?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={`staff-detail-section ${className}`.trim()}>
      <header className="staff-detail-section__header">
        <h2>
          <span aria-hidden="true">{icon}</span>
          {title}
        </h2>
        {aside ? <div>{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

function TicketHistory({
  entries,
  isLoading,
  error,
  onRetry,
}: {
  readonly entries: readonly TicketHistoryEntry[] | undefined;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  const sortedEntries = useMemo(
    () =>
      [...(entries ?? [])].sort(
        (left, right) => Date.parse(right.created_at) - Date.parse(left.created_at),
      ),
    [entries],
  );
  const releaseReasons = useMemo(
    () => new Set((entries ?? [])
      .filter((entry) => entry.action.toUpperCase() === "RELEASED")
      .map((entry) => entry.description?.trim())
      .filter((description): description is string => Boolean(description))),
    [entries],
  );

  if (isLoading) return <Skeleton rows={3} />;
  if (error) return <ReadError error={error} onRetry={onRetry} />;
  if (!sortedEntries.length) {
    return (
      <p className="staff-detail-empty">Todavía no hay eventos en el historial.</p>
    );
  }

  return (
    <ol className="staff-detail-timeline">
      {sortedEntries.map((entry) => {
        const isTransition = entry.action.toUpperCase() === "STATUS_CHANGED";
        const oldValue = getHistoryValueLabel(entry.old_value);
        const newValue = getHistoryValueLabel(entry.new_value);
        const description = entry.description?.trim() ?? "";
        const isGeneratedTransition =
          isTransition && description.toLocaleLowerCase("es-PE").startsWith("estado cambiado de ");
        const isGenericTransition =
          isTransition && description.toLocaleLowerCase("es-PE") === "estado actualizado";
        const context =
          description && !isGeneratedTransition && !isGenericTransition && !(isTransition && releaseReasons.has(description))
            ? description
            : "";
        const isRelease = entry.action.toUpperCase() === "RELEASED";
        const actor = getHistoryActorLabel(entry.actor_role, entry.actor_name);

        return (
          <li key={entry.id} className="staff-detail-timeline__item">
            <span className="staff-detail-timeline__marker" aria-hidden="true" />
            <div>
              <strong>{getHistoryActionLabel(entry.action)}</strong>
              {isTransition && (oldValue || newValue) ? (
                <p className="staff-detail-timeline__transition">
                  {oldValue || "Estado anterior no informado"} <span aria-hidden="true">→</span>{" "}
                  {newValue || "Estado nuevo no informado"}
                </p>
              ) : null}
              {context ? (
                <p className="staff-detail-timeline__context">
                  {isRelease || (isTransition && context !== "Estado actualizado") ? (
                    <><b>Motivo:</b> {context}</>
                  ) : (
                    context
                  )}
                </p>
              ) : null}
              <div className="staff-detail-timeline__meta">
                {actor ? <span>{actor}</span> : <span>Actor no informado</span>}
                <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function TicketConversation({
  entries,
  isLoading,
  error,
  onRetry,
}: {
  readonly entries: readonly Comment[] | undefined;
  readonly isLoading: boolean;
  readonly error: unknown;
  readonly onRetry: () => void;
}) {
  if (isLoading) return <Skeleton rows={3} />;
  if (error) return <ReadError error={error} onRetry={onRetry} />;
  if (!entries?.length) {
    return (
      <div className="staff-detail-empty staff-detail-empty--conversation">
        <MessageSquare aria-hidden="true" />
        <strong>Aún no hay comentarios</strong>
        <span>Los mensajes del cliente y del equipo aparecerán aquí.</span>
      </div>
    );
  }
  return (
    <ol className="staff-detail-messages" aria-label="Comentarios del ticket">
      {entries.map((entry) => {
        const roleKey = entry.author_role?.toLowerCase() ?? "participante";
        return (
          <li
            key={entry.id}
            className={`staff-detail-message staff-detail-message--${roleKey}`}
          >
            <span className="staff-detail-message__avatar" aria-hidden="true">
              {getParticipantInitials(entry.author_role, entry.author_name)}
            </span>
            <div className="staff-detail-message__body">
              <header>
                <span>
                  <strong>{getParticipantLabel(entry.author_role, entry.author_name)}</strong>
                  <small>{getParticipantRoleLabel(entry.author_role)}</small>
                </span>
                <time dateTime={entry.created_at}>{formatDate(entry.created_at)}</time>
              </header>
              <p>{entry.content}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StaffOperationPanel({
  ticket,
  role,
  userId,
  ticketKey,
  returnTo,
  slaInfo,
  onTicketUpdated,
}: {
  readonly ticket: Ticket;
  readonly role: StaffRole;
  readonly userId: string;
  readonly ticketKey: readonly unknown[];
  readonly returnTo: string;
  readonly slaInfo: SlaInfo | undefined;
  readonly onTicketUpdated: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [advisorId, setAdvisorId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TicketStatus | "">("");
  const [reason, setReason] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [slaReason, setSlaReason] = useState("");
  const [notice, setNotice] = useState("");
  const advisorsQuery = useQuery({
    queryKey: ["ticket-detail-advisors", userId],
    queryFn: api.users.advisors,
    enabled: role === "SUPERVISOR" && !isTerminalTicket(ticket),
    retry: false,
  });
  const mutation = useMutation<Ticket | Awaited<ReturnType<typeof api.tickets.sla>>, unknown, OperationInput>({
    mutationFn: (input) => {
      if (input.kind === "assign") {
        return api.tickets.assign(ticket.id, input.advisorId ?? "", input.version);
      }
      if (input.kind === "release") {
        return api.tickets.release(ticket.id, input.reason ?? "", input.version);
      }
      if (input.kind === "pause") return api.tickets.pauseSla(ticket.id, input.reason ?? "");
      if (input.kind === "resume") return api.tickets.resumeSla(ticket.id, input.reason ?? "");
      if (!input.status) throw new Error("Selecciona un estado.");
      if (input.status === "CERRADO") return api.tickets.close(ticket.id);
      if (input.status === "CANCELADO") {
        return api.tickets.cancel(ticket.id, input.reason ?? "", input.version);
      }
      if (ticket.status === "RESUELTO" && input.status === "EN_PROCESO") {
        return api.tickets.reopen(ticket.id, input.reason ?? "", input.version);
      }
      return api.tickets.changeStatus(
        ticket.id,
        input.status,
        input.reason || undefined,
        input.version,
      );
    },
    onSuccess: async (result, input) => {
      setReason("");
      setReleaseReason("");
      setSlaReason("");
      if (input.kind === "pause" || input.kind === "resume") {
        await queryClient.invalidateQueries({ queryKey: [...ticketKey, "sla"] });
        setNotice(input.kind === "pause" ? "SLA pausado." : "SLA reanudado.");
      } else if (input.kind === "release" && role === "ASESOR") {
        queryClient.removeQueries({ queryKey: ticketKey });
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["tickets"] }),
          queryClient.invalidateQueries({ queryKey: ["operations"] }),
        ]);
        await navigate(returnTo, {
          replace: true,
          state: { ticketReleaseNotice: "El ticket se liberó y volvió a Disponibles." },
        });
        return;
      } else {
        queryClient.setQueryData(ticketKey, result);
        setSelectedStatus("");
        setAdvisorId("");
        setNotice("Los cambios se guardaron correctamente.");
        await onTicketUpdated();
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tickets"] }),
        queryClient.invalidateQueries({ queryKey: ["operations"] }),
      ]);
    },
    onError: async (error) => {
      setNotice(errorMessage(error));
      if (isStatus(error, 409)) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ticketKey }),
          queryClient.invalidateQueries({ queryKey: ["tickets"] }),
          queryClient.invalidateQueries({ queryKey: ["operations"] }),
        ]);
      }
    },
  });

  const terminal = isTerminalTicket(ticket);
  const isSupervisor = role === "SUPERVISOR";
  const ownsTicket = ticket.assigned_advisor_id === userId;
  const canRelease =
    !terminal && ticket.assigned_advisor_id !== null && (isSupervisor || ownsTicket);
  const statusOptions = (allowedTicketTransitions[ticket.status] ?? []).filter(
    (next) => next !== "ASIGNADO" && (isSupervisor || next !== "CANCELADO"),
  );
  const needsStatusReason =
    selectedStatus === "CANCELADO" ||
    (ticket.status === "RESUELTO" && selectedStatus === "EN_PROCESO");
  const statusReasonLabel =
    selectedStatus === "CANCELADO" ? "Motivo de cancelación" : "Motivo de reapertura";
  const canPauseSla = isSupervisor && !terminal && slaInfo?.status === "ACTIVE";
  const canResumeSla = isSupervisor && !terminal && slaInfo?.status === "PAUSED";

  return (
    <section className="staff-detail-section staff-detail-actions" aria-labelledby="staff-detail-actions-title">
      <header className="staff-detail-section__header">
        <h2 id="staff-detail-actions-title">
          <span aria-hidden="true"><CheckCircle2 /></span>
          Acciones operativas
        </h2>
      </header>
      {!isSupervisor && !ownsTicket ? (
        <p className="staff-detail-empty">Este ticket pertenece a otro asesor. Puedes consultar la información disponible, pero las acciones requieren que esté a tu cargo.</p>
      ) : <>
      {isSupervisor ? (
        <div className="staff-detail-action-group">
          <label htmlFor="staff-ticket-advisor">Asignar o reasignar responsable</label>
          {advisorsQuery.isLoading ? (
            <Skeleton rows={1} />
          ) : advisorsQuery.isError ? (
            <ReadError error={advisorsQuery.error} onRetry={() => void advisorsQuery.refetch()} />
          ) : (
            <>
              <select
                id="staff-ticket-advisor"
                value={advisorId}
                onChange={(event) => {
                  setAdvisorId(event.target.value);
                  setNotice("");
                }}
                disabled={mutation.isPending}
              >
                <option value="">Selecciona un asesor</option>
                {advisorsQuery.data?.map((advisor) => (
                  <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>
                ))}
              </select>
              <Button
                variant="secondary"
                disabled={!advisorId || advisorId === ticket.assigned_advisor_id || mutation.isPending}
                isLoading={mutation.isPending && mutation.variables?.kind === "assign"}
                onClick={() => mutation.mutate({ kind: "assign", advisorId, version: ticket.version })}
              >
                {ticket.assigned_advisor_id ? "Guardar reasignación" : "Asignar ticket"}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {statusOptions.length ? (
        <div className="staff-detail-action-group">
          <label htmlFor="staff-ticket-status">Mover a…</label>
          <select
            id="staff-ticket-status"
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value as TicketStatus | "");
              setReason("");
              setNotice("");
            }}
            disabled={mutation.isPending}
          >
            <option value="">Selecciona un estado permitido</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{statusLabel(status)}</option>
            ))}
          </select>
          {needsStatusReason ? (
            <label htmlFor="staff-ticket-status-reason">{statusReasonLabel}</label>
          ) : null}
          {needsStatusReason ? (
            <textarea
              id="staff-ticket-status-reason"
              rows={3}
              maxLength={1000}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Escribe el motivo requerido."
              disabled={mutation.isPending}
            />
          ) : null}
          {selectedStatus ? (
            <Button
              disabled={mutation.isPending || (needsStatusReason && !reason.trim())}
              isLoading={mutation.isPending && mutation.variables?.kind === "status"}
              onClick={() => mutation.mutate({
                kind: "status",
                status: selectedStatus,
                reason: reason.trim(),
                version: ticket.version,
              })}
            >
              Guardar estado
            </Button>
          ) : null}
        </div>
      ) : null}

      {canRelease ? (
        <div className="staff-detail-action-group">
          <label htmlFor="staff-ticket-release-reason">Motivo de liberación</label>
          <textarea
            id="staff-ticket-release-reason"
            rows={2}
            maxLength={1000}
            value={releaseReason}
            onChange={(event) => setReleaseReason(event.target.value)}
            placeholder="Indica por qué se libera el ticket."
            disabled={mutation.isPending}
          />
          <Button
            variant="quiet"
            disabled={!releaseReason.trim() || mutation.isPending}
            isLoading={mutation.isPending && mutation.variables?.kind === "release"}
            onClick={() => mutation.mutate({
              kind: "release",
              reason: releaseReason.trim(),
              version: ticket.version,
            })}
          >
            Liberar a Disponibles
          </Button>
        </div>
      ) : null}

      {canPauseSla || canResumeSla ? (
        <div className="staff-detail-action-group">
          <label htmlFor="staff-ticket-sla-reason">Motivo para actualizar el SLA</label>
          <textarea
            id="staff-ticket-sla-reason"
            rows={2}
            maxLength={1000}
            value={slaReason}
            onChange={(event) => setSlaReason(event.target.value)}
            placeholder="Indica el motivo operativo."
            disabled={mutation.isPending}
          />
          {canPauseSla ? (
            <Button
              variant="quiet"
              disabled={!slaReason.trim() || mutation.isPending}
              isLoading={mutation.isPending && mutation.variables?.kind === "pause"}
              onClick={() => mutation.mutate({ kind: "pause", reason: slaReason.trim(), version: ticket.version })}
            >
              Pausar SLA
            </Button>
          ) : null}
          {canResumeSla ? (
            <Button
              variant="quiet"
              disabled={!slaReason.trim() || mutation.isPending}
              isLoading={mutation.isPending && mutation.variables?.kind === "resume"}
              onClick={() => mutation.mutate({ kind: "resume", reason: slaReason.trim(), version: ticket.version })}
            >
              Reanudar SLA
            </Button>
          ) : null}
        </div>
      ) : null}

      {notice ? (
        <div className={mutation.isError ? "staff-detail-feedback staff-detail-feedback--error" : "staff-detail-feedback"} role={mutation.isError ? "alert" : "status"}>
          {mutation.isError ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          <span>{notice}</span>
          {isStatus(mutation.error, 409) ? (
            <Button variant="secondary" onClick={() => void onTicketUpdated()}>
              Actualizar datos
            </Button>
          ) : null}
        </div>
      ) : null}
      {isSupervisor && advisorsQuery.isSuccess && !advisorsQuery.data.length ? (
        <p className="staff-detail-empty">No hay asesores disponibles para asignar.</p>
      ) : null}
      </>}
    </section>
  );
}

function statusLabel(status: TicketStatus): string {
  const labels: Readonly<Record<TicketStatus, string>> = {
    NUEVO: "Disponible",
    ASIGNADO: "Por atender",
    EN_PROCESO: "En atención",
    PENDIENTE_CLIENTE: "Esperando al cliente",
    RESUELTO: "Resuelto por cerrar",
    CERRADO: "Cerrado",
    CANCELADO: "Cancelado",
  };
  return labels[status];
}

export function StaffTicketDetailPage({
  fallbackPath,
}: {
  readonly fallbackPath: string;
}) {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [attachmentError, setAttachmentError] = useState("");
  const [commentNotice, setCommentNotice] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const role: StaffRole = session?.user.role === "SUPERVISOR" ? "SUPERVISOR" : "ASESOR";
  const userId = session?.user.id ?? "";
  const ticketKey = ["ticket", id, userId] as const;
  const locationState = location.state as { readonly returnTo?: unknown } | null;
  const rolePrefix = role === "SUPERVISOR" ? "/supervisor/" : "/asesor/";
  const requestedReturnTo = locationState?.returnTo;
  const returnTo =
    typeof requestedReturnTo === "string" &&
    requestedReturnTo.startsWith(rolePrefix) &&
    !requestedReturnTo.includes("/tickets/")
      ? requestedReturnTo
      : fallbackPath;

  const ticketQuery = useQuery({
    queryKey: ticketKey,
    queryFn: () => api.tickets.get(id),
    enabled: Boolean(id && userId),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
  });
  const accessConfirmed = Boolean(
    ticketQuery.isSuccess && !ticketQuery.isFetching && ticketQuery.data && userId,
  );
  const commentsQuery = useQuery({
    queryKey: [...ticketKey, "comments"],
    queryFn: () => api.tickets.comments(id),
    enabled: accessConfirmed,
    retry: false,
  });
  const attachmentsQuery = useQuery({
    queryKey: [...ticketKey, "attachments"],
    queryFn: () => api.tickets.attachments(id),
    enabled: accessConfirmed,
    retry: false,
  });
  const historyQuery = useQuery({
    queryKey: [...ticketKey, "history"],
    queryFn: () => api.tickets.history(id),
    enabled: accessConfirmed,
    retry: false,
  });
  const slaQuery = useQuery({
    queryKey: [...ticketKey, "sla"],
    queryFn: () => api.tickets.sla(id),
    enabled: accessConfirmed,
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: api.categories.list,
    enabled: accessConfirmed,
    retry: false,
  });
  const ticket = ticketQuery.data;
  const terminal = ticket ? isTerminalTicket(ticket) : false;

  const commentMutation = useMutation({
    mutationFn: ({ content, version }: { readonly content: string; readonly version: number }) =>
      api.tickets.comment(id, content, version),
    onSuccess: async () => {
      setComment("");
      setCommentNotice("Comentario enviado.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey }),
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "comments"] }),
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "history"] }),
      ]);
    },
    onError: async (error) => {
      setCommentNotice(
        isStatus(error, 409)
          ? "El ticket cambió. Actualiza la conversación antes de volver a enviar el texto."
          : "No pudimos confirmar el comentario. Actualiza la conversación antes de volver a enviarlo.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ticketKey }),
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "comments"] }),
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "history"] }),
      ]);
    },
  });
  const attachmentMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(id, file, setUploadProgress),
    onSuccess: async () => {
      setAttachmentError("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "attachments"] }),
        queryClient.invalidateQueries({ queryKey: [...ticketKey, "history"] }),
      ]);
    },
    onError: (error) => {
      setAttachmentError(
        `${errorMessage(error)} Actualiza la lista de adjuntos para comprobar si el archivo se recibió antes de volver a seleccionarlo.`,
      );
    },
    onSettled: () => {
      setUploadProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    },
  });

  if (ticketQuery.isLoading || ticketQuery.isFetching) {
    return (
      <div className="staff-ticket-detail staff-ticket-detail--loading" aria-busy="true">
        <p className="sr-only" role="status">Comprobando acceso y cargando ticket.</p>
        <Skeleton rows={8} />
      </div>
    );
  }
  if (ticketQuery.isError) {
    const error = ticketQuery.error;
    const forbidden = isStatus(error, 403);
    const missing = isStatus(error, 404);
    const errorStatus = error instanceof ApiError ? error.status : 0;
    return (
      <div className="staff-ticket-detail staff-ticket-detail--state">
        <StatePanel
          kind={forbidden ? "forbidden" : "error"}
          title={
            forbidden
              ? "No tienes acceso a este ticket"
              : missing
                ? "No encontramos este ticket"
                : errorStatus === 409
                  ? "El ticket cambió mientras se abría"
                  : errorStatus === 0
                    ? "No pudimos conectar con el servicio"
                    : "No pudimos abrir el ticket"
          }
          message={
            forbidden
              ? "Tu perfil no puede consultar este ticket. Vuelve a la bandeja para continuar."
              : missing
                ? "No encontramos un ticket con este identificador."
                : errorMessage(error)
          }
          actionLabel={forbidden || missing ? "Volver al tablero" : "Reintentar"}
          onAction={() => {
            if (forbidden || missing) void navigate(returnTo, { replace: true });
            else void ticketQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (!ticket) {
    return (
      <StatePanel
        kind="error"
        title="No pudimos abrir el ticket"
        message="Vuelve al tablero e inténtalo nuevamente."
        actionLabel="Actualizar ticket"
        onAction={() => void ticketQuery.refetch()}
      />
    );
  }

  const categoryName = categoriesQuery.isSuccess
    ? categoriesQuery.data.find((category: Category) => category.id === ticket.category_id)?.name ?? "No informado"
    : categoriesQuery.isError
      ? "No disponible"
      : "Cargando…";
  const dates = [
    { label: "Creado", value: ticket.created_at },
    ...(ticket.assigned_at ? [{ label: "Asignado", value: ticket.assigned_at }] : []),
    ...(ticket.resolved_at ? [{ label: "Resuelto", value: ticket.resolved_at }] : []),
    ...(ticket.closed_at ? [{ label: "Cerrado", value: ticket.closed_at }] : []),
    ...(ticket.cancelled_at ? [{ label: "Cancelado", value: ticket.cancelled_at }] : []),
    { label: "Actualizado", value: ticket.updated_at },
  ];
  const refreshTicketData = async () => {
    await Promise.all([
      ticketQuery.refetch(),
      commentsQuery.refetch(),
      attachmentsQuery.refetch(),
      historyQuery.refetch(),
      slaQuery.refetch(),
    ]);
  };
  const downloadAttachment = async (attachment: Attachment) => {
    setAttachmentError("");
    try {
      const response = await api.tickets.downloadAttachment(attachment.id);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = attachment.original_filename;
      anchor.style.display = "none";
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setAttachmentError(errorMessage(error));
    }
  };
  const visibleAttachments = attachmentsQuery.data ?? [];
  const resolvedDate = terminal
    ? ticket.status === "CERRADO"
      ? ticket.closed_at
      : ticket.cancelled_at
    : null;

  return (
    <div className="staff-ticket-detail">
      <div className="staff-ticket-detail__topline">
        <Link className="staff-detail-back" to={returnTo}>
          <ArrowLeft aria-hidden="true" />
          Volver al tablero
        </Link>
        <div className="staff-detail-topline__context">
          {role === "SUPERVISOR" ? "Supervisión" : "Atención operativa"}
        </div>
      </div>
      <PageIntro
        className="staff-detail-intro"
        title={ticket.subject || "Asunto no informado"}
        description={ticket.tracking_code}
        actions={
          <div className="staff-detail-intro__badges">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
          </div>
        }
      />

      {terminal ? (
        <p className="staff-detail-readonly" role="status">
          <LockKeyhole aria-hidden="true" />
          Modo consulta: ticket {ticket.status === "CERRADO" ? "cerrado" : "cancelado"}
          {resolvedDate ? ` el ${formatDate(resolvedDate)}` : ""}. No admite cambios ni nuevos comentarios.
        </p>
      ) : null}

      <div className="staff-detail-layout">
        <main className="staff-detail-main">
          <InfoSection title="Descripción" icon={<FileText />} className="staff-detail-description">
            <p>{ticket.description?.trim() || "No hay una descripción informada."}</p>
          </InfoSection>

          <InfoSection
            title="Conversación y comentarios"
            icon={<MessageSquare />}
            aside={<span>{commentsQuery.isSuccess ? `${commentsQuery.data.length} comentarios` : ""}</span>}
          >
            <TicketConversation
              entries={commentsQuery.data}
              isLoading={commentsQuery.isLoading}
              error={commentsQuery.error}
              onRetry={() => void commentsQuery.refetch()}
            />
            {!terminal ? (
              <form
                className="staff-detail-comment-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const content = comment.trim();
                  if (!content || !ticket || commentMutation.isPending) return;
                  setCommentNotice("");
                  commentMutation.mutate({ content, version: ticket.version });
                }}
              >
                <label htmlFor="staff-ticket-comment">Agregar comentario</label>
                <textarea
                  id="staff-ticket-comment"
                  rows={3}
                  maxLength={5000}
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setCommentNotice("");
                  }}
                  placeholder="Escribe una actualización para el cliente o el equipo."
                  disabled={commentMutation.isPending}
                />
                {commentMutation.error || commentNotice ? (
                  <div className={commentMutation.isError ? "staff-detail-feedback staff-detail-feedback--error" : "staff-detail-feedback"} role={commentMutation.isError ? "alert" : "status"}>
                    {commentMutation.isError ? <AlertCircle aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    <span>{commentNotice || "Comentario enviado."}</span>
                    {commentMutation.isError ? (
                      <Button variant="secondary" onClick={() => void commentsQuery.refetch()}>
                        Actualizar conversación
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  type="submit"
                  className="staff-detail-comment-form__submit"
                  disabled={!comment.trim() || commentMutation.isPending || terminal}
                  isLoading={commentMutation.isPending}
                >
                  <Send aria-hidden="true" />
                  Enviar comentario
                </Button>
              </form>
            ) : null}
          </InfoSection>

          <InfoSection
            title="Historial"
            icon={<History />}
            aside={<span>{historyQuery.isSuccess ? `${historyQuery.data.length} eventos` : ""}</span>}
          >
            <TicketHistory
              entries={historyQuery.data}
              isLoading={historyQuery.isLoading}
              error={historyQuery.error}
              onRetry={() => void historyQuery.refetch()}
            />
          </InfoSection>
        </main>

        <aside className="staff-detail-rail" aria-label="Datos y acciones del ticket">
          {!terminal ? (
            <StaffOperationPanel
              ticket={ticket}
              role={role}
              userId={userId}
              ticketKey={ticketKey}
              returnTo={returnTo}
              slaInfo={slaQuery.data}
              onTicketUpdated={refreshTicketData}
            />
          ) : null}

          <InfoSection title="Datos del ticket" icon={<UserRound />}>
            <dl className="staff-detail-facts">
              <div><dt>Cliente</dt><dd>{ticket.client_name?.trim() || "No informado"}</dd></div>
              <div>
                <dt>Asesor responsable</dt>
                <dd>{ticket.assigned_advisor_name?.trim() || (ticket.assigned_advisor_id ? "Asesor asignado" : "Sin responsable")}</dd>
              </div>
              <div><dt>Categoría</dt><dd>{categoryName}</dd></div>
              <div><dt>Canal</dt><dd>{ticket.source === "CHATBOT" ? "Asistente digital" : ticket.source === "MANUAL" ? "Registro manual" : "No informado"}</dd></div>
              <div><dt>Identificador de conversación</dt><dd>{ticket.conversation_id ? "Asociada" : "No asociada"}</dd></div>
            </dl>
            {categoriesQuery.isError ? (
              <ReadError error={categoriesQuery.error} onRetry={() => void categoriesQuery.refetch()} />
            ) : null}
          </InfoSection>

          <InfoSection title="Fechas" icon={<CalendarDays />}>
            <dl className="staff-detail-dates">
              {dates.map(({ label, value }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd><time dateTime={value}>{formatDate(value)}</time></dd>
                </div>
              ))}
            </dl>
          </InfoSection>

          <InfoSection title="SLA" icon={<Clock3 />}>
            {slaQuery.isLoading ? (
              <Skeleton rows={2} />
            ) : slaQuery.isError ? (
              <ReadError error={slaQuery.error} onRetry={() => void slaQuery.refetch()} />
            ) : slaQuery.data ? (
              <dl className="staff-detail-sla">
                <div><dt>Estado</dt><dd><SlaStatusLabel value={slaQuery.data.status} /></dd></div>
                <div><dt>Primera respuesta</dt><dd><time dateTime={slaQuery.data.first_response_due_at}>{formatDate(slaQuery.data.first_response_due_at)}</time></dd></div>
                <div><dt>Resolución</dt><dd><time dateTime={slaQuery.data.resolution_due_at}>{formatDate(slaQuery.data.resolution_due_at)}</time></dd></div>
                {slaQuery.data.paused_at ? <div><dt>En pausa desde</dt><dd><time dateTime={slaQuery.data.paused_at}>{formatDate(slaQuery.data.paused_at)}</time></dd></div> : null}
              </dl>
            ) : (
              <p className="staff-detail-empty">No se recibió información del SLA.</p>
            )}
          </InfoSection>

          <InfoSection
            title="Adjuntos"
            icon={<Paperclip />}
            aside={<span>{attachmentsQuery.isSuccess ? attachmentsQuery.data.length : ""}</span>}
          >
            {!terminal ? (
              <div className="staff-detail-attachment-actions">
                <input
                  ref={fileInput}
                  className="sr-only"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.txt"
                  aria-label="Seleccionar archivo adjunto"
                  disabled={attachmentMutation.isPending}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      setAttachmentError("");
                      attachmentMutation.mutate(file);
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={attachmentMutation.isPending}
                  isLoading={attachmentMutation.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  <Paperclip aria-hidden="true" />
                  Adjuntar archivo
                </Button>
              </div>
            ) : null}
            {uploadProgress !== null ? (
              <div className="staff-detail-upload" role="status" aria-live="polite">
                <progress value={uploadProgress} max={100}>{uploadProgress}%</progress>
                <span>Cargando archivo: {uploadProgress}%</span>
              </div>
            ) : null}
            {attachmentError ? (
              <div className="staff-detail-feedback staff-detail-feedback--error" role="alert">
                <AlertCircle aria-hidden="true" />
                <span>{attachmentError}</span>
                <Button variant="secondary" onClick={() => void attachmentsQuery.refetch()}>
                  Actualizar adjuntos
                </Button>
              </div>
            ) : null}
            {attachmentsQuery.isLoading ? <Skeleton rows={2} /> : null}
            {attachmentsQuery.isError ? (
              <ReadError error={attachmentsQuery.error} onRetry={() => void attachmentsQuery.refetch()} />
            ) : null}
            {attachmentsQuery.isSuccess && visibleAttachments.length ? (
              <ul className="staff-detail-attachments">
                {visibleAttachments.map((attachment) => (
                  <li key={attachment.id}>
                    <FileText aria-hidden="true" />
                    <span>
                      <strong>{attachment.original_filename}</strong>
                      <small>{Math.max(1, Math.ceil(attachment.file_size / 1024))} KB · {formatDate(attachment.created_at)}</small>
                    </span>
                    <Button
                      variant="quiet"
                      aria-label={`Descargar ${attachment.original_filename}`}
                      onClick={() => void downloadAttachment(attachment)}
                    >
                      <Download aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            {attachmentsQuery.isSuccess && !visibleAttachments.length ? (
              <p className="staff-detail-empty">Este ticket no tiene adjuntos.</p>
            ) : null}
          </InfoSection>
        </aside>
      </div>
    </div>
  );
}
