import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  api,
  type BotMessageResponse,
  type ChatMessage,
  type Conversation,
} from "../../shared/api/endpoints";
import { AssistantConversation } from "./assistant-conversation";

const now = "2026-11-16T12:00:00Z";

function chatMessage(
  id: string,
  sender: "USER" | "BOT",
  content: string,
): ChatMessage {
  return {
    id,
    sender_type: sender,
    content,
    intent: null,
    confidence: null,
    created_at: now,
  };
}

function conversation(id = "conversation-test"): Conversation {
  return {
    id,
    user_id: null,
    status: "ACTIVE",
    started_at: now,
    ended_at: null,
    turn_count: 0,
    menu_open: false,
    messages: [],
  };
}

function reply(
  botContent: string,
  overrides: Partial<BotMessageResponse> = {},
): BotMessageResponse {
  return {
    user_message: chatMessage("user-message", "USER", "hola"),
    bot_message: chatMessage("bot-message", "BOT", botContent),
    resolved: true,
    offers_ticket: false,
    confidence: 1,
    requires_clarification: false,
    clarification_options: [],
    suggested_action: "NONE",
    menu_open: false,
    conversation_status: "ACTIVE",
    response_source: "DETERMINISTIC",
    sources: [],
    ...overrides,
  };
}

function renderAssistant() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AssistantConversation authenticated={false} variant="widget" />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("AssistantConversation", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("starts with the welcome menu while there is no server conversation", () => {
    renderAssistant();

    expect(
      screen.getByRole("heading", { name: "¿Qué necesitas resolver hoy?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Temas de atención" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tarjetas" })).toBeInTheDocument();
  });

  it("renders backend menu options and submits their structured option_id", async () => {
    const user = userEvent.setup();
    const conversationId = "conversation-menu-test";
    const createConversation = vi
      .spyOn(api.chat, "create")
      .mockResolvedValue(conversation(conversationId));
    const sendMessage = vi
      .spyOn(api.chat, "message")
      .mockResolvedValueOnce(
        reply("¡Hola! Puedo ayudarte con estas opciones.", {
          suggested_action: "SHOW_MENU",
          menu_open: true,
          ui: {
            type: "MAIN_MENU",
            menu_id: "main",
            options: [
              {
                id: "menu:faq",
                label: "Preguntas frecuentes",
                action: "SHOW_FAQ_DISCOVERY",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(reply("Te mostraré las preguntas frecuentes."));

    renderAssistant();
    const composer = screen.getByRole("textbox", {
      name: "Escribe tu consulta",
    });
    await user.type(composer, "hola{Enter}");

    expect(
      await screen.findByText("¡Hola! Puedo ayudarte con estas opciones."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preguntas frecuentes" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Temas de atención" })).toBeNull();

    await user.click(
      screen.getByRole("button", { name: "Preguntas frecuentes" }),
    );

    await waitFor(() => {
      expect(sendMessage).toHaveBeenNthCalledWith(1, conversationId, {
        content: "hola",
      });
      expect(sendMessage).toHaveBeenNthCalledWith(2, conversationId, {
        option_id: "menu:faq",
      });
    });
    expect(createConversation).toHaveBeenCalledOnce();
  });

  it("renders FAQ category choices with readable labels and submits their IDs", async () => {
    const user = userEvent.setup();
    const conversationId = "conversation-category-test";
    const sendMessage = vi
      .spyOn(api.chat, "message")
      .mockResolvedValueOnce(
        reply("Claro, elige una categoría.", {
          resolved: false,
          requires_clarification: true,
          suggested_action: "ASK_CLARIFICATION",
          ui: {
            type: "FAQ_CATEGORY_CHOICES",
            menu_id: "faq_categories",
            options: [
              {
                id: "category:banking",
                label: "BANCA_DIGITAL",
                action: "SHOW_FAQ_CATEGORY",
              },
              {
                id: "category:credit",
                label: "CREDITOS",
                action: "SHOW_FAQ_CATEGORY",
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(reply("Elige una pregunta frecuente."));

    vi.spyOn(api.chat, "create").mockResolvedValue(
      conversation(conversationId),
    );
    renderAssistant();

    await user.type(
      screen.getByRole("textbox", { name: "Escribe tu consulta" }),
      "que opciones hay{Enter}",
    );

    const categoryButton = await screen.findByRole("button", {
      name: "Banca Digital",
    });
    expect(
      screen.getByRole("button", { name: "Créditos" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "BANCA_DIGITAL" }),
    ).toBeNull();

    await user.click(categoryButton);

    await waitFor(() => {
      expect(sendMessage).toHaveBeenNthCalledWith(1, conversationId, {
        content: "que opciones hay",
      });
      expect(sendMessage).toHaveBeenNthCalledWith(2, conversationId, {
        option_id: "category:banking",
      });
    });
  });

  it("renders the backend priority quick replies and submits their content unchanged", async () => {
    const user = userEvent.setup();
    const conversationId = "conversation-priority-test";
    const draft: NonNullable<BotMessageResponse["ticket_draft"]> = {
      status: "COLLECTING",
      paused: false,
      fields: { subject: "Acceso a banca móvil" },
      missing_fields: ["PRIORITY"],
      validation_errors: [],
      category_options: [],
    };
    const sendMessage = vi
      .spyOn(api.chat, "message")
      .mockResolvedValueOnce(
        reply("Elige una prioridad.", {
          requires_clarification: true,
          suggested_action: "ASK_CLARIFICATION",
          ticket_draft: draft,
          quick_replies: [
            {
              id: "draft-priority-urgent",
              label: "Urgente",
              content: "Prioridad: URGENTE",
            },
            {
              id: "draft-cancel",
              label: "Cancelar borrador",
              content: "Cancelo el borrador",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(reply("Prioridad guardada.", { ticket_draft: draft }));

    vi.spyOn(api.chat, "create").mockResolvedValue(
      conversation(conversationId),
    );
    renderAssistant();

    await user.type(
      screen.getByRole("textbox", { name: "Escribe tu consulta" }),
      "Quiero crear una solicitud{Enter}",
    );

    expect(await screen.findByRole("button", { name: "Urgente" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar borrador" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Urgente" })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Urgente" }));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenNthCalledWith(2, conversationId, {
        content: "Prioridad: URGENTE",
      });
    });
  });

  it("hides UUID-shaped internal identifiers from visible chat messages", async () => {
    const user = userEvent.setup();
    const internalId = "123e4567-e89b-42d3-a456-426614174000";
    vi.spyOn(api.chat, "create").mockResolvedValue(
      conversation("conversation-uuid-test"),
    );
    vi.spyOn(api.chat, "message").mockResolvedValue(
      reply("Encontré el ticket con referencia interna " + internalId),
    );

    renderAssistant();
    await user.type(
      screen.getByRole("textbox", { name: "Escribe tu consulta" }),
      "Consulta el estado{Enter}",
    );

    await screen.findByText(/Encontré el ticket con referencia interna/u);
    expect(document.body).not.toHaveTextContent(internalId);
    expect(document.body).toHaveTextContent("[identificador oculto]");
  });

  it("replaces stale institution-specific replies and hides their sources", async () => {
    const user = userEvent.setup();
    const oldAnswer = "Banco GNB publica condiciones específicas para sus cuentas.";
    const safeAnswer =
      "No tengo información verificada para responder esta consulta financiera. Puedo orientarte de forma general o ayudarte a registrar un ticket.";
    vi.spyOn(api.chat, "create").mockResolvedValue(
      conversation("conversation-stale-faq"),
    );
    vi.spyOn(api.chat, "message").mockResolvedValue(
      reply(oldAnswer, {
        response_source: "AI",
        sources: [
          {
            title: "Información de cuentas",
            category: "Cuentas",
            url: "https://www.bancognb.com.pe/cuentas",
            verified_at: "2026-11-01T00:00:00Z",
          },
        ],
      }),
    );

    renderAssistant();
    await user.type(
      screen.getByRole("textbox", { name: "Escribe tu consulta" }),
      "¿Qué condiciones tiene una cuenta?{Enter}",
    );

    expect(await screen.findByText(safeAnswer)).toBeVisible();
    expect(screen.queryByText(oldAnswer)).toBeNull();
    expect(screen.queryByText("Respuesta generada con IA.")).toBeNull();
    expect(screen.queryByText("Ver fuente")).toBeNull();
    expect(document.querySelectorAll('a[href*="bancognb.com.pe"]')).toHaveLength(0);
  });

  it("applies the same neutral fallback to restored history", async () => {
    const conversationId = "conversation-stale-history";
    const oldAnswer = "Banco GNB ofrece información de productos y tarifas.";
    const safeAnswer =
      "No tengo información verificada para responder esta consulta financiera. Puedo orientarte de forma general o ayudarte a registrar un ticket.";
    window.sessionStorage.setItem("gnb.chat.conversation.v1", conversationId);
    vi.spyOn(api.chat, "get").mockResolvedValue({
      ...conversation(conversationId),
      turn_count: 1,
      messages: [
        {
          ...chatMessage("old-bot-message", "BOT", oldAnswer),
          response_source: "AI",
        },
      ],
    });

    renderAssistant();

    expect(await screen.findByText(safeAnswer)).toBeVisible();
    expect(screen.queryByText(oldAnswer)).toBeNull();
    expect(screen.queryByText("Respuesta generada con IA.")).toBeNull();
  });
});
