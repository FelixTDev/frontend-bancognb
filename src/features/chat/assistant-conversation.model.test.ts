import { describe, expect, it } from "vitest";
import type { BotMessageResponse } from "../../shared/api/endpoints";
import {
  getAssistantTicketQueryPresentation,
  getAssistantReplyPresentation,
  getAssistantRequestErrorMessage,
} from "./assistant-conversation.model";

const makeReply = (
  overrides: Partial<BotMessageResponse> = {},
): BotMessageResponse => ({
  user_message: {
    id: "user",
    sender_type: "USER",
    content: "Consulta",
    intent: null,
    confidence: null,
    created_at: "2026-10-10T00:00:00Z",
  },
  bot_message: {
    id: "bot",
    sender_type: "BOT",
    content: "Respuesta",
    intent: null,
    confidence: 0.1,
    created_at: "2026-10-10T00:00:00Z",
  },
  resolved: false,
  offers_ticket: false,
  confidence: 0.1,
  suggested_action: "NONE",
  requires_clarification: false,
  clarification_options: [],
  menu_open: false,
  fallback_reason: "LOW_CONFIDENCE",
  conversation_status: "ACTIVE",
  response_source: "FALLBACK",
  sources: [],
  ...overrides,
});

describe("assistant reply presentation", () => {
  it("does not infer a warning or actions from confidence or fallback alone", () => {
    const presentation = getAssistantReplyPresentation(
      makeReply({ resolved: true, confidence: 0.1 }),
      "ACTIVE",
    );

    expect(presentation).toEqual({
      needsClarification: false,
      canRequestFollowup: false,
      showTicketOffer: false,
    });
  });

  it("requests clarification before showing ticket or escalation actions", () => {
    const presentation = getAssistantReplyPresentation(
      makeReply({
        suggested_action: "ASK_CLARIFICATION",
        requires_clarification: true,
        offers_ticket: true,
      }),
      "ACTIVE",
    );

    expect(presentation).toEqual({
      needsClarification: true,
      canRequestFollowup: false,
      showTicketOffer: false,
    });
  });

  it("offers backend-enabled actions after an active unresolved response", () => {
    const presentation = getAssistantReplyPresentation(
      makeReply({
        suggested_action: "CONVERT_TO_TICKET",
        resolved: false,
        offers_ticket: false,
        requires_clarification: false,
        fallback_reason: null,
        response_source: "DETERMINISTIC",
      }),
      "ACTIVE",
    );

    expect(presentation).toEqual({
      needsClarification: false,
      canRequestFollowup: false,
      showTicketOffer: true,
    });
  });

  it("shows advisor contact only when the structured action requests it", () => {
    const presentation = getAssistantReplyPresentation(
      makeReply({
        suggested_action: "CONTACT_ADVISOR",
        resolved: false,
        fallback_reason: null,
        response_source: "DETERMINISTIC",
      }),
      "ACTIVE",
    );

    expect(presentation.canRequestFollowup).toBe(true);
    expect(presentation.showTicketOffer).toBe(false);
  });

  it("does not show actions from legacy offer flags when the action is NONE", () => {
    const presentation = getAssistantReplyPresentation(
      makeReply({ suggested_action: "NONE", offers_ticket: true }),
      "ACTIVE",
    );

    expect(presentation.showTicketOffer).toBe(false);
    expect(presentation.canRequestFollowup).toBe(false);
  });

  it("does not offer escalation for a failed search or an already escalated conversation", () => {
    const failedSearch = getAssistantReplyPresentation(
      makeReply({ resolved: false, offers_ticket: false }),
      "ACTIVE",
    );
    const escalated = getAssistantReplyPresentation(
      makeReply({
        resolved: false,
        offers_ticket: true,
        fallback_reason: null,
        response_source: "DETERMINISTIC",
      }),
      "ESCALATED",
    );

    expect(failedSearch.canRequestFollowup).toBe(false);
    expect(escalated.canRequestFollowup).toBe(false);
  });
});

describe("assistant ticket query presentation", () => {
  it("shows only authentication actions authorized by the structured response", () => {
    const presentation = getAssistantTicketQueryPresentation(
      makeReply({
        suggested_action: "AUTHENTICATION_REQUIRED",
        ticket_query: {
          query_type: "AUTHENTICATION_REQUIRED",
          authentication_required: true,
          authentication_actions: ["REGISTER"],
        },
      }),
    );

    expect(presentation).toEqual({
      kind: "authentication",
      authenticationActions: ["REGISTER"],
    });
  });

  it("presents the returned ticket page and backend pagination metadata", () => {
    const ticket = {
      tracking_code: "TCK-20261010-AB12CD34EF",
      subject: "Consulta sobre mi solicitud",
      status: "EN_PROCESO" as const,
      status_label: "En proceso",
      priority: "MEDIA" as const,
      priority_label: "Media",
      updated_at: "2026-10-10T14:30:00Z",
      assigned_advisor_name: null,
      assignment_status: "ASSIGNED" as const,
    };
    const tickets = [ticket];
    const pagination = { page: 2, page_size: 5, total_pages: 3 };

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "LIST_MY_TICKETS",
          ticket_query: {
            query_type: "TICKET_LIST",
            authentication_required: false,
            found: true,
            tickets,
            total: 13,
            pagination,
          },
        }),
      ),
    ).toEqual({
      kind: "tickets",
      queryType: "TICKET_LIST",
      tickets,
      total: 13,
      pagination,
    });
  });

  it("presents an empty list without inventing ticket details", () => {
    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "LIST_MY_TICKETS",
          ticket_query: {
            query_type: "TICKET_LIST",
            authentication_required: false,
            found: false,
            tickets: [],
            total: 0,
            pagination: { page: 1, page_size: 5, total_pages: 0 },
          },
        }),
      ),
    ).toEqual({
      kind: "tickets",
      queryType: "TICKET_LIST",
      tickets: [],
      total: 0,
      pagination: { page: 1, page_size: 5, total_pages: 0 },
    });
  });

  it("presents counts and the latest ticket only from their typed query data", () => {
    const ticket = {
      tracking_code: "TCK-20261010-AB12CD34EF",
      subject: "Consulta sobre mi solicitud",
      status: "EN_PROCESO" as const,
      status_label: "En proceso",
      priority: "MEDIA" as const,
      priority_label: "Media",
      updated_at: "2026-10-10T14:30:00Z",
      assigned_advisor_name: null,
      assignment_status: "ASSIGNED" as const,
    };

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "COUNT_MY_TICKETS",
          ticket_query: {
            query_type: "TICKET_COUNT",
            authentication_required: false,
            total: 4,
            tickets: [],
          },
        }),
      ),
    ).toEqual({ kind: "count", total: 4 });

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "TICKET_STATUS",
          ticket_query: {
            query_type: "LATEST_TICKET",
            authentication_required: false,
            found: true,
            ticket,
            tickets: [],
          },
        }),
      ),
    ).toEqual({ kind: "ticket", queryType: "LATEST_TICKET", ticket });
  });

  it("preserves the backend's neutral not-found response without exposing a ticket", () => {
    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "TICKET_STATUS",
          ticket_query: {
            query_type: "TICKET_STATUS",
            authentication_required: false,
            found: false,
            tickets: [],
          },
        }),
      ),
    ).toBeNull();
  });

  it("presents advisor status and only returns advisor content when supplied", () => {
    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "ADVISOR_RESPONSE_STATUS",
          ticket_query: {
            query_type: "ADVISOR_RESPONSE_STATUS",
            authentication_required: false,
            found: true,
            advisor_responded: false,
            tickets: [],
          },
        }),
      ),
    ).toEqual({
      kind: "advisor-status",
      advisorResponded: false,
      ticket: null,
    });

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "LATEST_ADVISOR_RESPONSE",
          ticket_query: {
            query_type: "ADVISOR_REPLY",
            authentication_required: false,
            found: true,
            advisor_responded: true,
            latest_advisor_response: {
              author_name: "Asesor Demo",
              created_at: "2026-10-10T14:30:00Z",
              content: "Revisaremos tu solicitud.",
            },
            tickets: [],
          },
        }),
      ),
    ).toEqual({
      kind: "advisor-reply",
      advisorResponded: true,
      latestAdvisorResponse: {
        author_name: "Asesor Demo",
        created_at: "2026-10-10T14:30:00Z",
        content: "Revisaremos tu solicitud.",
      },
      ticket: null,
    });

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "LATEST_ADVISOR_RESPONSE",
          ticket_query: {
            query_type: "ADVISOR_REPLY",
            authentication_required: false,
            found: true,
            advisor_responded: true,
            latest_advisor_response: {
              author_name: "Asesor Demo",
              created_at: "2026-10-10T14:30:00Z",
            },
            tickets: [],
          },
        }),
      ),
    ).toEqual({
      kind: "advisor-reply",
      advisorResponded: true,
      latestAdvisorResponse: {
        author_name: "Asesor Demo",
        created_at: "2026-10-10T14:30:00Z",
      },
      ticket: null,
    });
  });

  it("supports client-action results and ticket-code clarification", () => {
    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "CLIENT_ACTION_REQUIRED",
          ticket_query: {
            query_type: "CLIENT_ACTION_REQUIRED",
            authentication_required: false,
            tickets: [],
            total: 0,
            pagination: { page: 1, page_size: 5, total_pages: 0 },
          },
        }),
      ),
    ).toEqual({
      kind: "tickets",
      queryType: "CLIENT_ACTION_REQUIRED",
      tickets: [],
      total: 0,
      pagination: { page: 1, page_size: 5, total_pages: 0 },
    });

    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "CLARIFY_TICKET_CODE",
          ticket_query: {
            query_type: "CLARIFY_TICKET_CODE",
            authentication_required: false,
            tickets: [],
          },
        }),
      ),
    ).toEqual({ kind: "clarify-ticket-code" });
  });

  it("ignores a ticket payload when the structured action and query type disagree", () => {
    expect(
      getAssistantTicketQueryPresentation(
        makeReply({
          suggested_action: "COUNT_MY_TICKETS",
          ticket_query: {
            query_type: "TICKET_LIST",
            authentication_required: false,
            tickets: [],
            total: 0,
          },
        }),
      ),
    ).toBeNull();
  });
});

describe("assistant request errors", () => {
  it.each([
    [0, "No pudimos conectar"],
    [401, "Tu sesión venció"],
    [403, "No tienes permisos"],
    [404, "No encontramos esta conversación"],
    [409, "La conversación ya cambió"],
    [429, "límite de solicitudes"],
  ])("explains conversation query HTTP %i", (status, expected) => {
    expect(
      getAssistantRequestErrorMessage(status, "conversation", "Mensaje API"),
    ).toContain(expected);
  });

  it.each([
    [401, "Tu sesión venció."],
    [403, "No tienes permisos"],
    [404, "No encontramos esta conversación"],
    [409, "La conversación ya cambió"],
    [429, "límite de solicitudes"],
    [0, "No pudimos conectar"],
  ])("explains ticket conversion HTTP %i", (status, expected) => {
    expect(
      getAssistantRequestErrorMessage(status, "ticket", "Mensaje del servidor"),
    ).toContain(expected);
  });

  it("uses the backend message for an otherwise unmapped status", () => {
    expect(
      getAssistantRequestErrorMessage(503, "ticket", "Servicio no disponible"),
    ).toBe("Servicio no disponible");
  });
});
