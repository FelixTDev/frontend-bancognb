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
});
