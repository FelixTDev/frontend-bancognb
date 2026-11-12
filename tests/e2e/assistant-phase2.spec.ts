import { expect, test, type Page, type Route } from "@playwright/test";

const session = {
  token: "assistant-phase2-test-token",
  user: {
    id: "assistant-phase2-client",
    full_name: "Cliente de pruebas",
    email: "cliente@example.test",
    role: "CLIENTE",
  },
};

const conversationId = "assistant-phase2-conversation";

type Action =
  | "NONE"
  | "ASK_CLARIFICATION"
  | "CONVERT_TO_TICKET"
  | "CONTACT_ADVISOR"
  | "AUTHENTICATION_REQUIRED"
  | "LIST_MY_TICKETS"
  | "COUNT_MY_TICKETS"
  | "TICKET_STATUS"
  | "ADVISOR_RESPONSE_STATUS"
  | "LATEST_ADVISOR_RESPONSE"
  | "CLIENT_ACTION_REQUIRED"
  | "CLARIFY_TICKET_CODE";

type MockOutcome =
  | { readonly status: number; readonly payload: unknown }
  | { readonly networkError: true };
type MockResponder = (
  content: string,
  index: number,
) => MockOutcome | Record<string, unknown>;

function message(id: string, sender: "USER" | "BOT", content: string) {
  return {
    id,
    sender_type: sender,
    content,
    intent: null,
    confidence: null,
    created_at: "2026-10-10T12:00:00Z",
  };
}

function conversation(id: string, messages: readonly ReturnType<typeof message>[] = []) {
  return {
    id,
    user_id: null,
    status: "ACTIVE",
    started_at: "2026-10-10T12:00:00Z",
    ended_at: null,
    turn_count: messages.length,
    last_activity_at: "2026-10-10T12:00:00Z",
    messages,
  };
}

function reply(
  action: Action,
  query: Record<string, unknown> | null = null,
  botContent = "Respuesta estructurada del asistente.",
  id = "assistant-phase2-reply",
) {
  return {
    user_message: message(`${id}-user`, "USER", "Consulta de prueba"),
    bot_message: message(`${id}-bot`, "BOT", botContent),
    resolved: true,
    offers_ticket: false,
    confidence: 1,
    requires_clarification: false,
    clarification_options: [],
    suggested_action: action,
    fallback_reason: null,
    conversation_status: "ACTIVE",
    response_source: "DETERMINISTIC",
    sources: [],
    ticket_query: query,
  };
}

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    tracking_code: "TCK-20261010-AB12CD34EF",
    subject: "Consulta sobre mi solicitud",
    status: "EN_PROCESO",
    status_label: "En proceso",
    priority: "MEDIA",
    priority_label: "Media",
    updated_at: "2026-10-10T14:30:00Z",
    assigned_advisor_name: null,
    ...overrides,
  };
}

async function fulfillJson(route: Route, status: number, payload: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(payload),
  });
}

async function installMockApi(
  page: Page,
  options: {
    readonly authenticated?: boolean;
    readonly respond?: MockResponder;
  } = {},
) {
  const responseHandler = { current: options.respond };
  const messageBodies: string[] = [];
  const messagePaths: string[] = [];
  const unhandledMutations: string[] = [];
  const history: ReturnType<typeof message>[] = [];
  if (options.authenticated) {
    await page.addInitScript((value) => {
      localStorage.setItem("gnb.session.v1", JSON.stringify(value));
    }, session);
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === "/api/v1/chat/conversations" && method === "POST") {
      await fulfillJson(route, 201, conversation(conversationId));
      return;
    }
    if (path.endsWith("/messages") && method === "POST") {
      const content = (request.postDataJSON() as { content: string }).content;
      const index = messageBodies.length;
      messageBodies.push(content);
      messagePaths.push(path);
      const outcome = responseHandler.current?.(content, index) ?? reply("NONE");
      if (
        typeof outcome === "object" &&
        outcome !== null &&
        "networkError" in outcome
      ) {
        await route.abort("failed");
        return;
      }
      const hasHttpStatus =
        "status" in outcome &&
        typeof outcome.status === "number" &&
        "payload" in outcome;
      const status = hasHttpStatus ? outcome.status : 200;
      const payload = hasHttpStatus ? outcome.payload : outcome;
      if (status < 400) {
        const data = payload as {
          user_message?: ReturnType<typeof message>;
          bot_message?: ReturnType<typeof message>;
        };
        history.push(
          data.user_message
            ? { ...data.user_message, content }
            : message(`mock-user-${index}`, "USER", content),
          data.bot_message ?? message(`mock-bot-${index}`, "BOT", "Respuesta."),
        );
      }
      await fulfillJson(route, status, payload);
      return;
    }
    if (path.endsWith("/link-user") && method === "POST") {
      await fulfillJson(route, 200, {
        id: conversationId,
        user_id: session.user.id,
        status: "ACTIVE",
      });
      return;
    }
    if (path === "/api/v1/auth/login" && method === "POST") {
      await fulfillJson(route, 200, {
        access_token: session.token,
        user: session.user,
      });
      return;
    }
    if (method === "GET") {
      if (path === "/api/v1/auth/me") {
        await fulfillJson(route, 200, session.user);
        return;
      }
      const conversationMatch = path.match(
        /^\/api\/v1\/chat\/conversations\/([^/]+)$/,
      );
      if (conversationMatch?.[1]) {
        await fulfillJson(route, 200, conversation(conversationMatch[1], history));
        return;
      }
      await fulfillJson(route, 200, []);
      return;
    }

    unhandledMutations.push(`${method} ${path}`);
    await fulfillJson(route, 501, {
      code: "E2E_UNMOCKED_MUTATION",
      message: "The E2E test did not mock this mutation.",
    });
  });

  return {
    messageBodies,
    messagePaths,
    unhandledMutations,
    setResponder: (respond: MockResponder) => {
      responseHandler.current = respond;
    },
  };
}

async function openAssistant(page: Page, authenticated = true) {
  const mock = await installMockApi(page, { authenticated });
  await page.goto(authenticated ? "/app/asistente" : "/");
  if (!authenticated) {
    await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();
  }
  return mock;
}

async function sendMessage(page: Page, content: string) {
  const composer = page.getByRole("textbox", { name: "Escribe tu consulta" });
  await composer.fill(content);
  await composer.press("Enter");
}

test("pide autenticación solo con las acciones permitidas y retoma la conversación al iniciar sesión", async ({
  page,
}) => {
  const mock = await openAssistant(page, false);
  mock.setResponder(() =>
    reply(
        "AUTHENTICATION_REQUIRED",
        {
          query_type: "AUTHENTICATION_REQUIRED",
          authentication_required: true,
          authentication_actions: ["LOGIN"],
          tickets: [],
        },
        "Inicia sesión para consultar tus tickets.",
      ),
  );

  await sendMessage(page, "¿Cuántos tickets tengo?");
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Registrarme" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
    "href",
    "/ingresar?returnTo=%2Fapp%2Fasistente",
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("gnb.chat.conversation.v1"),
    ),
  ).toBe(conversationId);

  let links = 0;
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}/link-user`,
    async (route) => {
      links += 1;
      await fulfillJson(route, 200, {
        id: conversationId,
        user_id: session.user.id,
        status: "ACTIVE",
      });
    },
  );
  await page.getByRole("link", { name: "Iniciar sesión" }).click();
  await page.getByLabel("Correo electrónico").fill(session.user.email);
  await page.locator('input[name="password"]').fill("Demo-password-2026");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app\/asistente$/);
  await expect.poll(() => links).toBe(1);
  await expect(
    page.getByText("¿Cuántos tickets tengo?", { exact: true }),
  ).toBeVisible();

  mock.setResponder(() =>
    reply("COUNT_MY_TICKETS", {
        query_type: "TICKET_COUNT",
        authentication_required: false,
        total: 2,
        tickets: [],
      }),
  );
  await sendMessage(page, "¿Cuántos tickets tengo?");
  await expect(page.getByText("Total encontrado: 2 tickets")).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("presenta una lista vacía según el resultado estructurado del backend", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder(() =>
    reply("LIST_MY_TICKETS", {
      query_type: "TICKET_LIST",
      authentication_required: false,
      found: false,
      tickets: [],
      total: 0,
      pagination: { page: 1, page_size: 5, total_pages: 0 },
    }),
  );
  await sendMessage(page, "Muéstrame mis tickets");
  await expect(page.getByText("No se encontraron tickets.")).toBeVisible();
  await expect(page.getByText("Total encontrado: 0 tickets")).toBeVisible();
  expect(mock.messageBodies).toEqual(["Muéstrame mis tickets"]);
  expect(mock.messagePaths).toEqual([
    `/api/v1/chat/conversations/${conversationId}/messages`,
  ]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("lista los tickets devueltos y pagina con el mensaje que reconoce el backend", async ({
  page,
}) => {
  const pageOne = Array.from({ length: 5 }, (_, index) =>
    ticket({
      tracking_code: `TCK-PAGE-1-${index + 1}`,
      subject: `Consulta ${index + 1}`,
    }),
  );
  const pageTwo = [ticket({ tracking_code: "TCK-PAGE-2-1", subject: "Consulta página 2" })];
  const mock = await openAssistant(page);
  mock.setResponder((content) => {
    const secondPage = content === "Muéstrame mis tickets recientes página 2";
    return reply("LIST_MY_TICKETS", {
        query_type: "TICKET_LIST",
        authentication_required: false,
        found: true,
        tickets: secondPage ? pageTwo : pageOne,
        total: 6,
        pagination: {
          page: secondPage ? 2 : 1,
          page_size: 5,
          total_pages: 2,
        },
      });
  });

  await sendMessage(page, "Muéstrame mis tickets recientes");
  await expect(page.getByRole("list", { name: "Tickets encontrados" })).toHaveCount(1);
  await expect(page.locator(".assistant-ticket-card")).toHaveCount(5);
  await expect(page.getByText("En proceso").first()).toBeVisible();
  await expect(page.getByText("Media").first()).toBeVisible();
  await expect(page.getByText("Página 1 de 2")).toBeVisible();
  await page.getByRole("button", { name: "Ver página siguiente" }).click();
  await expect(page.getByText("TCK-PAGE-2-1")).toBeVisible();
  await expect(page.locator(".assistant-ticket-card")).toHaveCount(1);
  expect(mock.messageBodies).toEqual([
    "Muéstrame mis tickets recientes",
    "Muéstrame mis tickets recientes página 2",
  ]);
  expect(mock.messagePaths).toEqual([
    `/api/v1/chat/conversations/${conversationId}/messages`,
    `/api/v1/chat/conversations/${conversationId}/messages`,
  ]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("muestra conteo y último ticket con los datos tipados devueltos", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder((content) => {
    if (content.startsWith("¿Cuántos")) {
      return reply("COUNT_MY_TICKETS", {
        query_type: "TICKET_COUNT",
        authentication_required: false,
        total: 3,
        tickets: [],
      }, "Tienes 3 tickets abiertos.");
    }
    return reply("TICKET_STATUS", {
      query_type: "LATEST_TICKET",
      authentication_required: false,
      found: true,
      ticket: ticket(),
      tickets: [],
    });
  });

  await sendMessage(page, "¿Cuántos tickets tengo abiertos?");
  await expect(page.getByText("Total encontrado: 3 tickets")).toBeVisible();
  await sendMessage(page, "¿Cuál es mi último ticket?");
  await expect(page.getByText("TCK-20261010-AB12CD34EF")).toBeVisible();
  await expect(page.getByText("Consulta sobre mi solicitud")).toBeVisible();
  expect(mock.messageBodies).toEqual([
    "¿Cuántos tickets tengo abiertos?",
    "¿Cuál es mi último ticket?",
  ]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("muestra estado válido y conserva el mensaje neutral para códigos sin resultado", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder((content) => {
    if (content.includes("TCK-VALIDO")) {
      return reply("TICKET_STATUS", {
        query_type: "TICKET_STATUS",
        authentication_required: false,
        found: true,
        ticket: ticket({ tracking_code: "TCK-VALIDO" }),
        tickets: [],
      });
    }
    return reply(
      "TICKET_STATUS",
      {
        query_type: "TICKET_STATUS",
        authentication_required: false,
        found: false,
        tickets: [],
      },
      "No encontramos un ticket con ese código.",
    );
  });

  await sendMessage(page, "Estado del ticket TCK-VALIDO");
  await expect(page.locator(".assistant-ticket-card__identity code")).toHaveText(
    "TCK-VALIDO",
  );
  await expect(page.getByText("En proceso").last()).toBeVisible();
  await expect(page.locator(".assistant-ticket-card")).toHaveCount(1);
  await sendMessage(page, "Estado del ticket TCK-INEXISTENTE");
  await expect(page.getByText("No encontramos un ticket con ese código.")).toBeVisible();
  await expect(page.locator(".assistant-ticket-card")).toHaveCount(0);
  await sendMessage(page, "Estado del ticket TCK-AJENO");
  await expect(page.getByText("No encontramos un ticket con ese código.")).toHaveCount(2);
  await expect(page.locator(".assistant-ticket-card")).toHaveCount(0);
  expect(mock.messageBodies).toEqual([
    "Estado del ticket TCK-VALIDO",
    "Estado del ticket TCK-INEXISTENTE",
    "Estado del ticket TCK-AJENO",
  ]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("solicita un código faltante y envía el código al flujo normal del chat", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder((content) => {
    if (content === "TCK-UNICO-123") {
      return reply("TICKET_STATUS", {
        query_type: "TICKET_STATUS",
        authentication_required: false,
        found: true,
        ticket: ticket({ tracking_code: content }),
        tickets: [],
      });
    }
    return reply("CLARIFY_TICKET_CODE", {
      query_type: "CLARIFY_TICKET_CODE",
      authentication_required: false,
      tickets: [],
    });
  });

  await sendMessage(page, "¿En qué estado está mi ticket?");
  await expect(page.getByRole("textbox", { name: "Ingresa un código de seguimiento" })).toBeVisible();
  await page.getByRole("textbox", { name: "Ingresa un código de seguimiento" }).fill("TCK-UNICO-123");
  await page.getByRole("button", { name: "Consultar código" }).click();
  await expect(page.locator(".assistant-ticket-card__identity code")).toHaveText(
    "TCK-UNICO-123",
  );
  expect(mock.messageBodies).toEqual([
    "¿En qué estado está mi ticket?",
    "TCK-UNICO-123",
  ]);
  expect(mock.messagePaths).toEqual([
    `/api/v1/chat/conversations/${conversationId}/messages`,
    `/api/v1/chat/conversations/${conversationId}/messages`,
  ]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("muestra respuesta del asesor y tickets que esperan una acción del cliente", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder((content) => {
    if (content.includes("ya respondió")) {
      return reply("ADVISOR_RESPONSE_STATUS", {
        query_type: "ADVISOR_RESPONSE_STATUS",
        authentication_required: false,
        found: true,
        advisor_responded: false,
        tickets: [],
      });
    }
    if (content.includes("última respuesta")) {
      return reply("LATEST_ADVISOR_RESPONSE", {
        query_type: "ADVISOR_REPLY",
        authentication_required: false,
        found: true,
        advisor_responded: true,
        latest_advisor_response: {
          author_name: "Asesor Demo",
          created_at: "2026-10-10T14:30:00Z",
          content: "Revisaremos tu solicitud y te informaremos el resultado.",
        },
        tickets: [],
      });
    }
    return reply("CLIENT_ACTION_REQUIRED", {
      query_type: "CLIENT_ACTION_REQUIRED",
      authentication_required: false,
      found: true,
      tickets: [ticket({ status: "ESPERANDO_CLIENTE", status_label: "Esperando al cliente" })],
      total: 1,
      pagination: { page: 1, page_size: 5, total_pages: 1 },
    });
  });

  await sendMessage(page, "¿El asesor ya respondió?");
  await expect(
    page.getByText("Aún no se registra una respuesta del asesor."),
  ).toBeVisible();
  await sendMessage(page, "¿Cuál fue la última respuesta del asesor?");
  await expect(
    page.getByText("Revisaremos tu solicitud y te informaremos el resultado."),
  ).toBeVisible();
  await expect(page.getByText("Asesor Demo")).toBeVisible();
  await sendMessage(page, "¿Qué tickets esperan una acción mía?");
  await expect(page.getByText("TCK-20261010-AB12CD34EF")).toBeVisible();
  await expect(page.getByText("Esperando al cliente")).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("distingue error de red y error HTTP, conserva reintento y no sale del endpoint de chat", async ({
  page,
}) => {
  const mock = await openAssistant(page);
  mock.setResponder((_content, index) => {
    if (index === 0) {
      return { networkError: true };
    }
    if (index === 1) {
      return {
        status: 429,
        payload: {
          code: "RATE_LIMITED",
          message: "Espera un momento.",
        },
      };
    }
    return reply("COUNT_MY_TICKETS", {
      query_type: "TICKET_COUNT",
      authentication_required: false,
      total: 1,
      tickets: [],
    });
  });

  await sendMessage(page, "¿Cuántos tickets tengo?");
  await expect(page.getByRole("alert")).toContainText("No pudimos conectar");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByRole("alert")).toContainText("límite de solicitudes");
  await page.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("Total encontrado: 1 ticket")).toBeVisible();
  expect(mock.messageBodies).toEqual([
    "¿Cuántos tickets tengo?",
    "¿Cuántos tickets tengo?",
    "¿Cuántos tickets tengo?",
  ]);
  expect(mock.messagePaths).toEqual(
    Array(3).fill(`/api/v1/chat/conversations/${conversationId}/messages`),
  );
  expect(mock.unhandledMutations).toEqual([]);
});

test("el widget no sugiere consultas de saldos ni movimientos", async ({ page }) => {
  await openAssistant(page, false);
  const panel = page.locator(".assistant-panel--widget");
  await expect(panel.getByText(/saldo|movimientos|OTP|operaciones bancarias/i)).toHaveCount(0);
});

test("presenta temas, FAQ e indicador de respuesta sin desbordar", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  const mock = await openAssistant(page, false);
  const panel = page.getByRole("dialog", { name: "Asistente GNB" });
  await expect(panel.getByRole("heading", { name: "¿Qué necesitas resolver hoy?" })).toBeVisible();
  await expect(panel.getByRole("group", { name: "Temas de atención" }).getByRole("button")).toHaveCount(4);

  const faq = panel.locator("details.assistant-faq-suggestions");
  await faq.locator("summary").click();
  await expect(faq.locator(".assistant-examples").getByRole("button")).toHaveCount(4);
  await faq.locator("summary").click();
  await expect(faq.locator(".assistant-examples")).toBeHidden();

  const welcomeDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(welcomeDimensions.content).toBeLessThanOrEqual(welcomeDimensions.viewport + 1);
  await page.screenshot({
    path: testInfo.outputPath(`assistant-welcome-${testInfo.project.name}.png`),
    animations: "disabled",
  });

  await page.route("**/api/v1/chat/conversations/*/messages", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await page.waitForTimeout(700);
    await route.fallback();
  });
  await panel.getByRole("button", { name: "Tarjetas" }).click();
  await expect(panel.getByText("Preparando una respuesta", { exact: true })).toBeVisible();
  await expect(panel.getByText("Respuesta estructurada del asistente.")).toBeVisible();
  expect(mock.messageBodies).toEqual(["Necesito ayuda con una tarjeta."]);
  expect(mock.unhandledMutations).toEqual([]);

  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(consoleErrors).toEqual([]);
});

test("un 401 en el chat público permite reintentar sin avisar que venció una sesión", async ({ page }) => {
  const mock = await openAssistant(page, false);
  mock.setResponder(() => ({
    status: 401,
    payload: { code: "UNAUTHORIZED", message: "No autorizado.", request_id: "public-401" },
  }));

  await sendMessage(page, "Necesito orientación.");
  await expect(page.getByRole("alert")).toContainText("El asistente no pudo atender esta consulta");
  await expect(page.getByRole("alert")).not.toContainText("Tu sesión venció");
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("un 401 en el chat autenticado informa que la sesión venció", async ({ page }) => {
  const mock = await openAssistant(page);
  mock.setResponder(() => ({
    status: 401,
    payload: { code: "UNAUTHORIZED", message: "No autorizado.", request_id: "authenticated-401" },
  }));

  await sendMessage(page, "Necesito orientación.");
  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText(/Tu sesión venció\. Inicia sesión para retomar esta conversación/)).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});
