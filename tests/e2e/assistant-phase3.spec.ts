import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  BotMessageResponse,
  ChatMessage,
  ChatTicket,
  ChatbotTicketDraft,
  ChatMessageCreateInput,
  Conversation,
  TicketCreateInput,
} from "../../src/shared/api/endpoints";
import type { Category } from "../../src/shared/types/domain";

const session = {
  token: "assistant-phase3-test-token",
  user: {
    id: "assistant-phase3-client",
    full_name: "Cliente de pruebas",
    email: "cliente.phase3@example.test",
    role: "CLIENTE",
  },
};

const conversationId = "assistant-phase3-conversation";
const category: Category = {
  id: "category-digital",
  name: "BANCA_DIGITAL",
  description: "Canales digitales",
  is_active: true,
};

function message(id: string, sender: "USER" | "BOT", content: string): ChatMessage {
  return {
    id,
    sender_type: sender,
    content,
    intent: null,
    confidence: null,
    faq_id: null,
    response_source: "DETERMINISTIC",
    created_at: "2026-10-10T12:00:00Z",
  };
}

function makeConversation(
  id = conversationId,
  overrides: Partial<Conversation> = {},
): Conversation {
  return {
    id,
    user_id: null,
    status: "ACTIVE",
    started_at: "2026-10-10T12:00:00Z",
    ended_at: null,
    turn_count: 0,
    messages: [],
    ...overrides,
  };
}

function makeDraft(
  status: ChatbotTicketDraft["status"],
  overrides: Partial<ChatbotTicketDraft> = {},
): ChatbotTicketDraft {
  return {
    status,
    fields: {},
    missing_fields: [],
    validation_errors: [],
    category_options: [],
    ...overrides,
  };
}

function makeReply(
  content: string,
  draft?: ChatbotTicketDraft,
  overrides: Partial<BotMessageResponse> = {},
): BotMessageResponse {
  return {
    user_message: message("mock-user", "USER", content),
    bot_message: message("mock-bot", "BOT", "Respuesta estructurada del asistente."),
    resolved: false,
    offers_ticket: false,
    confidence: 0.8,
    faq_id: null,
    source_category: null,
    requires_clarification: false,
    clarification_options: [],
    suggested_action: "NONE",
    ticket_draft: draft,
    conversation_status: "ACTIVE",
    response_source: "DETERMINISTIC",
    sources: [],
    ...overrides,
  };
}

function makeTicket(payload: TicketCreateInput): ChatTicket {
  return {
    id: "created-phase3-ticket",
    tracking_code: "TCK-2026-PHASE3",
    client_id: session.user.id,
    client_name: session.user.full_name,
    conversation_id: conversationId,
    category_id: payload.category_id,
    subject: payload.subject,
    description: payload.description,
    priority: payload.priority ?? "MEDIA",
    status: "NUEVO",
    source: "CHATBOT",
    assigned_advisor_id: null,
    assigned_advisor_name: null,
    created_at: "2026-10-10T12:05:00Z",
    updated_at: "2026-10-10T12:05:00Z",
    version: 1,
    assigned_at: null,
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
  };
}

function commitTicket(mock: MockState, payload: TicketCreateInput) {
  const ticket = makeTicket(payload);
  mock.conversation = {
    ...mock.conversation,
    status: "CONVERTED_TO_TICKET",
    converted_ticket: {
      id: ticket.id,
      tracking_code: ticket.tracking_code,
      subject: ticket.subject,
      status: ticket.status,
    },
  };
  return ticket;
}

async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

interface MockState {
  conversation: Conversation;
  readonly sentMessages: string[];
  readonly conversionPayloads: TicketCreateInput[];
  readonly unhandledMutations: string[];
  createdConversations: number;
  linkedConversations: number;
}

interface MockOptions {
  readonly authenticated?: boolean;
  readonly restore?: boolean;
  readonly onMessage?: (
    content: string,
    index: number,
    mock: MockState,
  ) => BotMessageResponse;
  readonly onConvert?: (
    route: Route,
    payload: TicketCreateInput,
    mock: MockState,
  ) => Promise<void>;
}

async function installMockApi(page: Page, options: MockOptions = {}) {
  const mock: MockState = {
    conversation: makeConversation(),
    sentMessages: [],
    conversionPayloads: [],
    unhandledMutations: [],
    createdConversations: 0,
    linkedConversations: 0,
  };
  if (options.authenticated) {
    await page.addInitScript(
      ({ authSession, activeId }) => {
        localStorage.setItem("gnb.session.v1", JSON.stringify(authSession));
        if (activeId) sessionStorage.setItem("gnb.chat.conversation.v1", activeId);
      },
      {
        authSession: session,
        activeId: options.restore ? conversationId : null,
      },
    );
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname;

    if (request.method() === "GET") {
      if (endpoint === "/api/v1/auth/me") {
        await fulfillJson(route, options.authenticated ? 200 : 401, session.user);
        return;
      }
      if (endpoint === "/api/v1/categories") {
        await fulfillJson(route, 200, [category]);
        return;
      }
      if (/^\/api\/v1\/chat\/conversations\/[^/]+$/.test(endpoint)) {
        await fulfillJson(route, 200, mock.conversation);
        return;
      }
      await fulfillJson(route, 200, []);
      return;
    }

    if (request.method() === "POST" && endpoint === "/api/v1/auth/login") {
      await fulfillJson(route, 200, {
        access_token: session.token,
        user: session.user,
      });
      return;
    }
    if (request.method() === "POST" && endpoint === "/api/v1/categories") {
      await fulfillJson(route, 200, category);
      return;
    }
    if (
      request.method() === "POST" &&
      endpoint === "/api/v1/chat/conversations"
    ) {
      mock.createdConversations += 1;
      const id =
        mock.createdConversations === 1
          ? conversationId
          : `${conversationId}-${mock.createdConversations}`;
      mock.conversation = makeConversation(id, {
        user_id: options.authenticated ? session.user.id : null,
      });
      await fulfillJson(route, 201, mock.conversation);
      return;
    }
    if (request.method() === "POST" && endpoint.endsWith("/link-user")) {
      mock.linkedConversations += 1;
      mock.conversation = {
        ...mock.conversation,
        user_id: session.user.id,
      };
      await fulfillJson(route, 200, {
        id: mock.conversation.id,
        user_id: session.user.id,
        status: mock.conversation.status,
      });
      return;
    }
    if (
      request.method() === "POST" &&
      /^\/api\/v1\/chat\/conversations\/[^/]+\/messages$/.test(endpoint)
    ) {
      const messageBody = request.postDataJSON() as ChatMessageCreateInput;
      const content = messageBody.content;
      const index = mock.sentMessages.length;
      mock.sentMessages.push(content);
      const response =
        options.onMessage?.(content, index, mock) ?? makeReply(content);
      mock.conversation = {
        ...mock.conversation,
        status: response.conversation_status ?? mock.conversation.status,
        ticket_draft: response.ticket_draft ?? mock.conversation.ticket_draft,
        messages: [
          ...(mock.conversation.messages ?? []),
          response.user_message,
          response.bot_message,
        ],
      };
      await fulfillJson(route, 200, response);
      return;
    }
    if (
      request.method() === "POST" &&
      endpoint.endsWith("/convert-to-ticket")
    ) {
      const payload = request.postDataJSON() as TicketCreateInput;
      mock.conversionPayloads.push(payload);
      if (options.onConvert) {
        await options.onConvert(route, payload, mock);
        return;
      }
      const ticket = commitTicket(mock, payload);
      await fulfillJson(route, 201, ticket);
      return;
    }

    mock.unhandledMutations.push(`${request.method()} ${endpoint}`);
    await fulfillJson(route, 501, {
      code: "E2E_UNMOCKED_MUTATION",
      message: "Esta prueba no interceptó la mutación.",
      request_id: "phase3-e2e",
    });
  });
  return mock;
}

async function openAssistant(page: Page, options: MockOptions = {}) {
  const mock = await installMockApi(page, options);
  await page.goto(options.authenticated === false ? "/" : "/app/asistente");
  if (options.authenticated === false) {
    await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();
  }
  return mock;
}

async function sendMessage(page: Page, text: string) {
  const composer = page.getByRole("textbox", { name: "Escribe tu consulta" });
  await composer.fill(text);
  await composer.press("Enter");
}

const ready = (overrides: Partial<ChatbotTicketDraft> = {}) =>
  makeDraft("READY_FOR_CONFIRMATION", {
    fields: {
      category_id: category.id,
      subject: "No puedo ingresar a la banca móvil",
      description: "La aplicación no acepta mis credenciales desde hoy.",
      priority: "ALTA",
    },
    ...overrides,
  });

test("recopila varios campos, permite corregir y solo crea tras confirmar", async ({
  page,
}) => {
  let conversionStarted = false;
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content, index) => {
      if (index === 0) {
        return makeReply(
          content,
          makeDraft("COLLECTING", {
            fields: {
              category_id: null,
              subject: "No puedo ingresar a la banca móvil",
              description: "La aplicación no acepta mis credenciales desde hoy.",
              priority: "ALTA",
            },
            missing_fields: ["CATEGORY_ID"],
            category_options: [{ id: category.id, name: category.name }],
          }),
          {
            bot_message: message("clarify-category", "BOT", "Elige la categoría adecuada."),
            requires_clarification: true,
            clarification_options: ["Banca digital"],
          },
        );
      }
      if (index === 1) {
        return makeReply(content, ready(), {
          bot_message: message("ready", "BOT", "Revisa el borrador."),
        });
      }
      return makeReply(
        content,
        ready({
          fields: {
            category_id: category.id,
            subject: "Acceso bloqueado a la banca móvil",
            description: "La aplicación no acepta mis credenciales desde esta mañana.",
            priority: "URGENTE",
          },
        }),
        { bot_message: message("corrected", "BOT", "Actualicé el borrador."), },
      );
    },
    onConvert: async (route, payload, state) => {
      conversionStarted = true;
      await new Promise((resolve) => setTimeout(resolve, 120));
      const ticket = commitTicket(state, payload);
      await fulfillJson(route, 201, ticket);
    },
  });

  await sendMessage(
    page,
    "No puedo ingresar a la banca móvil desde hoy; el asunto es acceso y me urge.",
  );
  const draft = page.locator(".assistant-ticket-draft");
  await expect(draft.getByText("No puedo ingresar a la banca móvil")).toBeVisible();
  await expect(draft.getByText("Descripción")).toBeVisible();
  await expect(draft.getByText("Falta completar:")).toBeVisible();
  await expect(draft.getByRole("button", { name: "Banca Digital" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar creación del ticket" }),
  ).toHaveCount(0);

  await draft.getByRole("button", { name: "Banca Digital" }).click();
  await expect(draft.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
  await expect(draft.getByText("Alta")).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(0);

  await draft.getByRole("button", { name: "Editar datos" }).click();
  const editor = draft.getByRole("form", { name: "Editar borrador del ticket" });
  await editor.getByLabel("Asunto").fill("Acceso bloqueado a la banca móvil");
  await editor
    .getByLabel("Descripción")
    .fill("La aplicación no acepta mis credenciales desde esta mañana.");
  await editor.getByLabel("Prioridad").selectOption("URGENTE");
  await editor.getByRole("button", { name: "Guardar correcciones" }).click();
  await expect(draft.getByText("Acceso bloqueado a la banca móvil")).toBeVisible();
  await expect(draft.getByText("Urgente")).toBeVisible();
  expect(mock.sentMessages).toHaveLength(3);
  expect(mock.sentMessages[2]).toContain("La aplicación no acepta mis credenciales desde esta mañana.");
  expect(mock.conversionPayloads).toHaveLength(0);

  const confirm = draft.getByRole("button", {
    name: "Confirmar creación del ticket",
  });
  await confirm.dblclick();
  await expect(draft.getByText("TCK-2026-PHASE3")).toBeVisible();
  await expect(draft.getByRole("link", { name: "Ver detalle de la solicitud" }))
    .toHaveAttribute("href", "/app/solicitudes/created-phase3-ticket");
  expect(conversionStarted).toBe(true);
  expect(mock.conversionPayloads).toHaveLength(1);
  expect(mock.conversionPayloads[0]).toEqual({
    category_id: category.id,
    subject: "Acceso bloqueado a la banca móvil",
    description: "La aplicación no acepta mis credenciales desde esta mañana.",
    priority: "URGENTE",
  });
  expect(mock.unhandledMutations).toEqual([]);

  await page.reload();
  await expect(
    page.locator(".assistant-ticket-draft--success").getByText("TCK-2026-PHASE3"),
  ).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(1);
});

test("retoma la conversación al autenticarse y no duplica mensajes ni convierte", async ({
  page,
}) => {
  const mock = await openAssistant(page, {
    authenticated: false,
    onMessage: (content) => makeReply(content, ready()),
  });
  await sendMessage(page, "Quiero reportar un problema con la aplicación.");
  const draft = page.locator(".assistant-ticket-draft");
  await expect(draft.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  await draft.getByRole("link", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/ingresar\?returnTo=%2Fapp%2Fasistente/);

  const storedValues = await page.evaluate(() =>
    Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index);
      return key ? sessionStorage.getItem(key) : null;
    }),
  );
  expect(storedValues).toEqual([conversationId]);

  await page.getByLabel("Correo electrónico").fill(session.user.email);
  await page.locator('input[name="password"]').fill("mock-password-not-a-real-account");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(
    page.locator(".assistant-ticket-draft").getByRole("button", {
      name: "Confirmar creación del ticket",
    }),
  ).toBeVisible();
  await expect(page.locator(".assistant-message--user")).toHaveCount(1);
  expect(mock.sentMessages).toHaveLength(1);
  expect(mock.linkedConversations).toBe(1);
  expect(mock.conversionPayloads).toHaveLength(0);
  expect(mock.unhandledMutations).toEqual([]);
});

test("restaura un borrador y reiniciar la conversación nunca lo convierte", async ({
  page,
}) => {
  const mock = await openAssistant(page, {
    authenticated: true,
    restore: true,
  });
  mock.conversation = makeConversation(conversationId, {
    user_id: session.user.id,
    ticket_draft: ready(),
    messages: [message("restored-user", "USER", "Necesito crear una solicitud.")],
  });

  await expect(
    page.locator(".assistant-ticket-draft").getByText("No puedo ingresar a la banca móvil"),
  ).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(0);
  await page.getByRole("button", { name: "Reiniciar conversación" }).click();
  await expect(page.getByRole("heading", { name: "¿Qué necesitas resolver hoy?" })).toBeVisible();
  expect(mock.createdConversations).toBe(1);
  expect(mock.conversionPayloads).toHaveLength(0);
  expect(mock.unhandledMutations).toEqual([]);
});

test("cancela el borrador conversacionalmente, lo restaura cancelado y no convierte", async ({
  page,
}) => {
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content, index) =>
      index === 0
        ? makeReply(content, makeDraft("COLLECTING", {
            fields: { subject: "Consulta de prueba" },
            missing_fields: ["CATEGORY_ID", "DESCRIPTION", "PRIORITY"],
          }))
        : makeReply(content, makeDraft("CANCELLED"), {
            bot_message: message("cancelled", "BOT", "Borrador cancelado."),
          }),
  });
  await sendMessage(page, "Quiero registrar una consulta.");
  await page
    .locator(".assistant-ticket-draft")
    .getByRole("button", { name: "Cancelar borrador" })
    .click();
  await expect(page.getByRole("heading", { name: "La creación del ticket se canceló" })).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "La creación del ticket se canceló" })).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(0);
  expect(mock.unhandledMutations).toEqual([]);
});

test("recupera con 200 un reintento idéntico tras perderse la respuesta", async ({
  page,
}) => {
  const payload = {
    category_id: category.id,
    subject: "No puedo ingresar a la banca móvil",
    description: "La aplicación no acepta mis credenciales desde hoy.",
    priority: "ALTA",
  } satisfies TicketCreateInput;
  let attempts = 0;
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content) => makeReply(content, ready()),
    onConvert: async (route, requestBody, state) => {
      attempts += 1;
      if (attempts === 1) {
        commitTicket(state, requestBody);
        await route.abort();
        return;
      }
      await fulfillJson(route, 200, makeTicket(requestBody));
    },
  });
  await sendMessage(page, "Necesito una solicitud por un problema de acceso.");
  const draft = page.locator(".assistant-ticket-draft");
  await draft.getByRole("button", { name: "Confirmar creación del ticket" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /conectar/i })).toBeVisible();
  await draft.getByRole("button", { name: "Reintentar confirmación" }).click();
  await expect(draft.getByText("TCK-2026-PHASE3")).toBeVisible();
  expect(attempts).toBe(2);
  expect(mock.conversionPayloads).toEqual([payload, payload]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("un 409 se presenta como conflicto y nunca como éxito", async ({ page }) => {
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content) => makeReply(content, ready()),
    onConvert: async (route, requestBody, state) => {
      commitTicket(state, {
        ...requestBody,
        subject: "Solicitud existente con otro asunto",
      });
      await fulfillJson(route, 409, {
        code: "CONVERSION_PAYLOAD_CONFLICT",
        message: "El payload difiere del ticket ya creado.",
        details: null,
        request_id: "phase3-conflict",
      });
    },
  });
  await sendMessage(page, "Necesito una solicitud.");
  const draft = page.locator(".assistant-ticket-draft");
  await draft.getByRole("button", { name: "Confirmar creación del ticket" }).click();
  await expect(draft.getByRole("heading", { name: "La conversación ya tiene otro ticket" })).toBeVisible();
  await expect(draft.getByText("TCK-2026-PHASE3")).toBeVisible();
  await expect(draft.getByText("Tu solicitud quedó registrada")).toHaveCount(0);
  await expect(draft.getByRole("link", { name: "Ver detalle de la solicitud" })).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(1);
  expect(mock.unhandledMutations).toEqual([]);
});

test("muestra errores 422 del servidor y conserva el borrador para corregirlo", async ({
  page,
}) => {
  const invalidDraft = ready({
    validation_errors: [
      { field: "DESCRIPTION", message: "Amplía la descripción." },
    ],
  });
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content) => makeReply(content, ready()),
    onConvert: async (route, _requestBody, state) => {
      state.conversation = {
        ...state.conversation,
        ticket_draft: invalidDraft,
      };
      await fulfillJson(route, 422, {
        code: "VALIDATION_ERROR",
        message: "La descripción necesita más información.",
        details: null,
        request_id: "phase3-validation",
      });
    },
  });
  await sendMessage(page, "Quiero crear un ticket.");
  await page
    .locator(".assistant-ticket-draft")
    .getByRole("button", { name: "Confirmar creación del ticket" })
    .click();
  await expect(page.getByRole("alert").filter({ hasText: "La descripción necesita más información." })).toBeVisible();
  await expect(page.locator(".assistant-ticket-draft").getByText("Amplía la descripción.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Corrige los datos del borrador" })).toBeVisible();
  await expect(page.getByText("Tu solicitud quedó registrada")).toHaveCount(0);
  expect(mock.conversionPayloads).toHaveLength(1);
});

for (const status of [429, 503]) {
  test(`permite reintentar con el mismo payload después de HTTP ${status}`, async ({
    page,
  }) => {
    let attempts = 0;
    const mock = await openAssistant(page, {
      authenticated: true,
      onMessage: (content) => makeReply(content, ready()),
      onConvert: async (route, payload, state) => {
        attempts += 1;
        if (attempts === 1) {
          await fulfillJson(route, status, {
            code: status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE",
            message: status === 429 ? "Espera un momento." : "Servicio temporalmente no disponible.",
            details: null,
            request_id: "phase3-retry",
          });
          return;
        }
        await fulfillJson(route, 201, commitTicket(state, payload));
      },
    });
    await sendMessage(page, "Quiero registrar una solicitud.");
    const draft = page.locator(".assistant-ticket-draft");
    await draft.getByRole("button", { name: "Confirmar creación del ticket" }).click();
    await expect(draft.getByRole("button", { name: "Reintentar confirmación" })).toBeVisible();
    await draft.getByRole("button", { name: "Reintentar confirmación" }).click();
    await expect(draft.getByText("TCK-2026-PHASE3")).toBeVisible();
    expect(attempts).toBe(2);
    expect(mock.conversionPayloads[1]).toEqual(mock.conversionPayloads[0]);
    expect(mock.unhandledMutations).toEqual([]);
  });
}

test("captura revisión responsive y permite completar acciones con teclado", async ({
  page,
}, testInfo) => {
  const mock = await openAssistant(page, {
    authenticated: true,
    onMessage: (content) => makeReply(content, ready()),
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await sendMessage(page, "Necesito reportar un inconveniente.");
  const draft = page.locator(".assistant-ticket-draft");
  await expect(draft.getByRole("heading", { name: "Revisa tu solicitud" })).toBeVisible();
  await mkdir(path.resolve("artifacts/screenshots/assistant-phase3"), {
    recursive: true,
  });
  await page.screenshot({
    path: path.resolve(
      "artifacts/screenshots/assistant-phase3",
      `${testInfo.project.name}.png`,
    ),
    animations: "disabled",
  });

  await draft.getByRole("button", { name: "Editar datos" }).focus();
  await page.keyboard.press("Enter");
  await expect(draft.getByRole("form", { name: "Editar borrador del ticket" })).toBeVisible();
  await draft.getByRole("button", { name: "Volver al resumen" }).focus();
  await page.keyboard.press("Enter");
  await expect(draft.getByRole("button", { name: "Confirmar creación del ticket" })).toBeVisible();
  expect(mock.conversionPayloads).toHaveLength(0);
  expect(mock.unhandledMutations).toEqual([]);
});
