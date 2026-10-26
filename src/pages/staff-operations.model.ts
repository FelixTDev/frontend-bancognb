import type { PublicUser, Ticket, TicketStatus } from "../shared/types/domain";

export type KanbanRole = "ASESOR" | "SUPERVISOR";
export type KanbanMoveAction =
  | { readonly kind: "status"; readonly targetStatus: TicketStatus; readonly requiresReason: boolean }
  | { readonly kind: "assign"; readonly targetStatus: "ASIGNADO" }
  | { readonly kind: "release"; readonly targetStatus: "NUEVO" };
export type KanbanMoveDecision =
  | { readonly allowed: true; readonly action: KanbanMoveAction }
  | { readonly allowed: false; readonly reason: string };

export const advisorKanbanColumns: readonly {
  readonly status: Extract<
    TicketStatus,
    "ASIGNADO" | "EN_PROCESO" | "PENDIENTE_CLIENTE" | "RESUELTO"
  >;
  readonly title: string;
  readonly emptyMessage: string;
}[] = [
  {
    status: "ASIGNADO",
    title: "Por atender",
    emptyMessage: "No tienes tickets asignados pendientes de iniciar.",
  },
  {
    status: "EN_PROCESO",
    title: "En atención",
    emptyMessage: "No hay tickets en proceso.",
  },
  {
    status: "PENDIENTE_CLIENTE",
    title: "Esperando al cliente",
    emptyMessage: "No hay solicitudes esperando información.",
  },
  {
    status: "RESUELTO",
    title: "Resuelto por cerrar",
    emptyMessage: "No hay tickets resueltos pendientes de cierre.",
  },
];

export const activeTicketStatuses = [
  "NUEVO",
  "ASIGNADO",
  "EN_PROCESO",
  "PENDIENTE_CLIENTE",
  "RESUELTO",
] as const satisfies readonly TicketStatus[];

export const ticketStatusLabels: Record<TicketStatus, string> = {
  NUEVO: "Disponible",
  ASIGNADO: "Por atender",
  EN_PROCESO: "En atención",
  PENDIENTE_CLIENTE: "Esperando al cliente",
  RESUELTO: "Resuelto por cerrar",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const allowedTicketTransitions: Readonly<
  Record<TicketStatus, readonly TicketStatus[]>
> = {
  NUEVO: ["ASIGNADO", "CANCELADO"],
  ASIGNADO: ["EN_PROCESO", "CANCELADO"],
  EN_PROCESO: ["PENDIENTE_CLIENTE", "RESUELTO", "CANCELADO"],
  PENDIENTE_CLIENTE: ["EN_PROCESO"],
  RESUELTO: ["CERRADO", "EN_PROCESO", "CANCELADO"],
  CERRADO: [],
  CANCELADO: [],
};

const historyLabels: Readonly<Record<string, string>> = {
  CREATED: "Ticket creado",
  ASSIGNED: "Ticket asignado",
  TAKEN: "Ticket tomado por el asesor",
  STATUS_CHANGED: "Estado actualizado",
  COMMENT_ADDED: "Comentario agregado",
  RELEASED: "Ticket liberado",
  SLA_STARTED: "SLA iniciado",
  SLA_BREACHED: "SLA vencido",
  SLA_PAUSED: "SLA en pausa",
  SLA_RESUMED: "SLA reanudado",
  SLA_WARNING_SENT: "Aviso de SLA enviado",
  FIRST_RESPONSE: "Primera respuesta enviada",
  FIRST_RESPONSE_SENT: "Primera respuesta enviada",
  FIRST_RESPONSE_RECORDED: "Primera respuesta enviada",
  FIRST_RESPONSE_BREACHED: "Plazo de primera respuesta vencido",
  SLA_FIRST_RESPONSE_BREACHED: "Plazo de primera respuesta vencido",
  TICKET_REOPENED: "Ticket reabierto",
  CLOSED: "Ticket cerrado",
  CANCELLED: "Ticket cancelado",
};

export function getTicketStatusLabel(status: TicketStatus): string {
  return ticketStatusLabels[status];
}

export function getTicketResponsibleLabel(
  ticket: Pick<Ticket, "assigned_advisor_id">,
  role: KanbanRole,
  advisors: readonly PublicUser[],
  currentAdvisorId = "",
): string {
  if (!ticket.assigned_advisor_id) return "Sin asignar";
  if (role === "ASESOR" && ticket.assigned_advisor_id === currentAdvisorId)
    return "A tu cargo";
  const name = advisors.find(({ id }) => id === ticket.assigned_advisor_id)?.full_name.trim();
  return name || "Asesor asignado";
}

export function getKanbanMoveDecision(
  ticket: Pick<Ticket, "status" | "assigned_advisor_id">,
  targetStatus: TicketStatus,
  role: KanbanRole,
  currentAdvisorId = "",
): KanbanMoveDecision {
  if (isTerminalTicket(ticket))
    return { allowed: false, reason: "Los tickets finalizados se gestionan desde su detalle." };
  if (targetStatus === "CERRADO" || targetStatus === "CANCELADO")
    return { allowed: false, reason: "El cierre y la cancelación se gestionan desde el detalle." };
  if (ticket.status === targetStatus)
    return { allowed: false, reason: "El ticket ya está en esa columna." };
  if (role === "ASESOR" && ticket.assigned_advisor_id !== currentAdvisorId)
    return { allowed: false, reason: "Solo puedes mover tickets a tu cargo." };
  if (targetStatus === "NUEVO") {
    return ticket.assigned_advisor_id
      ? { allowed: true, action: { kind: "release", targetStatus: "NUEVO" } }
      : { allowed: false, reason: "El ticket ya está disponible." };
  }
  if (ticket.status === "NUEVO" && targetStatus === "ASIGNADO")
    return role === "SUPERVISOR" && ticket.assigned_advisor_id === null
      ? { allowed: true, action: { kind: "assign", targetStatus: "ASIGNADO" } }
      : { allowed: false, reason: "Solo Supervisión puede asignar tickets nuevos." };
  if (!allowedTicketTransitions[ticket.status].includes(targetStatus))
    return { allowed: false, reason: `No se permite mover de ${getTicketStatusLabel(ticket.status)} a ${getTicketStatusLabel(targetStatus)}.` };
  if (!ticket.assigned_advisor_id)
    return { allowed: false, reason: "Asigna el ticket antes de moverlo a un estado de atención." };
  return {
    allowed: true,
    action: {
      kind: "status",
      targetStatus,
      requiresReason: ticket.status === "RESUELTO" && targetStatus === "EN_PROCESO",
    },
  };
}

export function getKanbanMoveOptions(
  ticket: Pick<Ticket, "status" | "assigned_advisor_id">,
  role: KanbanRole,
  currentAdvisorId = "",
): readonly { readonly status: TicketStatus; readonly action: KanbanMoveAction }[] {
  const statuses = ["NUEVO", "ASIGNADO", "EN_PROCESO", "PENDIENTE_CLIENTE", "RESUELTO"] as const;
  return statuses.flatMap((status) => {
    const decision = getKanbanMoveDecision(ticket, status, role, currentAdvisorId);
    return decision.allowed ? [{ status, action: decision.action }] : [];
  });
}

export function getAdvisorInboxAction(
  ticket: Ticket,
  currentAdvisorId: string,
): "take" | "open" | "other" | "none" {
  if (ticket.status === "NUEVO" && ticket.assigned_advisor_id === null)
    return "take";
  if (ticket.assigned_advisor_id === currentAdvisorId) return "open";
  if (ticket.assigned_advisor_id !== null) return "other";
  return "none";
}

export function sortKanbanTickets(
  tickets: readonly Ticket[],
  sla: {
    readonly overdue: ReadonlySet<string>;
    readonly soon: ReadonlySet<string>;
  },
): readonly Ticket[] {
  const priorityRank = { URGENTE: 0, ALTA: 1, MEDIA: 2, BAJA: 3 } as const;
  return [...tickets].sort((left, right) => {
    const leftSla = sla.overdue.has(left.id) ? 0 : sla.soon.has(left.id) ? 1 : 2;
    const rightSla = sla.overdue.has(right.id) ? 0 : sla.soon.has(right.id) ? 1 : 2;
    if (leftSla !== rightSla) return leftSla - rightSla;
    if (leftSla === 2) {
      const priority = priorityRank[left.priority] - priorityRank[right.priority];
      if (priority !== 0 && Math.min(priorityRank[left.priority], priorityRank[right.priority]) < 2)
        return priority;
    }
    const updateOrder = Date.parse(left.updated_at) - Date.parse(right.updated_at);
    return updateOrder || left.tracking_code.localeCompare(right.tracking_code);
  });
}

export function getHistoryActionLabel(action: string): string {
  const normalized = action.toUpperCase();
  if (normalized.includes("FIRST_RESPONSE") && normalized.includes("BREACH"))
    return "Plazo de primera respuesta vencido";
  if (normalized.includes("FIRST_RESPONSE"))
    return "Primera respuesta enviada";
  if (normalized.includes("SLA") && normalized.includes("BREACH"))
    return "Plazo de atención vencido";
  if (normalized.includes("SLA") && normalized.includes("WARNING"))
    return "Aviso de SLA enviado";
  return historyLabels[normalized] ?? "Actualización operativa";
}

const participantRoleLabels: Readonly<Record<string, string>> = {
  CLIENTE: "Cliente",
  ASESOR: "Asesor",
  SUPERVISOR: "Supervisor",
};

export function getParticipantRoleLabel(role: string | null | undefined): string {
  return role ? participantRoleLabels[role.toUpperCase()] ?? "Participante" : "Participante";
}

export function getParticipantRoleKey(role: string | null | undefined): string {
  const normalized = role?.toUpperCase();
  return normalized === "CLIENTE"
    ? "cliente"
    : normalized === "ASESOR"
      ? "asesor"
      : normalized === "SUPERVISOR"
        ? "supervisor"
        : "participante";
}

export function getParticipantLabel(
  role: string | null | undefined,
  name: string | null | undefined,
): string {
  const roleLabel = getParticipantRoleLabel(role);
  const cleanName = name?.trim();
  return cleanName ? `${roleLabel} · ${cleanName}` : roleLabel;
}

export function getParticipantInitials(
  role: string | null | undefined,
  name: string | null | undefined,
): string {
  const cleanName = name?.trim();
  if (cleanName) {
    return cleanName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => Array.from(part)[0]?.toLocaleUpperCase("es-PE") ?? "")
      .join("");
  }
  const initials: Readonly<Record<string, string>> = {
    CLIENTE: "CL",
    ASESOR: "AS",
    SUPERVISOR: "SU",
  };
  return initials[role?.toUpperCase() ?? ""] ?? "PA";
}

export function getHistoryActorLabel(
  role: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const cleanName = name?.trim();
  if (!role?.trim() || !cleanName) return null;
  const roleLabel = participantRoleLabels[role.toUpperCase()] ?? "Actor";
  return `${roleLabel} · ${cleanName}`;
}

export function getHistoryValueLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (value in ticketStatusLabels) return ticketStatusLabels[value as TicketStatus];
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toLocaleUpperCase("es-PE") + part.slice(1))
    .join(" ");
}

export function isTerminalTicket(ticket: Pick<Ticket, "status">): boolean {
  return ticket.status === "CERRADO" || ticket.status === "CANCELADO";
}
