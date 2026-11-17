import { describe, expect, it } from "vitest";
import type {
  ChatbotTicketDraft,
  TicketCreateInput,
} from "../../shared/api/endpoints";
import {
  getAssistantRequestErrorMessage,
  getTicketDraftFieldLabel,
  getTicketDraftPayload,
  ticketDraftCorrectionMessage,
  type ReadyTicketDraftPayload,
} from "./assistant-conversation.model";

const readyDraft: ChatbotTicketDraft = {
  status: "READY_FOR_CONFIRMATION",
  paused: false,
  fields: {
    category_id: "123e4567-e89b-42d3-a456-426614174000",
    subject: "No puedo ingresar a la banca móvil",
    description: "La aplicación no acepta mis credenciales desde hoy.",
    priority: "ALTA",
  },
  missing_fields: [],
  validation_errors: [],
  category_options: [],
};

describe("ticket draft model", () => {
  it("creates the conversion payload only from a complete ready draft", () => {
    expect(getTicketDraftPayload(readyDraft)).toEqual({
      category_id: "123e4567-e89b-42d3-a456-426614174000",
      subject: "No puedo ingresar a la banca móvil",
      description: "La aplicación no acepta mis credenciales desde hoy.",
      priority: "ALTA",
    } satisfies TicketCreateInput);
  });

  it("retains the complete payload after the backend records explicit confirmation", () => {
    expect(
      getTicketDraftPayload({ ...readyDraft, status: "CONFIRMED" }),
    ).toEqual({
      category_id: readyDraft.fields?.category_id,
      subject: readyDraft.fields?.subject,
      description: readyDraft.fields?.description,
      priority: readyDraft.fields?.priority,
    });
  });

  it.each([
    { ...readyDraft, status: "COLLECTING" as const },
    { ...readyDraft, status: "CANCELLED" as const },
    { ...readyDraft, fields: { ...readyDraft.fields, description: null } },
    { ...readyDraft, missing_fields: ["DESCRIPTION" as const] },
    {
      ...readyDraft,
      validation_errors: [
        { field: "SUBJECT" as const, message: "Revisa el asunto." },
      ],
    },
  ])("no permite confirmar borradores incompletos o no listos", (draft) => {
    expect(getTicketDraftPayload(draft)).toBeNull();
  });

  it("maps only the draft fields defined by OpenAPI to human labels", () => {
    expect(getTicketDraftFieldLabel("CATEGORY_ID")).toBe("Categoría");
    expect(getTicketDraftFieldLabel("SUBJECT")).toBe("Asunto");
    expect(getTicketDraftFieldLabel("DESCRIPTION")).toBe("Descripción");
    expect(getTicketDraftFieldLabel("PRIORITY")).toBe("Prioridad");
  });

  it("builds a conversational correction from the reviewed ticket fields", () => {
    const payload = getTicketDraftPayload(readyDraft) as ReadyTicketDraftPayload;

    expect(ticketDraftCorrectionMessage(payload, "Banca digital")).toBe(
      [
        "Quiero corregir los datos del borrador de ticket:",
        "Categoría: Banca digital",
        "Asunto: No puedo ingresar a la banca móvil",
        "Descripción: La aplicación no acepta mis credenciales desde hoy.",
        "Prioridad: Alta",
      ].join("\n"),
    );
    expect(ticketDraftCorrectionMessage(payload, "Banca digital")).not.toContain(
      payload.category_id,
    );
  });
});

describe("assistant ticket errors", () => {
  it("explains validation, conflict, network and server errors without success wording", () => {
    expect(getAssistantRequestErrorMessage(422, "ticket")).toMatch(/correcci[oó]n/i);
    expect(getAssistantRequestErrorMessage(409, "ticket")).toMatch(/ya está registrada/i);
    expect(getAssistantRequestErrorMessage(0, "ticket")).toMatch(/conectar/i);
    expect(getAssistantRequestErrorMessage(503, "ticket")).toMatch(/borrador sigue disponible/i);
  });
});
