import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  GripVertical,
  History,
  LayoutGrid,
  ListFilter,
  RefreshCw,
  Search,
  TableProperties,
  UserCheck,
  X,
} from "lucide-react";
import {
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/auth-context";
import { api } from "../shared/api/endpoints";
import { ApiError } from "../shared/api/http";
import { useModalFocus } from "../shared/hooks/use-modal-focus";
import {
  Button,
  PageIntro,
  PaginationControls,
  PriorityBadge,
  Skeleton,
  StatePanel,
  StatusBadge,
} from "../shared/components/ui";
import type {
  PageResult,
  PublicUser,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "../shared/types/domain";
import {
  activeTicketStatuses,
  advisorKanbanColumns,
  getAdvisorInboxAction,
  getKanbanMoveDecision,
  getKanbanMoveOptions,
  getTicketResponsibleLabel,
  getTicketStatusLabel,
  sortKanbanTickets,
  type KanbanMoveAction,
  type KanbanRole,
} from "./staff-operations.model";
import "./staff-operations.css";

type TicketCollection = readonly Ticket[] | PageResult<Ticket>;
type TicketQueryParams = Readonly<
  Record<string, string | number | boolean | undefined>
>;

interface AssignmentFilters {
  readonly search: string;
  readonly priority: TicketPriority | "";
  readonly from: string;
  readonly to: string;
}

function isPageResult(value: TicketCollection): value is PageResult<Ticket> {
  return !Array.isArray(value) && "items" in value;
}

const supervisorStatuses = activeTicketStatuses;
const historyStatuses = ["CERRADO", "CANCELADO"] as const;
const historyStatusOptions = historyStatuses;
const pageSize = 20;
const kanbanPageSize = 6;
const priorityValues: readonly TicketPriority[] = [
  "URGENTE",
  "ALTA",
  "MEDIA",
  "BAJA",
];

function ticketItems(value: TicketCollection | undefined): readonly Ticket[] {
  if (!value) return [];
  return isPageResult(value) ? value.items : value;
}

function ticketTotal(value: TicketCollection | undefined): number {
  if (!value) return 0;
  return isPageResult(value) ? value.total : value.length;
}

function ticketPages(value: TicketCollection | undefined): number {
  if (!value || !isPageResult(value)) return 1;
  return value.total_pages ?? value.pages ?? 1;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-PE", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}

function formatSlaDeadline(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(date);
}

function toIsoStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}

function toIsoEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "No tienes permisos para esta acción.";
    if (error.status === 409)
      return "El ticket cambió mientras lo atendías. Actualiza la lista e inténtalo nuevamente.";
    if (error.status === 0)
      return "No pudimos conectar con el servicio. Revisa tu conexión e inténtalo nuevamente.";
    return error.message;
  }
  return "No pudimos completar la solicitud. Inténtalo nuevamente.";
}

function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

function QueryError({
  error,
  retry,
}: {
  readonly error: unknown;
  readonly retry: () => void;
}) {
  const forbidden = error instanceof ApiError && error.status === 403;
  return (
    <StatePanel
      kind={forbidden ? "forbidden" : "error"}
      title={forbidden ? "No tienes acceso a esta información" : "No pudimos cargar la información"}
      message={errorMessage(error)}
      actionLabel={forbidden ? undefined : "Reintentar"}
      onAction={forbidden ? undefined : retry}
    />
  );
}

function FilterDrawer({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => window.matchMedia("(min-width: 761px)").matches);
  return (
    <details
      className="staff-filters"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        {open ? <X aria-hidden="true" /> : <ListFilter aria-hidden="true" />}
        {open ? "Cerrar filtros" : label}
      </summary>
      {children}
    </details>
  );
}

function invalidateTicketLists(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["tickets"] }),
    queryClient.invalidateQueries({ queryKey: ["operations"] }),
    queryClient.invalidateQueries({ queryKey: ["reports", "summary"] }),
  ]);
}

interface RequestedKanbanMove {
  readonly ticket: Ticket;
  readonly action: KanbanMoveAction;
}

interface KanbanMoveSubmission extends RequestedKanbanMove {
  readonly reason: string;
  readonly advisorId: string;
}

interface KanbanPointerGesture {
  readonly pointerId: number;
  readonly ticket: Ticket;
  readonly startX: number;
  readonly startY: number;
  readonly startedAt: number;
  readonly element: HTMLElement;
  readonly pointerType: string;
  lastY: number;
  dragging: boolean;
  scrolling: boolean;
}

const interactiveKanbanTarget =
  "a, button, input, select, textarea, summary, [role='button'], [role='menuitem'], [contenteditable='true'], [data-no-kanban-drag]";

function isKanbanInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(interactiveKanbanTarget));
}

function getKanbanDropStatusAt(
  document: Document,
  x: number,
  y: number,
): TicketStatus | null {
  const element = document.elementFromPoint(x, y);
  const target = element?.closest<HTMLElement>("[data-kanban-drop-status]");
  const status = target?.dataset.kanbanDropStatus;
  return status && activeTicketStatuses.includes(status as (typeof activeTicketStatuses)[number])
    ? status as TicketStatus
    : null;
}

function scrollKanbanPage(element: HTMLElement, deltaY: number): void {
  const document = element.ownerDocument;
  let candidate = element.parentElement;
  while (candidate && candidate !== document.body && candidate !== document.documentElement) {
    const style = document.defaultView?.getComputedStyle(candidate);
    if (
      style &&
      /(auto|scroll)/.test(style.overflowY) &&
      candidate.scrollHeight > candidate.clientHeight
    ) {
      candidate.scrollTop -= deltaY;
      return;
    }
    candidate = candidate.parentElement;
  }
  document.defaultView?.scrollBy(0, -deltaY);
}

function getKanbanDropState(
  ticket: Ticket | null,
  status: TicketStatus,
  role: KanbanRole,
  currentAdvisorId: string,
  targetStatus: TicketStatus | null,
): "valid" | "target" | undefined {
  if (
    !ticket ||
    ticket.status === status ||
    !getKanbanMoveDecision(ticket, status, role, currentAdvisorId).allowed
  )
    return undefined;
  return targetStatus === status ? "target" : "valid";
}

function useKanbanMovement(
  role: KanbanRole,
  advisors: readonly PublicUser[],
  currentAdvisorId = "",
  onStatusChanged?: (status: TicketStatus) => void,
) {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [selectedMove, setSelectedMove] = useState<RequestedKanbanMove | null>(null);
  const [draggedTicket, setDraggedTicket] = useState<Ticket | null>(null);
  const [dragTargetStatus, setDragTargetStatus] = useState<TicketStatus | null>(null);
  const [reason, setReason] = useState("");
  const [advisorId, setAdvisorId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [failedMove, setFailedMove] = useState<KanbanMoveSubmission | null>(null);
  const [failedError, setFailedError] = useState("");
  const feedbackTimer = useRef<number | null>(null);
  const pointerGesture = useRef<KanbanPointerGesture | null>(null);
  const suppressCardClickUntil = useRef(0);
  const announce = (message: string, clearAfter?: number) => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = clearAfter
      ? window.setTimeout(() => setFeedback(""), clearAfter)
      : null;
  };
  useEffect(() => () => {
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
  }, []);
  const mutation = useMutation({
    mutationFn: ({ ticket, action, reason: moveReason, advisorId: selectedAdvisor }: KanbanMoveSubmission) => {
      if (action.kind === "assign") return api.tickets.assign(ticket.id, selectedAdvisor, ticket.version);
      if (action.kind === "take") return api.tickets.take(ticket.id, ticket.version);
      if (action.kind === "release") return api.tickets.release(ticket.id, moveReason, ticket.version);
      return api.tickets.changeStatus(ticket.id, action.targetStatus, moveReason || undefined, ticket.version);
    },
    onSuccess: async (ticket) => {
      queryClient.setQueryData(["ticket", ticket.id, userId], ticket);
      onStatusChanged?.(ticket.status);
      setSelectedMove(null);
      setFailedMove(null);
      setFailedError("");
      announce(`${ticket.tracking_code} se actualizó correctamente.`, 3500);
      await Promise.all([
        invalidateTicketLists(queryClient),
        queryClient.invalidateQueries({ queryKey: ["ticket", ticket.id] }),
      ]);
    },
    onError: async (error, variables) => {
      if (isConflict(error)) {
        setSelectedMove(null);
        setFailedMove(null);
        setFailedError("");
        announce("El ticket cambió en paralelo. Actualizamos el tablero; vuelve a elegir el movimiento.", 6000);
        await Promise.all([
          invalidateTicketLists(queryClient),
          queryClient.invalidateQueries({
            queryKey: ["ticket", variables.ticket.id],
          }),
        ]);
        return;
      }
      const handledByDialog =
        variables.action.kind === "assign" ||
        variables.action.kind === "release" ||
        (variables.action.kind === "status" && variables.action.requiresReason);
      if (!handledByDialog) {
        setFailedMove(variables);
        setFailedError(errorMessage(error));
      }
    },
  });

  const requestMove = (ticket: Ticket, targetStatus: TicketStatus) => {
    const decision = getKanbanMoveDecision(ticket, targetStatus, role, currentAdvisorId);
    if (!decision.allowed) {
      announce(decision.reason, 5000);
      return;
    }
    mutation.reset();
    setFailedMove(null);
    setFailedError("");
    setReason("");
    setAdvisorId("");
    setSelectedMove(null);
    setFeedback("");
    if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
    feedbackTimer.current = null;
    const move = { ticket, action: decision.action };
    if (decision.action.kind === "take" || (decision.action.kind === "status" && !decision.action.requiresReason)) {
      mutation.mutate({ ...move, reason: "", advisorId: "" });
      return;
    }
    setSelectedMove(move);
  };
  const onPointerDown = (ticket: Ticket, event: React.PointerEvent<HTMLElement>) => {
    if (mutation.isPending || !event.isPrimary || isKanbanInteractiveTarget(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    pointerGesture.current = {
      pointerId: event.pointerId,
      ticket,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: Date.now(),
      element: event.currentTarget,
      pointerType: event.pointerType,
      lastY: event.clientY,
      dragging: false,
      scrolling: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      pointerGesture.current = null;
    }
  };
  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const gesture = pointerGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;
    const distance = Math.hypot(deltaX, deltaY);
    const threshold = gesture.pointerType === "touch" ? 12 : 6;

    if (gesture.scrolling) {
      event.preventDefault();
      scrollKanbanPage(gesture.element, event.clientY - gesture.lastY);
      gesture.lastY = event.clientY;
      suppressCardClickUntil.current = Date.now() + 500;
      return;
    }

    if (!gesture.dragging) {
      if (distance < threshold) return;
      if (gesture.pointerType === "touch") {
        const horizontalIntent = Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
        const deliberateLongPress = Date.now() - gesture.startedAt >= 350;
        if (!horizontalIntent && !deliberateLongPress) {
          gesture.scrolling = true;
          event.preventDefault();
          scrollKanbanPage(gesture.element, event.clientY - gesture.lastY);
          gesture.lastY = event.clientY;
          suppressCardClickUntil.current = Date.now() + 500;
          return;
        }
      }
      gesture.dragging = true;
      suppressCardClickUntil.current = Date.now() + 650;
      if (feedbackTimer.current !== null) window.clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
      setDraggedTicket(gesture.ticket);
      setFeedback("");
    }

    event.preventDefault();
    const status = getKanbanDropStatusAt(gesture.element.ownerDocument, event.clientX, event.clientY);
    const decision = status
      ? status === gesture.ticket.status
        ? { allowed: false as const, reason: "El ticket ya está en esa columna." }
        : getKanbanMoveDecision(gesture.ticket, status, role, currentAdvisorId)
      : null;
    const nextTarget = decision?.allowed ? status : null;
    setDragTargetStatus((previous) => previous === nextTarget ? previous : nextTarget);
    if (decision && !decision.allowed) setFeedback(decision.reason);
    else setFeedback(nextTarget ? `Destino: ${getTicketStatusLabel(nextTarget)}` : "");
  };
  const finishPointerGesture = (event: React.PointerEvent<HTMLElement>, cancelled: boolean) => {
    const gesture = pointerGesture.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    pointerGesture.current = null;
    if (gesture.dragging && !cancelled) {
      const status = getKanbanDropStatusAt(gesture.element.ownerDocument, event.clientX, event.clientY);
      if (status === gesture.ticket.status) announce("El ticket ya está en esa columna.", 5000);
      else if (status) requestMove(gesture.ticket, status);
      else setFeedback("");
      suppressCardClickUntil.current = Date.now() + 650;
    } else if (cancelled && gesture.dragging) {
      setFeedback("");
      suppressCardClickUntil.current = Date.now() + 650;
    }
    setDraggedTicket(null);
    setDragTargetStatus(null);
    try {
      if (gesture.element.hasPointerCapture(gesture.pointerId))
        gesture.element.releasePointerCapture(gesture.pointerId);
    } catch {
      // A pointer cancel can release capture before this handler runs.
    }
  };
  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => finishPointerGesture(event, false);
  const onPointerCancel = (event: React.PointerEvent<HTMLElement>) => finishPointerGesture(event, true);
  const shouldIgnoreCardClick = () => Date.now() < suppressCardClickUntil.current;

  const dialog = selectedMove ? (
    <KanbanMoveDialog
      move={selectedMove}
      advisors={advisors}
      advisorId={advisorId}
      reason={reason}
      error={mutation.error}
      isPending={mutation.isPending}
      onAdvisorChange={setAdvisorId}
      onReasonChange={setReason}
      onCancel={() => { setSelectedMove(null); mutation.reset(); }}
      onConfirm={() => mutation.mutate({ ...selectedMove, reason: reason.trim(), advisorId })}
    />
  ) : null;
  const retryFailedMove = () => {
    if (!failedMove) return;
    const retry = failedMove;
    mutation.reset();
    setFailedMove(null);
    setFailedError("");
    mutation.mutate(retry);
  };

  return {
    role,
    currentAdvisorId,
    draggedTicket,
    dragTargetStatus,
    feedback,
    dialog,
    isPending: mutation.isPending,
    pendingTicketId: mutation.isPending ? mutation.variables?.ticket.id ?? null : null,
    failedTicketId: failedMove?.ticket.id ?? null,
    failedError,
    retryFailedMove,
    requestMove,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    shouldIgnoreCardClick,
  };
}

function KanbanMoveDialog({
  move,
  advisors,
  advisorId,
  reason,
  error,
  isPending,
  onAdvisorChange,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  readonly move: RequestedKanbanMove;
  readonly advisors: readonly PublicUser[];
  readonly advisorId: string;
  readonly reason: string;
  readonly error: unknown;
  readonly isPending: boolean;
  readonly onAdvisorChange: (value: string) => void;
  readonly onReasonChange: (value: string) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const dialogRef = useModalFocus<HTMLElement>(() => { if (!isPending) onCancel(); });
  const needsReason = move.action.kind === "release" || (move.action.kind === "status" && move.action.requiresReason);
  const needsAdvisor = move.action.kind === "assign";
  const isReassignment = needsAdvisor && Boolean(move.ticket.assigned_advisor_id);
  const titleId = `kanban-move-title-${move.ticket.id}`;
  const actionDescription = move.action.kind === "assign"
    ? isReassignment
      ? "Selecciona el nuevo responsable. El estado actual del ticket se conservará."
      : "Selecciona un asesor activo para asignar el ticket a Por atender."
    : move.action.kind === "release"
      ? "Al liberar, el ticket vuelve a Disponibles y se elimina el responsable. El historial y el SLA se conservan."
      : `El ticket pasará a ${getTicketStatusLabel(move.action.targetStatus)}.`;
  const title = needsAdvisor
    ? isReassignment ? "Reasignar responsable" : "Asignar ticket"
    : move.action.kind === "release" ? "Liberar ticket" : "Confirmar movimiento";
  const confirmLabel = isPending
    ? "Guardando…"
    : error
      ? "Reintentar"
      : needsAdvisor
        ? isReassignment ? "Reasignar" : "Asignar"
        : move.action.kind === "release" ? "Liberar ticket" : "Confirmar";
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending || (needsAdvisor && !advisorId) || (needsReason && !reason.trim())) return;
    onConfirm();
  };

  return (
    <div className="staff-move-backdrop">
      <section
        ref={dialogRef}
        className="staff-move-dialog"
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <form onSubmit={handleSubmit}>
          <h2 id={titleId}>{title}</h2>
          <p><strong>{move.ticket.tracking_code}</strong>: {actionDescription}</p>
          {needsAdvisor ? <label><span>Asesor activo</span><select autoFocus required value={advisorId} onChange={(event) => onAdvisorChange(event.target.value)}><option value="">Selecciona un asesor</option>{advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}</select></label> : null}
          {needsReason ? <label><span>{move.action.kind === "release" ? "Motivo de liberación" : "Motivo de reapertura"}</span><textarea autoFocus={!needsAdvisor} required maxLength={1000} value={reason} onChange={(event) => onReasonChange(event.target.value)} /></label> : null}
          {error ? <p className="form-error" role="alert">{errorMessage(error)}</p> : null}
          <div className="staff-move-dialog__actions">
            <button className="button button--secondary" type="button" disabled={isPending} onClick={onCancel}>Cancelar</button>
            <button className="button" type="submit" disabled={isPending || (needsAdvisor && !advisorId) || (needsReason && !reason.trim())}>
              {confirmLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function KanbanMovementControls({
  ticket,
  role,
  currentAdvisorId,
  isPending,
  onRequestMove,
}: {
  readonly ticket: Ticket;
  readonly role: KanbanRole;
  readonly currentAdvisorId: string;
  readonly isPending: boolean;
  readonly onRequestMove: (ticket: Ticket, status: TicketStatus) => void;
}) {
  const options = [...getKanbanMoveOptions(ticket, role, currentAdvisorId)].sort((left, right) => {
    const rank = (action: KanbanMoveAction) =>
      action.kind === "status" ||
      action.kind === "take" ||
      (action.kind === "assign" && ticket.status === "NUEVO")
        ? 0
        : 1;
    return rank(left.action) - rank(right.action);
  });
  return (
    <div className="staff-ticket-card__movement">
      <label>
        <span className="sr-only">Mover a… para {ticket.tracking_code}</span>
        <select value="" disabled={!options.length || isPending} onChange={(event) => {
          const status = event.target.value as TicketStatus;
          if (status) onRequestMove(ticket, status);
        }}>
          <option value="">{options.length ? "Mover a…" : "Sin movimientos disponibles"}</option>
          {options.map(({ status, action }) => {
            const label = action.kind === "take"
              ? "Tomar ticket"
              : action.kind === "assign"
                ? ticket.assigned_advisor_id ? "Reasignar responsable" : "Asignar a Por atender"
                : action.kind === "release"
                  ? "Liberar a Disponibles"
                  : `Mover a ${getTicketStatusLabel(status)}`;
            return <option key={status} value={status}>{label}</option>;
          })}
        </select>
      </label>
      <span className="staff-ticket-card__drag-hint" aria-hidden="true" title="Arrastra desde cualquier espacio libre de la tarjeta">
        <GripVertical />
      </span>
    </div>
  );
}

function KanbanMoveFailure({
  message,
  onRetry,
  disabled,
}: {
  readonly message: string;
  readonly onRetry: () => void;
  readonly disabled: boolean;
}) {
  if (!message) return null;
  return (
    <div className="staff-ticket-card__error" role="alert">
      <p>{message}</p>
      <button className="button button--secondary" type="button" disabled={disabled} onClick={onRetry}>Reintentar</button>
    </div>
  );
}

function StaffSectionTabs({
  role,
  active,
}: {
  readonly role: KanbanRole;
  readonly active: "board" | "history";
}) {
  const prefix = role === "ASESOR" ? "/asesor" : "/supervisor";
  return (
    <nav className="staff-rework-nav" aria-label="Vistas de tickets">
      <Link className={active === "board" ? "is-active" : ""} aria-current={active === "board" ? "page" : undefined} to={`${prefix}/${role === "ASESOR" ? "panel" : "cola"}`}>
        <LayoutGrid aria-hidden="true" />Tablero
      </Link>
      <Link className={active === "history" ? "is-active" : ""} aria-current={active === "history" ? "page" : undefined} to={`${prefix}/historial`}>
        <History aria-hidden="true" />Historial
      </Link>
    </nav>
  );
}

function StaffStageTabs({
  statuses,
  titles,
  selected,
  counts,
  onSelect,
  movement,
  role,
  currentAdvisorId = "",
}: {
  readonly statuses: readonly TicketStatus[];
  readonly titles?: Readonly<Record<string, string>>;
  readonly selected: TicketStatus;
  readonly counts: Partial<Record<TicketStatus, number>>;
  readonly onSelect: (status: TicketStatus) => void;
  readonly movement?: ReturnType<typeof useKanbanMovement>;
  readonly role?: KanbanRole;
  readonly currentAdvisorId?: string;
}) {
  return (
    <div className="staff-rework-stage-tabs" role="tablist" aria-label="Etapas del tablero">
      {statuses.map((status) => {
        const dropState = movement && role
          ? getKanbanDropState(movement.draggedTicket, status, role, currentAdvisorId, movement.dragTargetStatus)
          : undefined;
        return (
          <button
            id={`staff-stage-tab-${status}`}
            key={status}
            type="button"
            role="tab"
            aria-selected={selected === status}
            aria-controls={`staff-stage-panel-${status}`}
            data-kanban-drop-status={status}
            data-drop-state={dropState}
            onClick={() => onSelect(status)}
          >
            <span>{titles?.[status] ?? getTicketStatusLabel(status)}</span>
            <b>{counts[status] ?? "…"}</b>
          </button>
        );
      })}
    </div>
  );
}

export function AdvisorDashboardPage() {
  const { session } = useAuth();
  const location = useLocation();
  const locationState = location.state as { readonly ticketReleaseNotice?: unknown } | null;
  const releaseNotice = typeof locationState?.ticketReleaseNotice === "string" ? locationState.ticketReleaseNotice : null;
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stageTotals, setStageTotals] = useState<Partial<Record<TicketStatus, number>>>({});
  const [mobileStatus, setMobileStatus] = useState<TicketStatus>("NUEVO");
  const reportStageTotal = useCallback((status: TicketStatus, total: number) => {
    setStageTotals((previous) => previous[status] === total ? previous : { ...previous, [status]: total });
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);
  const filters: AssignmentFilters = { search, priority, from, to };

  return (
    <div className="staff-rework-page">
      <StaffSectionTabs role="ASESOR" active="board" />
      <PageIntro title="Kanban de atención" description="Toma solicitudes disponibles y sigue las que están a tu cargo." actions={<Link className="button button--secondary" to="/asesor/bandeja"><ListFilter aria-hidden="true" />Bandeja completa</Link>} />
      {releaseNotice ? <p className="form-success" role="status" aria-live="polite">{releaseNotice}</p> : null}
      <FilterDrawer label="Buscar y filtrar tickets">
        <div className="staff-filter-grid staff-rework-filters">
          <div className="staff-filter-search">
            <label className="staff-filter-search__label" htmlFor="advisor-kanban-search">Buscar solicitud</label>
            <div className="search-field"><Search aria-hidden="true" /><input id="advisor-kanban-search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Código, asunto o cliente" autoComplete="off" /></div>
          </div>
          <label><span>Prioridad</span><select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority | "")}><option value="">Todas las prioridades</option>{priorityValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="staff-filter-date"><span>Creado desde</span><span className="staff-filter-date__control"><CalendarDays aria-hidden="true" /><input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></span></label>
          <label className="staff-filter-date"><span>Creado hasta</span><span className="staff-filter-date__control"><CalendarDays aria-hidden="true" /><input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></span></label>
        </div>
      </FilterDrawer>
      <AdvisorKanban
        currentAdvisorId={session?.user.id ?? ""}
        filters={filters}
        stageTotals={stageTotals}
        reportStageTotal={reportStageTotal}
        mobileStatus={mobileStatus}
        onMobileStatusChange={setMobileStatus}
      />
    </div>
  );
}

function AdvisorKanban({
  currentAdvisorId,
  filters,
  stageTotals,
  reportStageTotal,
  mobileStatus,
  onMobileStatusChange,
}: {
  readonly currentAdvisorId: string;
  readonly filters: AssignmentFilters;
  readonly stageTotals: Partial<Record<TicketStatus, number>>;
  readonly reportStageTotal: (status: TicketStatus, total: number) => void;
  readonly mobileStatus: TicketStatus;
  readonly onMobileStatusChange: (status: TicketStatus) => void;
}) {
  const movement = useKanbanMovement("ASESOR", [], currentAdvisorId, onMobileStatusChange);
  return (
    <section className="content-section staff-board-section staff-rework-board" aria-labelledby="advisor-board-title">
      <div className="section-bar staff-rework-board__heading">
        <div><h2 id="advisor-board-title">Tickets por etapa</h2><p>Los totales corresponden al resultado completo de cada consulta.</p></div>
        <Link className="text-link" to="/asesor/historial">Ver tickets finalizados <ArrowUpRight aria-hidden="true" /></Link>
      </div>
      <StaffStageTabs
        statuses={advisorKanbanColumns.map(({ status }) => status)}
        titles={Object.fromEntries(advisorKanbanColumns.map(({ status, title }) => [status, title]))}
        selected={mobileStatus}
        counts={stageTotals}
        onSelect={onMobileStatusChange}
        movement={movement}
        role="ASESOR"
        currentAdvisorId={currentAdvisorId}
      />
      <div className="staff-kanban staff-kanban--advisor staff-kanban--redesign" data-mobile-status={mobileStatus}>
        {advisorKanbanColumns.map((column) => (
          <AdvisorKanbanColumn key={column.status} column={column} currentAdvisorId={currentAdvisorId} filters={filters} reportTotal={reportStageTotal} movement={movement} />
        ))}
      </div>
      {movement.feedback ? <p className="staff-kanban-feedback" role="status" aria-live="polite">{movement.feedback}</p> : null}
      {movement.dialog}
    </section>
  );
}

function AdvisorKanbanColumn({
  column,
  currentAdvisorId,
  filters,
  reportTotal,
  movement,
}: {
  readonly column: (typeof advisorKanbanColumns)[number];
  readonly currentAdvisorId: string;
  readonly filters: AssignmentFilters;
  readonly reportTotal: (status: TicketStatus, total: number) => void;
  readonly movement: ReturnType<typeof useKanbanMovement>;
}) {
  const query = useInfiniteQuery({
    queryKey: ["operations", "advisor-kanban", column.status, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api.tickets.operations({
      queue: column.status === "NUEVO" ? "unassigned" : "assigned_to_me",
      status: column.status,
      priority: filters.priority || undefined,
      search: filters.search || undefined,
      created_from: toIsoStart(filters.from),
      created_to: toIsoEnd(filters.to),
      page: pageParam,
      page_size: kanbanPageSize,
    }),
    getNextPageParam: (lastPage) => lastPage.page < (lastPage.total_pages ?? 1) ? lastPage.page + 1 : undefined,
  });
  const allItems = query.data?.pages.flatMap((page) => page.items) ?? [];
  const tickets = sortKanbanTickets(
    allItems.filter((ticket) => column.status === "NUEVO" ? ticket.assigned_advisor_id === null : ticket.assigned_advisor_id === currentAdvisorId),
    { overdue: new Set(), soon: new Set() },
  );
  const firstPage = query.data?.pages[0];
  const total = firstPage?.total ?? 0;
  useEffect(() => {
    if (firstPage) reportTotal(column.status, total);
  }, [column.status, firstPage, reportTotal, total]);

  return (
    <section
      className="staff-kanban__column staff-kanban__column--redesign"
      id={`staff-stage-panel-${column.status}`}
      role="tabpanel"
      aria-labelledby={`staff-stage-tab-${column.status}`}
      data-status={column.status}
      data-kanban-drop-status={column.status}
      data-drop-state={getKanbanDropState(movement.draggedTicket, column.status, "ASESOR", currentAdvisorId, movement.dragTargetStatus)}
    >
      <header><h3>{column.title}</h3><span>{total}</span></header>
      {query.isLoading ? <Skeleton rows={3} /> : null}
      {query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && !tickets.length ? <StatePanel kind="empty" title={column.title} message={column.emptyMessage} /> : null}
      {tickets.length ? (
        <div className="staff-kanban__cards">
          {tickets.map((ticket) => (
            <TicketWorkCard
              key={ticket.id}
              ticket={ticket}
              basePath="/asesor/tickets"
              returnTo="/asesor/panel"
              isUpdating={movement.pendingTicketId === ticket.id}
              responsibleLabel={ticket.status === "NUEVO" ? "Sin responsable" : "A tu cargo"}
              movement={movement}
            />
          ))}
        </div>
      ) : null}
      {query.hasNextPage ? <Button variant="secondary" isLoading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Cargar más</Button> : null}
    </section>
  );
}

function TicketWorkCard({
  ticket,
  basePath,
  returnTo,
  responsibleLabel,
  isUpdating = false,
  movement,
}: {
  readonly ticket: Ticket;
  readonly basePath: string;
  readonly returnTo: string;
  readonly responsibleLabel?: string;
  readonly isUpdating?: boolean;
  readonly movement?: ReturnType<typeof useKanbanMovement>;
}) {
  const navigate = useNavigate();
  const isUnassignedNew = ticket.status === "NUEVO" && ticket.assigned_advisor_id === null;
  const isAvailableForAdvisor = movement?.role === "ASESOR" && isUnassignedNew;
  const isAvailableForSupervisor = movement?.role === "SUPERVISOR" && isUnassignedNew;
  const isDragging = movement?.draggedTicket?.id === ticket.id;

  return (
    <article
      className={`staff-ticket-card staff-ticket-card--redesign${isUpdating ? " staff-ticket-card--updating" : ""}`}
      aria-busy={isUpdating || undefined}
      data-dragging={isDragging || undefined}
      onPointerDown={movement ? (event) => {
        if (
          event.pointerType === "touch" &&
          !(event.target instanceof Element && event.target.closest(".staff-ticket-card__drag-surface"))
        ) return;
        movement.onPointerDown(ticket, event);
      } : undefined}
      onPointerMove={movement?.onPointerMove}
      onPointerUp={movement?.onPointerUp}
      onPointerCancel={movement?.onPointerCancel}
      onClick={movement && !isAvailableForAdvisor ? (event) => {
        if (isKanbanInteractiveTarget(event.target) || movement.shouldIgnoreCardClick()) return;
        void navigate(`${basePath}/${ticket.id}`, { state: { returnTo } });
      } : undefined}
    >
      <div className="staff-ticket-card__drag-surface">
        <div className="staff-ticket-card__top">
          <strong>{ticket.tracking_code}</strong>
          <PriorityBadge priority={ticket.priority} />
        </div>
        <h4>{ticket.subject}</h4>
        <StatusBadge status={ticket.status} />
        <div className="staff-rework-card__facts">
          <div><span>Cliente</span><strong>{ticket.client_name?.trim() || "No informado"}</strong></div>
          <div><span>Responsable</span><strong>{responsibleLabel || ticket.assigned_advisor_name?.trim() || (ticket.assigned_advisor_id ? "Asesor asignado" : "Sin responsable")}</strong></div>
        </div>
      </div>
      <TicketSlaSummary ticket={ticket} role={movement?.role ?? "ASESOR"} />
      <div className="staff-ticket-card__drag-surface staff-ticket-card__drag-surface--activity">
        <p className="staff-rework-card__activity"><span>Última actividad</span><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time></p>
      </div>
      {isUpdating ? <p className="staff-ticket-card__pending" role="status" aria-live="polite"><RefreshCw aria-hidden="true" />Actualizando estado…</p> : null}
      {movement ? <div className="staff-rework-card__actions">
        {isAvailableForAdvisor ? (
          <div className="staff-ticket-card__primary-action">
            <Button
              disabled={movement.isPending}
              isLoading={isUpdating}
              onClick={() => movement.requestMove(ticket, "ASIGNADO")}
            >
              <UserCheck aria-hidden="true" />Tomar ticket
            </Button>
            <span className="staff-ticket-card__drag-hint" aria-hidden="true" title="Arrastra desde cualquier espacio libre de la tarjeta"><GripVertical /></span>
          </div>
        ) : isAvailableForSupervisor ? (
          <div className="staff-ticket-card__primary-action">
            <Button
              disabled={movement.isPending || !getKanbanMoveDecision(ticket, "ASIGNADO", "SUPERVISOR").allowed}
              isLoading={isUpdating && movement.pendingTicketId === ticket.id}
              onClick={() => movement.requestMove(ticket, "ASIGNADO")}
            >
              Asignar
            </Button>
            <span className="staff-ticket-card__drag-hint" aria-hidden="true" title="Arrastra desde cualquier espacio libre de la tarjeta"><GripVertical /></span>
          </div>
        ) : (
          <KanbanMovementControls
            ticket={ticket}
            role={movement.role}
            currentAdvisorId={movement.currentAdvisorId}
            isPending={movement.isPending}
            onRequestMove={movement.requestMove}
          />
        )}
        <KanbanMoveFailure
          message={movement.failedTicketId === ticket.id ? movement.failedError : ""}
          onRetry={movement.retryFailedMove}
          disabled={movement.isPending}
        />
      </div> : null}
      {!isAvailableForAdvisor ? (
        <Link to={`${basePath}/${ticket.id}`} state={{ returnTo }} aria-label={`Abrir detalle ${ticket.tracking_code}`}>
          Abrir detalle <ChevronRight aria-hidden="true" />
        </Link>
      ) : null}
    </article>
  );
}

const ticketSlaConcurrencyLimit = 4;
let activeTicketSlaRequests = 0;
const ticketSlaRequestQueue: Array<() => void> = [];

async function requestTicketSla(ticketId: string) {
  if (activeTicketSlaRequests < ticketSlaConcurrencyLimit) {
    activeTicketSlaRequests += 1;
  } else {
    await new Promise<void>((resolve) => ticketSlaRequestQueue.push(resolve));
  }
  try {
    return await api.tickets.sla(ticketId);
  } finally {
    const next = ticketSlaRequestQueue.shift();
    if (next) next();
    else activeTicketSlaRequests -= 1;
  }
}

function TicketSlaSummary({ ticket, role }: { readonly ticket: Ticket; readonly role: KanbanRole }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const canRead = role === "SUPERVISOR" || ticket.status !== "NUEVO";
  const query = useQuery({
    queryKey: ["ticket", ticket.id, userId, "sla"],
    queryFn: () => requestTicketSla(ticket.id),
    enabled: canRead && Boolean(userId),
    staleTime: 30_000,
    retry: false,
  });
  if (!canRead) return <p className="staff-rework-card__sla"><Clock3 aria-hidden="true" />SLA disponible al tomar el ticket</p>;
  if (query.isLoading) return <p className="staff-rework-card__sla"><Clock3 aria-hidden="true" />Consultando SLA…</p>;
  if (query.isError) return <p className="staff-rework-card__sla"><Clock3 aria-hidden="true" />SLA no disponible <button type="button" onClick={() => void query.refetch()}>Reintentar</button></p>;
  if (!query.data) return <p className="staff-rework-card__sla"><Clock3 aria-hidden="true" />SLA no informado</p>;
  const status = query.data.status === "BREACHED" ? "Vencido" : query.data.status === "PAUSED" ? "En pausa" : query.data.status === "COMPLETED" ? "Completado" : query.data.status === "CANCELLED" ? "Cancelado" : "En curso";
  return (
    <div className={`staff-rework-card__sla${query.data.status === "BREACHED" ? " is-overdue" : ""}`}>
      <Clock3 aria-hidden="true" />
      <span><strong>SLA {status}</strong><small>Primera respuesta · {formatSlaDeadline(query.data.first_response_due_at)}</small><small>Resolución · {formatSlaDeadline(query.data.resolution_due_at)}</small></span>
    </div>
  );
}

const advisorQueues = [
  { value: "assigned_to_me", label: "Asignados a mí" },
  { value: "unassigned", label: "Sin asignar" },
  { value: "sla_soon", label: "SLA próximo" },
  { value: "sla_overdue", label: "SLA vencido" },
  { value: "pending_first_response", label: "Primera respuesta pendiente" },
  { value: "recently_updated", label: "Actualizados recientemente" },
] as const;

export function AdvisorInboxPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<(typeof advisorQueues)[number]["value"]>("assigned_to_me");
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [takeErrors, setTakeErrors] = useState<Record<string, string>>({});
  const slaSoon = useQuery({
    queryKey: ["operations", "advisor-inbox", "sla-soon"],
    queryFn: () => api.tickets.operations({ queue: "sla_soon", page: 1, page_size: 100 }),
  });
  const slaOverdue = useQuery({
    queryKey: ["operations", "advisor-inbox", "sla-overdue"],
    queryFn: () => api.tickets.operations({ queue: "sla_overdue", page: 1, page_size: 100 }),
  });
  const slaFlags = useMemo(
    () => ({
      soon: new Set(ticketItems(slaSoon.data).map((ticket) => ticket.id)),
      overdue: new Set(ticketItems(slaOverdue.data).map((ticket) => ticket.id)),
    }),
    [slaOverdue.data, slaSoon.data],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const params = {
    queue,
    status: status || undefined,
    priority: priority || undefined,
    search: search || undefined,
    created_from: toIsoStart(createdFrom),
    created_to: toIsoEnd(createdTo),
    page,
    page_size: pageSize,
  };
  const query = useQuery({
    queryKey: ["operations", "advisor-inbox", params],
    queryFn: () => api.tickets.operations(params),
  });
  const take = useMutation({
    mutationFn: (ticket: Ticket) => api.tickets.take(ticket.id, ticket.version),
    onSuccess: async (ticket) => {
      setTakeErrors((previous) => ({ ...previous, [ticket.id]: "" }));
      queryClient.setQueryData(["ticket", ticket.id], ticket);
      await invalidateTicketLists(queryClient);
      await navigate(`/asesor/tickets/${ticket.id}`);
    },
    onError: async (error, ticket) => {
      const message = error instanceof ApiError && error.status === 409
        ? "Este ticket ya fue tomado por otro asesor. Actualizamos la bandeja."
        : error instanceof ApiError && error.status === 403
          ? "No tienes permisos para tomar este ticket."
          : errorMessage(error);
      setTakeErrors((previous) => ({ ...previous, [ticket.id]: message }));
      if (isConflict(error)) await query.refetch();
    },
  });
  const tickets = ticketItems(query.data);

  const resetPage = (update: () => void) => {
    update();
    setPage(1);
  };

  return (
    <>
      <PageIntro title="Bandeja de atención" description="Busca, filtra y toma tickets disponibles; consulta SLA y casos a tu cargo." />
      <FilterDrawer label="Filtros de la bandeja">
        <div className="staff-filter-grid">
          <div className="staff-filter-search">
            <label className="staff-filter-search__label" htmlFor="advisor-inbox-search">
              Búsqueda
            </label>
            <div className="search-field">
              <Search aria-hidden="true" />
              <input
                id="advisor-inbox-search"
                value={searchDraft}
                onChange={(event) =>
                  resetPage(() => setSearchDraft(event.target.value))
                }
                placeholder="Código, asunto o cliente"
                autoComplete="off"
              />
            </div>
          </div>
          <label>
            <span>Cola</span>
            <select
              value={queue}
              onChange={(event) =>
                resetPage(() => setQueue(event.target.value as typeof queue))
              }
            >
              {advisorQueues.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) =>
                resetPage(() => setStatus(event.target.value as TicketStatus | ""))
              }
            >
              <option value="">Todos los estados</option>
              {activeTicketStatuses.map((value) => (
                <option key={value} value={value}>
                  {getTicketStatusLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) =>
                resetPage(() => setPriority(event.target.value as TicketPriority | ""))
              }
            >
              <option value="">Todas</option>
              {priorityValues.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="staff-filter-date">
            <span>Desde</span>
            <span className="staff-filter-date__control">
              <CalendarDays aria-hidden="true" />
              <input
                type="date"
                value={createdFrom}
                onChange={(event) =>
                  resetPage(() => setCreatedFrom(event.target.value))
                }
              />
            </span>
          </label>
          <label className="staff-filter-date">
            <span>Hasta</span>
            <span className="staff-filter-date__control">
              <CalendarDays aria-hidden="true" />
              <input
                type="date"
                value={createdTo}
                onChange={(event) =>
                  resetPage(() => setCreatedTo(event.target.value))
                }
              />
            </span>
          </label>
        </div>
      </FilterDrawer>
      {query.isLoading ? <Skeleton rows={7} /> : null}
      {query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : null}
      {!query.isLoading && !query.isError && tickets.length ? (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>Código</th><th>Solicitud</th><th>Prioridad</th><th>Estado</th><th>Responsable</th><th>SLA</th><th>Actualización</th><th>Acción disponible</th></tr></thead>
            <tbody>{tickets.map((ticket) => {
              const action = getAdvisorInboxAction(ticket, session?.user.id ?? "");
              return <tr key={ticket.id}>
                <td><strong>{ticket.tracking_code}</strong></td>
                <td><span className="staff-table__subject">{ticket.subject}</span></td>
                <td><PriorityBadge priority={ticket.priority} /></td>
                <td><StatusBadge status={ticket.status} /></td>
                <td>{ticket.assigned_advisor_id === null ? "Sin asignar" : action === "other" ? "Asignado a otro asesor" : session?.user.full_name ?? "Asignado a mí"}</td>
                <td>{slaFlags.overdue.has(ticket.id) ? <span className="staff-sla-flag staff-sla-flag--overdue">Vencido</span> : slaFlags.soon.has(ticket.id) ? <span className="staff-sla-flag">Próximo</span> : "No informado"}</td>
                <td><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time></td>
                <td className="staff-table__action">
                  {action === "take" ? <Button isLoading={take.isPending && take.variables?.id === ticket.id} disabled={take.isPending} onClick={() => take.mutate(ticket)}>Tomar ticket</Button> : null}
                  {action === "open" ? <Link className="button button--secondary" to={`/asesor/tickets/${ticket.id}`} state={{ returnTo: "/asesor/bandeja" }}>Abrir detalle <ChevronRight aria-hidden="true" /></Link> : null}
                  {action === "other" ? <span className="muted">Asignado a otro asesor</span> : null}
                  {action === "none" ? <span className="muted">No disponible</span> : null}
                  {takeErrors[ticket.id] ? <div className="form-error" role="alert">{takeErrors[ticket.id]}{takeErrors[ticket.id]?.includes("conectar") ? <button type="button" onClick={() => take.mutate(ticket)}>Reintentar</button> : null}</div> : null}
                </td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      ) : null}
      {!query.isLoading && !query.isError && !tickets.length ? <StatePanel kind="empty" title="La bandeja no tiene resultados" message="Cambia los filtros o actualiza la búsqueda." /> : null}
      {query.data ? <PaginationControls page={page} totalPages={ticketPages(query.data)} total={ticketTotal(query.data)} onPageChange={setPage} /> : null}
    </>
  );
}

export function AdvisorHistoryPage() {
  return <HistoryPage role="ASESOR" />;
}

export function SupervisorHistoryPage() {
  return <HistoryPage role="SUPERVISOR" />;
}

function datePresetRange(preset: "7d" | "30d" | "week" | "month", now = new Date()) {
  const start = new Date(now);
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "week") {
    const weekday = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - weekday);
  }
  if (preset === "month") start.setDate(1);
  return {
    from: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
    to: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
  };
}

function HistoryPage({ role }: { readonly role: "ASESOR" | "SUPERVISOR" }) {
  const basePath = role === "ASESOR" ? "/asesor/tickets" : "/supervisor/tickets";
  const returnTo = role === "ASESOR" ? "/asesor/historial" : "/supervisor/historial";
  const [preset, setPreset] = useState<"7d" | "30d" | "week" | "month" | "custom">("7d");
  const initialRange = datePresetRange("7d");
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [status, setStatus] = useState<(typeof historyStatusOptions)[number] | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const statuses = status ? [status] : historyStatuses;
  const queries = useQueries({
    queries: statuses.map((state) => ({
      queryKey: ["tickets", "history", role, state, from, to, search, priority, page],
      queryFn: () => api.tickets.list({
        status: state,
        updated_from: toIsoStart(from),
        updated_to: toIsoEnd(to),
        search: search || undefined,
        priority: priority || undefined,
        page,
        page_size: 10,
      }),
    })),
  });
  const loading = queries.some((query) => query.isLoading);
  const error = queries.find((query) => query.isError)?.error;
  const items = queries.flatMap((query) => ticketItems(query.data)).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const total = queries.reduce((sum, query) => sum + ticketTotal(query.data), 0);
  const totalPages = Math.max(1, ...queries.map((query) => ticketPages(query.data)));
  const setPresetRange = (value: typeof preset) => {
    setPreset(value);
    if (value !== "custom") {
      const range = datePresetRange(value);
      setFrom(range.from);
      setTo(range.to);
    }
    setPage(1);
  };

  return (
    <div className="staff-rework-page staff-rework-page--history">
      <StaffSectionTabs role={role} active="history" />
      <PageIntro title={role === "ASESOR" ? "Historial de atención" : "Historial de tickets"} description="Consulta tickets cerrados o cancelados. Los resueltos siguen activos hasta su cierre." />
      <p className="staff-history-note staff-rework-history-note">El historial contiene tickets cerrados y cancelados. Los tickets resueltos continúan en el Kanban hasta que se cierren.</p>
      <FilterDrawer label="Filtros del historial">
      <div className="staff-history-filters" aria-label="Filtros de historial">
        <label><span>Periodo</span><select value={preset} onChange={(event) => setPresetRange(event.target.value as typeof preset)}><option value="7d">Últimos 7 días</option><option value="30d">Últimos 30 días</option><option value="week">Esta semana</option><option value="month">Este mes</option><option value="custom">Periodo personalizado</option></select></label>
        <label><span>Desde</span><input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPreset("custom"); setPage(1); }} /></label>
        <label><span>Hasta</span><input type="date" value={to} onChange={(event) => { setTo(event.target.value); setPreset("custom"); setPage(1); }} /></label>
        <label><span>Estado</span><select value={status} onChange={(event) => { setStatus(event.target.value as (typeof historyStatusOptions)[number] | ""); setPage(1); }}><option value="">Finalizados: cerrados y cancelados</option>{historyStatusOptions.map((value) => <option key={value} value={value}>{getTicketStatusLabel(value)}</option>)}</select></label>
        <label><span>Prioridad</span><select value={priority} onChange={(event) => { setPriority(event.target.value as TicketPriority | ""); setPage(1); }}><option value="">Todas</option>{priorityValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="staff-filter-search">
          <label className="staff-filter-search__label" htmlFor="advisor-history-search">
            Búsqueda
          </label>
          <div className="search-field">
            <Search aria-hidden="true" />
            <input
              id="advisor-history-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Código o asunto"
              autoComplete="off"
            />
          </div>
        </div>
      </div>
      </FilterDrawer>
      {loading ? <Skeleton rows={6} /> : null}
      {error ? <QueryError error={error} retry={() => void Promise.all(queries.map((query) => query.refetch()))} /> : null}
      {!loading && !error && items.length ? <TicketHistoryTable tickets={items} basePath={basePath} returnTo={returnTo} /> : null}
      {!loading && !error && !items.length ? <StatePanel kind="empty" title="No hay tickets finalizados en este periodo" message="Ajusta el rango de fechas o cambia el filtro de estado." /> : null}
      {!loading && !error ? <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} /> : null}
    </div>
  );
}

function TicketHistoryTable({ tickets, basePath, returnTo }: { readonly tickets: readonly Ticket[]; readonly basePath: string; readonly returnTo: string }) {
  return (
    <div className="staff-history-results">
      <div className="staff-table-wrap staff-history-table-wrap"><table className="staff-table staff-history-table"><thead><tr><th>Código</th><th>Solicitud</th><th>Cliente</th><th>Prioridad</th><th>Estado</th><th>Actualización</th><th /></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.tracking_code}</strong></td><td><span className="staff-table__subject">{ticket.subject}</span></td><td>{ticket.client_name?.trim() || "No informado"}</td><td><PriorityBadge priority={ticket.priority} /></td><td><StatusBadge status={ticket.status} /></td><td><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time></td><td><Link className="text-link" state={{ returnTo }} to={`${basePath}/${ticket.id}`}>Abrir detalle <ChevronRight aria-hidden="true" /></Link></td></tr>)}</tbody></table></div>
      <ul className="staff-history-cards" aria-label="Tickets finalizados">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <div className="staff-history-cards__top"><strong>{ticket.tracking_code}</strong><StatusBadge status={ticket.status} /></div>
            <h2>{ticket.subject}</h2>
            <p><span>Cliente</span><strong>{ticket.client_name?.trim() || "No informado"}</strong></p>
            <p><span>Prioridad</span><PriorityBadge priority={ticket.priority} /></p>
            <time dateTime={ticket.updated_at}>Actualizado {formatDate(ticket.updated_at)}</time>
            <Link className="text-link" state={{ returnTo }} to={`${basePath}/${ticket.id}`}>Abrir detalle <ChevronRight aria-hidden="true" /></Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SupervisorDashboardPage() {
  const queryClient = useQueryClient();
  const summary = useQuery({ queryKey: ["reports", "summary"], queryFn: () => api.reports.summary() });
  const unassigned = useQuery({ queryKey: ["operations", "supervisor", "unassigned-count"], queryFn: () => api.tickets.operations({ queue: "unassigned", page: 1, page_size: 1 }) });
  const soon = useQuery({ queryKey: ["operations", "supervisor", "sla-soon-count"], queryFn: () => api.tickets.operations({ queue: "sla_soon", page: 1, page_size: 1 }) });
  const overdue = useQuery({ queryKey: ["operations", "supervisor", "sla-overdue-count"], queryFn: () => api.tickets.operations({ queue: "sla_overdue", page: 1, page_size: 1 }) });
  const recent = useQuery({ queryKey: ["operations", "supervisor", "recent"], queryFn: () => api.tickets.operations({ queue: "recently_updated", page: 1, page_size: 6 }) });
  const report = summary.data;
  const openCount = report ? Math.max(0, report.total_tickets - report.closed_tickets - report.cancelled_tickets) : undefined;
  const metrics = [
    { label: "Tickets abiertos", value: openCount, note: "Total menos cerrados y cancelados." },
    { label: "Sin asignar", value: unassigned.data?.total, note: "Tickets disponibles en la cola." },
    { label: "Pendientes del cliente", value: report?.pending_client_tickets, note: "Esperan respuesta del cliente." },
    { label: "Resueltos", value: report?.resolved_tickets, note: "Pendientes de cierre o reanudación." },
    { label: "SLA próximo", value: soon.data?.total, note: "Cola de vencimiento próximo." },
    { label: "SLA vencido", value: overdue.data?.total, note: "Cola fuera de tiempo." },
  ];
  const hasCountError = summary.isError || unassigned.isError || soon.isError || overdue.isError;

  return (
    <>
      <PageIntro title="Operación" description="Indicadores y actividad reciente para priorizar la gestión de la cola." actions={<Button className="supervisor-refresh-action" variant="secondary" onClick={() => { void queryClient.invalidateQueries({ queryKey: ["reports", "summary"] }); void queryClient.invalidateQueries({ queryKey: ["operations", "supervisor"] }); }}><span className="supervisor-refresh-action__content"><span className="supervisor-refresh-action__icon"><RefreshCw aria-hidden="true" /></span>Actualizar</span></Button>} />
      <section className="dashboard-summary staff-summary staff-summary--supervisor" aria-label="Indicadores operativos">
        {metrics.map(({ label, value, note }) => <article key={label}><span>{label}</span><strong>{value ?? "—"}</strong><p>{note}</p></article>)}
      </section>
      {hasCountError ? <div className="form-notice" role="status">Uno o más indicadores no pudieron cargarse desde el servicio.</div> : null}
      <section className="content-section">
        <div className="section-bar"><div><h2>Actividad reciente</h2><p>Cambios recientes que requieren contexto operativo.</p></div><Link className="button button--secondary" to="/supervisor/cola">Ir a la cola <ArrowUpRight aria-hidden="true" /></Link></div>
        {recent.isLoading ? <Skeleton rows={4} /> : recent.isError ? <QueryError error={recent.error} retry={() => void recent.refetch()} /> : recent.data?.items.length ? <div className="staff-recent-list">{recent.data.items.map((ticket) => <Link key={ticket.id} to={`/supervisor/tickets/${ticket.id}`} state={{ returnTo: "/supervisor/operacion" }}><span><strong>{ticket.tracking_code}</strong><b>{ticket.subject}</b></span><StatusBadge status={ticket.status} /><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time><ChevronRight aria-hidden="true" /></Link>)}</div> : <StatePanel kind="empty" title="Sin actividad reciente" message="No hay tickets actualizados en el periodo de operación reciente." />}
      </section>
      <div className="supervisor-shortcuts"><Link to="/supervisor/cola"><TableProperties aria-hidden="true" /><span><strong>Cola de tickets</strong><small>Filtra, revisa y asigna tickets activos.</small></span><ChevronRight aria-hidden="true" /></Link><Link to="/supervisor/asignaciones"><UserCheck aria-hidden="true" /><span><strong>Asignaciones</strong><small>Distribuye tickets entre asesores activos.</small></span><ChevronRight aria-hidden="true" /></Link><Link to="/supervisor/sla"><Clock3 aria-hidden="true" /><span><strong>Control de SLA</strong><small>Consulta las políticas de atención.</small></span><ChevronRight aria-hidden="true" /></Link></div>
    </>
  );
}

type SlaFilter = "" | "sla_soon" | "sla_overdue";

interface SupervisorFilters {
  readonly status: TicketStatus | "";
  readonly advisorId: string;
  readonly priority: TicketPriority | "";
  readonly sla: SlaFilter;
  readonly search: string;
  readonly from: string;
  readonly to: string;
  readonly unassignedOnly: boolean;
}

function TicketFilterFields({
  filters,
  advisors,
  onChange,
}: {
  readonly filters: SupervisorFilters;
  readonly advisors: readonly PublicUser[];
  readonly onChange: (next: Partial<SupervisorFilters>) => void;
}) {
  return (
    <FilterDrawer label="Filtros de la cola">
      <div className="staff-filter-grid staff-filter-grid--supervisor">
        <div className="staff-filter-search">
          <label className="staff-filter-search__label" htmlFor="supervisor-queue-search">Buscar</label>
          <div className="search-field"><Search aria-hidden="true" /><input id="supervisor-queue-search" value={filters.search} onChange={(event) => onChange({ search: event.target.value })} placeholder="Código, asunto o cliente" autoComplete="off" /></div>
        </div>
        <label><span>Estado</span><select value={filters.status} onChange={(event) => onChange({ status: event.target.value as TicketStatus | "" })}><option value="">Todos los activos</option>{activeTicketStatuses.map((value) => <option key={value} value={value}>{getTicketStatusLabel(value)}</option>)}</select></label>
        <label><span>Asesor</span><select value={filters.advisorId} onChange={(event) => onChange({ advisorId: event.target.value })}><option value="">Todos los asesores</option>{advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}</select></label>
        <label><span>Prioridad</span><select value={filters.priority} onChange={(event) => onChange({ priority: event.target.value as TicketPriority | "" })}><option value="">Todas</option>{priorityValues.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label><span>SLA</span><select value={filters.sla} onChange={(event) => onChange({ sla: event.target.value as SlaFilter })}><option value="">Todos</option><option value="sla_soon">Próximo a vencer</option><option value="sla_overdue">Vencido</option></select></label>
        <label><span>Desde</span><input type="date" value={filters.from} onChange={(event) => onChange({ from: event.target.value })} /></label>
        <label><span>Hasta</span><input type="date" value={filters.to} onChange={(event) => onChange({ to: event.target.value })} /></label>
        <label className="staff-check-filter">
          <span>Asignación</span>
          <span className="staff-check-filter__control">
            <input type="checkbox" checked={filters.unassignedOnly} onChange={(event) => onChange({ unassignedOnly: event.target.checked })} />
            <span>Tickets sin asignar</span>
          </span>
        </label>
      </div>
    </FilterDrawer>
  );
}

export function SupervisorQueuePage() {
  const queryClient = useQueryClient();
  const advisors = useQuery({ queryKey: ["advisors"], queryFn: api.users.advisors });
  const [view, setView] = useState<"table" | "kanban">("kanban");
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<SupervisorFilters>({ status: "", advisorId: "", priority: "", sla: "", search: "", from: "", to: "", unassignedOnly: false });
  const changeFilters = (next: Partial<SupervisorFilters>) => { setFilters((previous) => ({ ...previous, ...next })); setPage(1); };
  const queueMode = filters.sla !== "" || filters.unassignedOnly;
  const queue = filters.unassignedOnly ? "unassigned" : filters.sla;
  const operationsParams: TicketQueryParams = {
    queue,
    status: filters.status || undefined,
    advisor_id: filters.advisorId || undefined,
    priority: filters.priority || undefined,
    search: filters.search || undefined,
    created_from: toIsoStart(filters.from),
    created_to: toIsoEnd(filters.to),
    page,
    page_size: pageSize,
  };
  const operations = useQuery({
    queryKey: ["operations", "supervisor-queue", operationsParams],
    queryFn: () => api.tickets.operations(operationsParams),
    enabled: view === "table" && queueMode,
  });
  const selectedStatuses = filters.status ? [filters.status] : supervisorStatuses;
  const tableQueries = useQueries({
    queries: selectedStatuses.map((status) => {
      const singleColumn = Boolean(filters.status);
      const params: TicketQueryParams = {
        status,
        assigned_advisor_id: filters.advisorId || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        created_from: toIsoStart(filters.from),
        created_to: toIsoEnd(filters.to),
        page,
        page_size: singleColumn ? pageSize : 4,
      };
      return {
        queryKey: ["tickets", "supervisor-queue", status, params],
        queryFn: () => api.tickets.list(params),
        enabled: view === "table" && !queueMode,
      };
    }),
  });
  const assignment = useMutation({
    mutationFn: ({ ticket, advisorId }: { readonly ticket: Ticket; readonly advisorId: string }) =>
      api.tickets.assign(ticket.id, advisorId, ticket.version),
    onSuccess: async () => { await invalidateTicketLists(queryClient); },
    onError: async (error) => { if (isConflict(error)) await invalidateTicketLists(queryClient); },
  });
  const operationError = queueMode && view === "table" ? operations.error : tableQueries.find((query) => query.isError)?.error;
  const operationLoading = queueMode && view === "table" ? operations.isLoading : tableQueries.some((query) => query.isLoading);
  const operationTickets = queueMode && view === "table"
    ? ticketItems(operations.data)
    : tableQueries.flatMap((query) => ticketItems(query.data)).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
  const total = queueMode && view === "table" ? ticketTotal(operations.data) : tableQueries.reduce((sum, query) => sum + ticketTotal(query.data), 0);
  const totalPages = queueMode && view === "table" ? ticketPages(operations.data) : Math.max(1, ...tableQueries.map((query) => ticketPages(query.data)));

  return (
    <div className="staff-rework-page">
      <StaffSectionTabs role="SUPERVISOR" active="board" />
      <PageIntro title="Cola de atención" description="Administra tickets activos con filtros de estado, responsable, prioridad, SLA y fecha." />
      <div className="staff-view-switch staff-rework-view-switch" role="tablist" aria-label="Vista de la cola">
        <button type="button" role="tab" aria-selected={view === "table"} onClick={() => setView("table")}><TableProperties aria-hidden="true" />Vista tabla</button>
        <button type="button" role="tab" aria-selected={view === "kanban"} onClick={() => setView("kanban")}><LayoutGrid aria-hidden="true" />Vista Kanban</button>
      </div>
      <TicketFilterFields filters={filters} advisors={advisors.data ?? []} onChange={changeFilters} />
      {view === "table" ? (
        <>
          {operationLoading ? <Skeleton rows={8} /> : null}
          {operationError ? <QueryError error={operationError} retry={() => { if (queueMode) void operations.refetch(); else void Promise.all(tableQueries.map((query) => query.refetch())); }} /> : null}
          {!operationLoading && !operationError && operationTickets.length ? <SupervisorTicketTable tickets={operationTickets} advisors={advisors.data ?? []} assignment={assignment} /> : null}
          {!operationLoading && !operationError && !operationTickets.length ? <StatePanel kind="empty" title="La cola no tiene resultados" message="Ajusta los filtros o consulta el historial para ver tickets finalizados." /> : null}
          {!operationLoading && !operationError ? <PaginationControls page={page} totalPages={totalPages} total={total} onPageChange={setPage} /> : null}
        </>
      ) : (
        <SupervisorKanban filters={filters} advisors={advisors.data ?? []} />
      )}
      {assignment.error ? <div className="form-error" role="alert">{errorMessage(assignment.error)}</div> : null}
    </div>
  );
}

function SupervisorTicketTable({
  tickets,
  advisors,
  assignment,
}: {
  readonly tickets: readonly Ticket[];
  readonly advisors: readonly PublicUser[];
  readonly assignment: ReturnType<typeof useMutation<Ticket, Error, { readonly ticket: Ticket; readonly advisorId: string }>>;
}) {
  const [selectedAdvisors, setSelectedAdvisors] = useState<Record<string, string>>({});
  return (
    <div className="staff-table-wrap staff-table-wrap--supervisor"><table className="staff-table staff-table--supervisor"><thead><tr><th>Código</th><th>Solicitud</th><th>Prioridad</th><th>Estado</th><th>Asesor asignado</th><th>Actualización</th><th>Acción</th></tr></thead><tbody>
      {tickets.map((ticket) => <tr key={ticket.id}>
        <td><strong>{ticket.tracking_code}</strong></td><td><Link className="staff-table__subject" to={`/supervisor/tickets/${ticket.id}`} state={{ returnTo: "/supervisor/cola" }}>{ticket.subject}</Link></td><td><PriorityBadge priority={ticket.priority} /></td><td><StatusBadge status={ticket.status} /></td>
        <td>{getTicketResponsibleLabel(ticket, "SUPERVISOR", advisors)}</td>
        <td><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time></td>
        <td className="staff-table__action"><div className="staff-inline-assign"><label><span className="sr-only">Asignar {ticket.tracking_code}</span><select value={selectedAdvisors[ticket.id] ?? ""} onChange={(event) => setSelectedAdvisors((previous) => ({ ...previous, [ticket.id]: event.target.value }))}><option value="">{ticket.assigned_advisor_id ? "Reasignar…" : "Asignar…"}</option>{advisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}</select></label><Button variant="secondary" disabled={!selectedAdvisors[ticket.id] || assignment.isPending} isLoading={assignment.isPending && assignment.variables?.ticket.id === ticket.id} onClick={() => { const advisorId = selectedAdvisors[ticket.id]; if (advisorId && window.confirm(`¿Confirmas ${ticket.assigned_advisor_id ? "reasignar" : "asignar"} ${ticket.tracking_code}?`)) assignment.mutate({ ticket, advisorId }); }}>Guardar</Button></div><Link className="text-link" state={{ returnTo: "/supervisor/cola" }} to={`/supervisor/tickets/${ticket.id}`}>Detalle <ChevronRight aria-hidden="true" /></Link></td>
      </tr>)}
    </tbody></table></div>
  );
}

function SupervisorKanban({ filters, advisors }: { readonly filters: SupervisorFilters; readonly advisors: readonly PublicUser[] }) {
  const [mobileStatus, setMobileStatus] = useState<TicketStatus>("NUEVO");
  const [stageTotals, setStageTotals] = useState<Partial<Record<TicketStatus, number>>>({});
  const reportStageTotal = useCallback((status: TicketStatus, total: number) => {
    setStageTotals((previous) => previous[status] === total ? previous : { ...previous, [status]: total });
  }, []);
  const movement = useKanbanMovement("SUPERVISOR", advisors, "", setMobileStatus);
  const statuses = filters.status ? [filters.status] : supervisorStatuses;
  const activeMobileStatus = statuses.find((status) => status === mobileStatus)
    ?? statuses[0]
    ?? "NUEVO";
  return (
    <section className="staff-board-section staff-rework-board" aria-label="Kanban de supervisión">
      <StaffStageTabs statuses={statuses} selected={activeMobileStatus} counts={stageTotals} onSelect={setMobileStatus} movement={movement} role="SUPERVISOR" />
      <div className="staff-kanban staff-kanban--supervisor staff-kanban--redesign" data-mobile-status={activeMobileStatus}>
        {statuses.map((status) => <SupervisorKanbanColumn key={status} status={status} filters={filters} advisors={advisors} reportTotal={reportStageTotal} movement={movement} />)}
      </div>
      {movement.feedback ? <p className="staff-kanban-feedback" role="status" aria-live="polite">{movement.feedback}</p> : null}
      {movement.dialog}
    </section>
  );
}

function SupervisorKanbanColumn({ status, filters, advisors, reportTotal, movement }: { readonly status: TicketStatus; readonly filters: SupervisorFilters; readonly advisors: readonly PublicUser[]; readonly reportTotal: (status: TicketStatus, total: number) => void; readonly movement: ReturnType<typeof useKanbanMovement> }) {
  const query = useInfiniteQuery({
    queryKey: ["tickets", "supervisor-kanban", status, filters],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const params: TicketQueryParams = {
        status,
        assigned_advisor_id: filters.advisorId || undefined,
        priority: filters.priority || undefined,
        search: filters.search || undefined,
        created_from: toIsoStart(filters.from),
        created_to: toIsoEnd(filters.to),
        page: pageParam,
        page_size: kanbanPageSize,
      };
      return filters.unassignedOnly || filters.sla
        ? api.tickets.operations({
            ...params,
            queue: filters.unassignedOnly ? "unassigned" : filters.sla,
            advisor_id: filters.advisorId || undefined,
          })
        : api.tickets.list(params);
    },
    getNextPageParam: (lastPage) => {
      const page = isPageResult(lastPage) ? lastPage.page : 1;
      const last = isPageResult(lastPage) ? lastPage.total_pages ?? 1 : 1;
      return page < last ? page + 1 : undefined;
    },
  });
  const tickets = query.data?.pages.flatMap((page) => ticketItems(page)) ?? [];
  const firstPage = query.data?.pages[0];
  const total = firstPage ? ticketTotal(firstPage) : 0;
  useEffect(() => {
    if (firstPage) reportTotal(status, total);
  }, [firstPage, reportTotal, status, total]);
  const isDropTarget = movement.dragTargetStatus === status;
  return <section
    className="staff-kanban__column staff-kanban__column--redesign"
    id={`staff-stage-panel-${status}`}
    role="tabpanel"
    aria-labelledby={`staff-stage-tab-${status}`}
    data-status={status}
    data-kanban-drop-status={status}
    data-drop-state={getKanbanDropState(movement.draggedTicket, status, "SUPERVISOR", "", movement.dragTargetStatus)}
  >
    <header>
      <h3 id={`supervisor-column-${status}`}>{getTicketStatusLabel(status)}</h3>
      <span>{total}</span>
      {isDropTarget ? <span className="staff-kanban__drop-target">Destino</span> : null}
    </header>
    {query.isLoading ? <Skeleton rows={3} /> : null}
    {query.isError ? <QueryError error={query.error} retry={() => void query.refetch()} /> : null}
    {!query.isLoading && !query.isError && !tickets.length ? <StatePanel kind="empty" title={getTicketStatusLabel(status)} message="No hay tickets en este estado con los filtros actuales." /> : null}
    {tickets.length ? (
      <div className="staff-kanban__cards">
        {tickets.map((ticket) => (
          <TicketWorkCard
            key={ticket.id}
            ticket={ticket}
            basePath="/supervisor/tickets"
            returnTo="/supervisor/cola"
            responsibleLabel={getTicketResponsibleLabel(ticket, "SUPERVISOR", advisors)}
            isUpdating={movement.pendingTicketId === ticket.id}
            movement={movement}
          />
        ))}
      </div>
    ) : null}
    {query.hasNextPage ? <Button variant="secondary" isLoading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Cargar más</Button> : null}
  </section>;
}

export function AssignmentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [advisorId, setAdvisorId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssignmentFilters>({ search: "", priority: "", from: "", to: "" });
  const [appliedSearch, setAppliedSearch] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setAppliedSearch(filters.search.trim()), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search]);
  const searchPending = filters.search.trim() !== appliedSearch;
  const queryParams: TicketQueryParams = {
    queue: "unassigned",
    search: appliedSearch || undefined,
    priority: filters.priority || undefined,
    created_from: toIsoStart(filters.from),
    created_to: toIsoEnd(filters.to),
    page,
    page_size: pageSize,
  };
  const queue = useQuery({ queryKey: ["tickets", "unassigned", queryParams], queryFn: () => api.tickets.operations(queryParams) });
  const advisors = useQuery({ queryKey: ["advisors"], queryFn: api.users.advisors });
  const available = ticketItems(queue.data);
  const hasActiveFilters = Boolean(filters.search.trim() || filters.priority || filters.from || filters.to);
  const updateFilters = (next: Partial<AssignmentFilters>) => {
    setFilters((previous) => ({ ...previous, ...next }));
    setPage(1);
    setSelected([]);
    setResult(null);
  };
  const clearFilters = () => updateFilters({ search: "", priority: "", from: "", to: "" });
  const assignment = useMutation({
    mutationFn: async () => {
      const selectedTickets = available.filter((ticket) => selected.includes(ticket.id));
      const outcomes = await Promise.allSettled(selectedTickets.map((ticket) => api.tickets.assign(ticket.id, advisorId, ticket.version)));
      return { succeeded: outcomes.filter((outcome) => outcome.status === "fulfilled").length, failed: outcomes.filter((outcome) => outcome.status === "rejected").length };
    },
    onSuccess: async (outcomes) => {
      setResult(outcomes.failed ? `${outcomes.succeeded} asignados; ${outcomes.failed} requieren revisión.` : `${outcomes.succeeded} tickets asignados correctamente.`);
      setSelected([]);
      await invalidateTicketLists(queryClient);
    },
    onError: async (error) => { if (isConflict(error)) await queue.refetch(); },
  });
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const assignSelected = () => {
    if (!selected.length || !advisorId) return;
    if (window.confirm(`¿Confirmas asignar ${selected.length} ticket${selected.length === 1 ? "" : "s"}?`)) { setResult(null); assignment.mutate(); }
  };
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    setSelected([]);
    setResult(null);
  };

  return <>
    <PageIntro title="Asignaciones" description="Distribuye solicitudes disponibles entre asesores activos con una gestión clara y trazable." />
    <FilterDrawer label="Filtros de asignación">
      <div className="staff-filter-grid staff-assignment-filters">
        <div className="staff-filter-search">
          <label className="staff-filter-search__label" htmlFor="assignment-search">Buscar solicitud</label>
          <div className="search-field"><Search aria-hidden="true" /><input id="assignment-search" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Código o asunto de la solicitud" autoComplete="off" /></div>
        </div>
        <label><span>Prioridad</span><select value={filters.priority} onChange={(event) => updateFilters({ priority: event.target.value as TicketPriority | "" })}><option value="">Todas las prioridades</option>{priorityValues.map((value) => <option key={value} value={value}>{value.charAt(0) + value.slice(1).toLowerCase()}</option>)}</select></label>
        <label className="staff-filter-date"><span>Creada desde</span><span className="staff-filter-date__control"><CalendarDays aria-hidden="true" /><input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilters({ from: event.target.value })} /></span></label>
        <label className="staff-filter-date"><span>Creada hasta</span><span className="staff-filter-date__control"><CalendarDays aria-hidden="true" /><input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilters({ to: event.target.value })} /></span></label>
      </div>
      <div className="staff-assignment-filters__actions"><Button className="staff-assignment-filters__clear" variant="quiet" disabled={!hasActiveFilters} onClick={clearFilters}><X aria-hidden="true" />Limpiar filtros</Button></div>
    </FilterDrawer>
    <div className="bulk-bar staff-bulk-bar staff-assignment-bulk">
      <div className="staff-assignment-bulk__selection" aria-live="polite">
        <strong>{selected.length === 1 ? "1 solicitud seleccionada" : `${selected.length} solicitudes seleccionadas`}</strong>
        <span>{selected.length ? "Elige el asesor que continuará con estas solicitudes." : "Selecciona una o más solicitudes para asignarlas."}</span>
      </div>
      <label className="staff-assignment-bulk__advisor"><span>Asesor responsable</span><select value={advisorId} onChange={(event) => setAdvisorId(event.target.value)}><option value="">Selecciona un asesor activo</option>{advisors.data?.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.full_name}</option>)}</select></label>
      <Button className="staff-assignment-bulk__submit" disabled={!selected.length || !advisorId || assignment.isPending} isLoading={assignment.isPending} onClick={assignSelected}>{assignment.isPending ? null : <UserCheck aria-hidden="true" />}Asignar selección</Button>
    </div>
    {result ? <div className={result.includes("requieren") ? "form-notice" : "form-success"} role="status">{result}</div> : null}
    {assignment.error ? <div className="form-error" role="alert">{errorMessage(assignment.error)}</div> : null}
    {queue.isLoading || searchPending ? <Skeleton rows={8} /> : null}
    {queue.isError && !searchPending ? <QueryError error={queue.error} retry={() => void queue.refetch()} /> : null}
    {!queue.isLoading && !queue.isError && !searchPending ? <div className="staff-assignment-results"><div><h2>Solicitudes disponibles</h2><p>Selecciona las solicitudes que deseas asignar a un asesor.</p></div><span><strong>{ticketTotal(queue.data)}</strong> {ticketTotal(queue.data) === 1 ? "resultado" : "resultados"}</span></div> : null}
    {!queue.isLoading && !queue.isError && !searchPending && available.length ? <div className="staff-table-wrap staff-assignment-table-wrap"><table className="staff-table staff-assignment-table" aria-label="Solicitudes disponibles para asignación"><caption className="sr-only">Solicitudes sin asignar que pueden asignarse a un asesor.</caption><thead><tr><th scope="col"><span className="sr-only">Seleccionar</span></th><th scope="col">Código</th><th scope="col">Solicitud</th><th scope="col">Prioridad</th><th scope="col">Actualización</th></tr></thead><tbody>{available.map((ticket) => <tr key={ticket.id} className={selected.includes(ticket.id) ? "staff-assignment-table__row--selected" : undefined}><td><label className="staff-assignment-row-select"><span className="sr-only">Seleccionar {ticket.tracking_code}</span><input type="checkbox" checked={selected.includes(ticket.id)} onChange={() => toggle(ticket.id)} /></label></td><td><strong>{ticket.tracking_code}</strong></td><td><span className="staff-table__subject">{ticket.subject}</span></td><td><PriorityBadge priority={ticket.priority} /></td><td><time dateTime={ticket.updated_at}>{formatDate(ticket.updated_at)}</time></td></tr>)}</tbody></table></div> : null}
    {!queue.isLoading && !queue.isError && !searchPending && !available.length ? <StatePanel kind="empty" title={hasActiveFilters ? "No encontramos solicitudes con estos filtros" : "No hay solicitudes sin asignar"} message={hasActiveFilters ? "Prueba otra palabra o ajusta la prioridad y las fechas." : "La cola se actualizará cuando ingresen nuevas solicitudes."} actionLabel={hasActiveFilters ? "Limpiar filtros" : undefined} onAction={hasActiveFilters ? clearFilters : undefined} /> : null}
    {queue.data && !searchPending ? <PaginationControls page={page} totalPages={ticketPages(queue.data)} total={ticketTotal(queue.data)} onPageChange={changePage} /> : null}
  </>;
}
