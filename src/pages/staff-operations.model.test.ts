import { describe, expect, it } from "vitest";
import type { PublicUser, Ticket } from "../shared/types/domain";
import {
  advisorKanbanColumns,
  allowedTicketTransitions,
  getAdvisorInboxAction,
  getKanbanMoveDecision,
  getKanbanMoveOptions,
  getHistoryActionLabel,
  getHistoryActorLabel,
  getHistoryValueLabel,
  getParticipantInitials,
  getParticipantLabel,
  getParticipantRoleKey,
  getTicketResponsibleLabel,
  getTicketStatusLabel,
  isTerminalTicket,
  sortKanbanTickets,
} from "./staff-operations.model";

const ticket = (
  id: string,
  status: Ticket["status"],
  priority: Ticket["priority"] = "MEDIA",
  assignedAdvisorId: string | null = "advisor-1",
  updatedAt = "2026-10-08T12:00:00.000Z",
): Ticket => ({
  id,
  tracking_code: `GNB-${id}`,
  client_id: "client-1",
  conversation_id: null,
  category_id: "category-1",
  subject: `Solicitud ${id}`,
  description: "Descripción del ticket.",
  priority,
  status,
  source: "MANUAL",
  assigned_advisor_id: assignedAdvisorId,
  created_at: "2026-10-07T12:00:00.000Z",
  updated_at: updatedAt,
  version: 1,
  assigned_at: null,
  resolved_at: null,
  closed_at: null,
  cancelled_at: null,
});

describe("staff operations model", () => {
  it("defines the available and assigned active states in the advisor Kanban", () => {
    expect(advisorKanbanColumns.map(({ status }) => status)).toEqual([
      "NUEVO",
      "ASIGNADO",
      "EN_PROCESO",
      "PENDIENTE_CLIENTE",
      "RESUELTO",
    ]);
    expect(advisorKanbanColumns.map(({ emptyMessage }) => emptyMessage)).toEqual([
      "No hay tickets nuevos sin responsable.",
      "No tienes tickets asignados pendientes de iniciar.",
      "No hay tickets en proceso.",
      "No hay solicitudes esperando información.",
      "No hay tickets resueltos pendientes de cierre.",
    ]);
  });

  it("offers take only for an unassigned new ticket and never opens another advisor's ticket", () => {
    expect(getAdvisorInboxAction(ticket("new", "NUEVO", "MEDIA", null), "advisor-1")).toBe("take");
    expect(getAdvisorInboxAction(ticket("mine", "EN_PROCESO"), "advisor-1")).toBe("open");
    expect(getAdvisorInboxAction(ticket("theirs", "ASIGNADO", "MEDIA", "advisor-2"), "advisor-1")).toBe("other");
    expect(getAdvisorInboxAction(ticket("unassigned-working", "EN_PROCESO", "MEDIA", null), "advisor-1")).toBe("none");
  });

  it("orders SLA risk before priority and stale updates", () => {
    const values = [
      ticket("stale", "ASIGNADO", "BAJA", "advisor-1", "2026-10-01T12:00:00.000Z"),
      ticket("high", "ASIGNADO", "ALTA"),
      ticket("urgent", "ASIGNADO", "URGENTE"),
      ticket("soon", "ASIGNADO", "BAJA"),
      ticket("overdue", "ASIGNADO", "BAJA"),
    ];
    expect(
      sortKanbanTickets(values, {
        overdue: new Set(["overdue"]),
        soon: new Set(["soon"]),
      }).map(({ id }) => id),
    ).toEqual(["overdue", "soon", "urgent", "high", "stale"]);
  });

  it("uses the requested human status and history labels", () => {
    expect(getTicketStatusLabel("NUEVO")).toBe("Disponible");
    expect(getTicketStatusLabel("ASIGNADO")).toBe("Por atender");
    expect(getTicketStatusLabel("EN_PROCESO")).toBe("En atención");
    expect(getTicketStatusLabel("PENDIENTE_CLIENTE")).toBe("Esperando al cliente");
    expect(getTicketStatusLabel("RESUELTO")).toBe("Resuelto por cerrar");
    expect(getHistoryActionLabel("TAKEN")).toBe("Ticket tomado por el asesor");
    expect(getHistoryActionLabel("SLA_BREACHED")).toBe("Plazo de atención vencido");
    expect(getHistoryActionLabel("SLA_FIRST_RESPONSE_BREACHED")).toBe("Plazo de primera respuesta vencido");
    expect(getHistoryActionLabel("FIRST_RESPONSE_SENT")).toBe("Primera respuesta enviada");
    expect(getHistoryValueLabel("NUEVO")).toBe("Disponible");
    expect(getHistoryActionLabel("UNKNOWN_ACTION")).toBe("Actualización operativa");
  });

  it("formats participant names and roles without falling back to identifiers", () => {
    expect(getParticipantLabel("CLIENTE", " María Paredes ")).toBe("Cliente · María Paredes");
    expect(getParticipantLabel("ASESOR", null)).toBe("Asesor");
    expect(getParticipantLabel(null, "Luis Rivas")).toBe("Participante · Luis Rivas");
    expect(getParticipantInitials("CLIENTE", null)).toBe("CL");
    expect(getParticipantInitials("SUPERVISOR", "Luis Rivas")).toBe("LR");
    expect(getParticipantRoleKey("ASESOR")).toBe("asesor");
    expect(getHistoryActorLabel("SUPERVISOR", " Luis Rivas ")).toBe("Supervisor · Luis Rivas");
    expect(getHistoryActorLabel("ASESOR", null)).toBeNull();
  });

  it("recognizes terminal tickets so actions can be hidden", () => {
    expect(isTerminalTicket(ticket("closed", "CERRADO"))).toBe(true);
    expect(isTerminalTicket(ticket("cancelled", "CANCELADO"))).toBe(true);
    expect(isTerminalTicket(ticket("resolved", "RESUELTO"))).toBe(false);
    expect(allowedTicketTransitions.CERRADO).toEqual([]);
    expect(allowedTicketTransitions.CANCELADO).toEqual([]);
    expect(allowedTicketTransitions.ASIGNADO).toEqual(["EN_PROCESO", "CANCELADO"]);
  });

  it("shows a real owner, a neutral fallback, and the advisor's own-ticket label", () => {
    const advisors: PublicUser[] = [
      { id: "advisor-1", full_name: "María Solís", email: "maria@example.test", role: "ASESOR" },
    ];
    expect(getTicketResponsibleLabel(ticket("mine", "ASIGNADO"), "ASESOR", advisors, "advisor-1")).toBe("A tu cargo");
    expect(getTicketResponsibleLabel(ticket("known", "ASIGNADO"), "SUPERVISOR", advisors)).toBe("María Solís");
    expect(getTicketResponsibleLabel(ticket("missing", "ASIGNADO", "MEDIA", "unknown"), "SUPERVISOR", advisors)).toBe("Asesor asignado");
    expect(getTicketResponsibleLabel(ticket("free", "NUEVO", "MEDIA", null), "SUPERVISOR", advisors)).toBe("Sin asignar");
  });

  it("restricts moves to backend transitions and uses assignment or release actions where required", () => {
    expect(getKanbanMoveDecision(ticket("assigned", "ASIGNADO"), "EN_PROCESO", "ASESOR", "advisor-1")).toEqual({
      allowed: true,
      action: { kind: "status", targetStatus: "EN_PROCESO", requiresReason: false },
    });
    expect(getKanbanMoveDecision(ticket("assigned", "ASIGNADO"), "RESUELTO", "ASESOR", "advisor-1").allowed).toBe(false);
    expect(getKanbanMoveDecision(ticket("mine", "ASIGNADO", "MEDIA", "advisor-2"), "EN_PROCESO", "ASESOR", "advisor-1").allowed).toBe(false);
    expect(getKanbanMoveDecision(ticket("new", "NUEVO", "MEDIA", null), "ASIGNADO", "SUPERVISOR")).toEqual({
      allowed: true,
      action: { kind: "assign", targetStatus: "ASIGNADO" },
    });
    expect(getKanbanMoveDecision(ticket("new", "NUEVO", "MEDIA", null), "ASIGNADO", "ASESOR", "advisor-1")).toEqual({
      allowed: true,
      action: { kind: "take", targetStatus: "ASIGNADO" },
    });
    expect(getKanbanMoveDecision(ticket("new", "NUEVO", "MEDIA", null), "EN_PROCESO", "ASESOR", "advisor-1").allowed).toBe(false);
    expect(getKanbanMoveDecision(ticket("assigned", "ASIGNADO"), "NUEVO", "SUPERVISOR")).toEqual({
      allowed: true,
      action: { kind: "release", targetStatus: "NUEVO" },
    });
    expect(getKanbanMoveDecision(ticket("resolved", "RESUELTO"), "EN_PROCESO", "ASESOR", "advisor-1")).toEqual({
      allowed: true,
      action: { kind: "status", targetStatus: "EN_PROCESO", requiresReason: true },
    });
    expect(getKanbanMoveDecision(ticket("resolved", "RESUELTO"), "ASIGNADO", "SUPERVISOR")).toEqual({
      allowed: true,
      action: { kind: "assign", targetStatus: "RESUELTO" },
    });
    expect(getKanbanMoveDecision(ticket("assigned", "EN_PROCESO"), "EN_PROCESO", "SUPERVISOR")).toEqual({
      allowed: false,
      reason: "El ticket ya está en esa columna.",
    });
    expect(getKanbanMoveDecision(ticket("closed", "CERRADO"), "NUEVO", "SUPERVISOR").allowed).toBe(false);
    expect(getKanbanMoveOptions(ticket("resolved", "RESUELTO"), "ASESOR", "advisor-1").map(({ status }) => status)).toEqual(["NUEVO", "EN_PROCESO"]);
    expect(getKanbanMoveOptions(ticket("resolved", "RESUELTO"), "SUPERVISOR").map(({ status }) => status)).toEqual(["NUEVO", "ASIGNADO", "EN_PROCESO"]);
  });
});
