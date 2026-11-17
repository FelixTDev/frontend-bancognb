import { expect, test, type Page, type Route } from "./fixtures";

const conversationId = "assistant-conversational-backend";
const cardCategoryId = "11111111-1111-4111-8111-111111111111";
const cardFaqId = "22222222-2222-4222-8222-222222222222";
const cardInternetFaqId = "44444444-4444-4444-8444-444444444444";
const passwordFaqId = "33333333-3333-4333-8333-333333333333";
const recoveryGuideUrl =
  "https://www.bancognb.com.pe/main/download?file=peru%2Fbanca_personas%2Fguia-cambio-de-contrasenia.pdf";
const safeFaqFallback =
  "No tengo información verificada para responder esta consulta financiera. Puedo orientarte de forma general o ayudarte a registrar un ticket.";

function message(id: string, sender: "USER" | "BOT", content: string) {
  return {
    id,
    sender_type: sender,
    content,
    intent: null,
    confidence: null,
    created_at: "2026-11-16T12:00:00Z",
  };
}

function conversation() {
  return {
    id: conversationId,
    user_id: null,
    status: "ACTIVE",
    started_at: "2026-11-16T12:00:00Z",
    ended_at: null,
    turn_count: 0,
    menu_open: false,
    messages: [],
    ui: null,
  };
}

function reply(
  index: number,
  content: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    user_message: message(`user-${index}`, "USER", "Consulta de prueba"),
    bot_message: message(`bot-${index}`, "BOT", content),
    resolved: true,
    offers_ticket: false,
    confidence: 1,
    requires_clarification: false,
    clarification_options: [],
    suggested_action: "NONE",
    menu_open: false,
    fallback_reason: null,
    conversation_status: "ACTIVE",
    response_source: "DETERMINISTIC",
    sources: [],
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

async function openPublicAssistant(
  page: Page,
  respond: (
    body: Record<string, unknown>,
    index: number,
  ) => Record<string, unknown>,
) {
  const sentBodies: Record<string, unknown>[] = [];

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      request.method() === "POST" &&
      url.pathname === "/api/v1/chat/conversations"
    ) {
      await fulfillJson(route, 201, conversation());
      return;
    }
    if (
      request.method() === "POST" &&
      url.pathname === `/api/v1/chat/conversations/${conversationId}/messages`
    ) {
      const body = request.postDataJSON() as Record<string, unknown>;
      const index = sentBodies.length;
      sentBodies.push(body);
      await fulfillJson(route, 200, respond(body, index));
      return;
    }
    if (request.method() === "GET") {
      await fulfillJson(route, 200, []);
      return;
    }
    await fulfillJson(route, 200, {});
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Abrir asistente de atención" }).click();
  return sentBodies;
}

async function sendMessage(page: Page, text: string) {
  const composer = page.getByRole("textbox", { name: "Escribe tu consulta" });
  await composer.fill(text);
  await composer.press("Enter");
}

const mainMenu = {
  type: "MAIN_MENU",
  menu_id: "main",
  options: [
    {
      id: "menu:faq",
      label: "Preguntas frecuentes",
      action: "SHOW_FAQ_DISCOVERY",
    },
    {
      id: "menu:ticket_status",
      label: "Estado de mi caso",
      action: "CHECK_TICKET_STATUS",
    },
    {
      id: "menu:tickets",
      label: "Mis solicitudes",
      action: "LIST_MY_TICKETS",
    },
  ],
};

const cardFaqChoices = {
  type: "FAQ_CHOICES",
  menu_id: "faq_questions",
  options: [
    {
      id: `faq:${cardFaqId}`,
      label: "¿Qué hago si mi tarjeta está bloqueada?",
      action: "SELECT_FAQ",
    },
    {
      id: `faq:${cardInternetFaqId}`,
      label: "¿Puedo habilitar o deshabilitar compras por internet en mi tarjeta?",
      action: "SELECT_FAQ",
    },
    {
      id: "nav:back",
      label: "Volver a temas",
      action: "NAVIGATE_BACK",
    },
    {
      id: "nav:menu",
      label: "Volver al menú",
      action: "SHOW_MENU",
    },
  ],
};

test("recorre saludo, categorías, FAQ, aclaración y nueva consulta sin perder el hilo", async ({
  page,
}) => {
  const sentBodies = await openPublicAssistant(page, (body, index) => {
    if (body.content === "hola") {
      return reply(index, "¡Hola! Soy el asistente y puedo orientarte.", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "¡Hola! Soy el asistente y puedo orientarte.",
        ),
        suggested_action: "SHOW_MENU",
        menu_open: true,
        ui: mainMenu,
      });
    }
    if (body.content === "¿Qué opciones hay?") {
      return reply(index, "Estas son las categorías disponibles.", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "Estas son las categorías disponibles.",
        ),
        requires_clarification: true,
        suggested_action: "ASK_CLARIFICATION",
        ui: {
          type: "FAQ_CATEGORY_CHOICES",
          menu_id: "faq_categories",
          options: [
            {
              id: `category:${cardCategoryId}`,
              label: "Tarjetas",
              action: "SHOW_FAQ_CATEGORY",
            },
            {
              id: "nav:menu",
              label: "Volver al menú",
              action: "SHOW_MENU",
            },
          ],
        },
      });
    }
    if (body.option_id === `category:${cardCategoryId}`) {
      return reply(index, "Estas son las preguntas frecuentes de tarjetas.", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "Estas son las preguntas frecuentes de tarjetas.",
        ),
        requires_clarification: true,
        suggested_action: "ASK_CLARIFICATION",
        ui: cardFaqChoices,
      });
    }
    if (body.option_id === `faq:${cardFaqId}`) {
      return reply(index, "Si tu tarjeta está bloqueada, revisa los canales oficiales de atención.", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "Si tu tarjeta está bloqueada, revisa los canales oficiales de atención.",
        ),
        response_source: "AI",
        sources: [
          {
            title: "Consultas y bloqueos 24 horas",
            category: "TARJETAS",
            url: "https://example.test/help/tarjetas",
            verified_at: "2026-11-15T00:00:00Z",
          },
        ],
      });
    }
    if (body.content === "sigo confundido") {
      const clarificationOption = {
        id: `faq:${cardFaqId}`,
        label: "¿Qué hago si mi tarjeta está bloqueada?",
        action: "SELECT_FAQ",
      };
      return reply(index, "¿Qué parte de la orientación te genera duda?", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "¿Qué parte de la orientación te genera duda?",
        ),
        requires_clarification: true,
        suggested_action: "ASK_CLARIFICATION",
        clarification_options: ["¿QUÉ HAGO SI MI TARJETA ESTÁ BLOQUEADA?"],
        ui: {
          type: "FAQ_CHOICES",
          menu_id: "faq:contextual-clarification",
          options: [clarificationOption],
        },
      });
    }
    if (body.content === "quiero resolver otra consulta") {
      return reply(index, "Claro. ¿Sobre qué tema quieres consultar ahora?", {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          "Claro. ¿Sobre qué tema quieres consultar ahora?",
        ),
        suggested_action: "SHOW_MENU",
        menu_open: true,
        ui: mainMenu,
      });
    }
    return reply(index, "Puedo mostrarte estas categorías disponibles.", {
      bot_message: message(
        `bot-${index}`,
        "BOT",
        "Puedo mostrarte estas categorías disponibles.",
      ),
      requires_clarification: true,
      suggested_action: "ASK_CLARIFICATION",
      fallback_reason: "OUT_OF_SCOPE",
      ui: {
        type: "FAQ_CATEGORY_CHOICES",
        menu_id: "faq_categories",
        options: [
          {
            id: `category:${cardCategoryId}`,
            label: "Tarjetas",
            action: "SHOW_FAQ_CATEGORY",
          },
          {
            id: "nav:menu",
            label: "Volver al menú",
            action: "SHOW_MENU",
          },
        ],
      },
    });
  });
  const widget = page.getByRole("dialog", { name: "Asistente de atención" });

  await sendMessage(page, "hola");
  await expect(
    widget.getByText("¡Hola! Soy el asistente y puedo orientarte."),
  ).toBeVisible();
  await expect(widget.locator(".assistant-topic-grid")).toHaveCount(0);
  await expect(widget.locator(".assistant-interactive-options")).toHaveCount(1);
  await expect(
    widget.locator(".assistant-interactive-options button"),
  ).toHaveCount(3);

  await sendMessage(page, "¿Qué opciones hay?");
  await expect(widget.getByText("Estas son las categorías disponibles.")).toBeVisible();
  await expect(widget.getByRole("button", { name: "Tarjetas" })).toBeVisible();
  await widget.getByRole("button", { name: "Tarjetas" }).click();
  await expect(
    widget.getByText("Estas son las preguntas frecuentes de tarjetas."),
  ).toBeVisible();
  await expect(
    widget.getByRole("button", {
      name: "¿Qué hago si mi tarjeta está bloqueada?",
    }),
  ).toBeVisible();

  await widget
    .getByRole("button", { name: "¿Qué hago si mi tarjeta está bloqueada?" })
    .click();
  await expect(
    widget.getByText(
      "Si tu tarjeta está bloqueada, revisa los canales oficiales de atención.",
    ),
  ).toBeVisible();
  await expect(
    widget.locator(".assistant-response-status").filter({
      hasText: "Respuesta generada con IA.",
    }),
  ).toBeVisible();
  await expect(widget.locator(".assistant-sources")).toHaveCount(0);
  await expect(
    widget.getByRole("link", { name: "Consultas y bloqueos 24 horas" }),
  ).toHaveCount(0);

  await sendMessage(page, "sigo confundido");
  await expect(
    widget.getByText("¿Qué parte de la orientación te genera duda?", {
      exact: true,
    }),
  ).toBeVisible();
  const clarificationChoices = widget.locator(
    ".assistant-clarification__choices button",
  );
  await expect(clarificationChoices).toHaveCount(1);
  await expect(widget.locator(".assistant-interactive-options")).toHaveCount(0);
  await expect(widget.locator(".assistant-sources")).toHaveCount(0);
  await expect(
    widget.locator(".assistant-response-status").filter({
      hasText: "Respuesta generada con IA.",
    }),
  ).toBeVisible();

  await sendMessage(page, "quiero resolver otra consulta");
  await expect(
    widget.getByText("Claro. ¿Sobre qué tema quieres consultar ahora?"),
  ).toBeVisible();
  await expect(widget.getByText("hola", { exact: true })).toBeVisible();
  await expect(widget.locator(".assistant-sources")).toHaveCount(0);
  await expect(widget.locator(".assistant-interactive-options")).toHaveCount(1);

  await sendMessage(page, "2+2");
  await expect(
    widget.getByText("Puedo mostrarte estas categorías disponibles."),
  ).toBeVisible();
  await expect(widget.locator(".assistant-response-status").last()).toHaveText(
    "Respuesta de respaldo. No se pudo validar una respuesta de IA.",
  );
  await expect(widget.getByRole("button", { name: "Tarjetas" }).last()).toBeVisible();
  await expect(widget.getByText(/No pudimos conectar/)).toHaveCount(0);
  expect(sentBodies).toEqual([
    { content: "hola" },
    { content: "¿Qué opciones hay?" },
    { option_id: `category:${cardCategoryId}` },
    { option_id: `faq:${cardFaqId}` },
    { content: "sigo confundido" },
    { content: "quiero resolver otra consulta" },
    { content: "2+2" },
  ]);
});

test("ayuda con tarjetas muestra preguntas de esa categoría devueltas por el backend", async ({
  page,
}) => {
  await openPublicAssistant(page, (body, index) =>
    reply(index, "Estas preguntas frecuentes pueden ayudarte.", {
      bot_message: message(
        `bot-${index}`,
        "BOT",
        "Estas preguntas frecuentes pueden ayudarte.",
      ),
      requires_clarification: true,
      suggested_action: "ASK_CLARIFICATION",
      ui: cardFaqChoices,
    }),
  );
  const widget = page.getByRole("dialog", { name: "Asistente de atención" });

  await sendMessage(page, "Quiero ayuda con tarjetas");

  await expect(
    widget.getByText("Estas preguntas frecuentes pueden ayudarte."),
  ).toBeVisible();
  await expect(
    widget.getByRole("button", {
      name: "¿Qué hago si mi tarjeta está bloqueada?",
    }),
  ).toBeVisible();
  await expect(
    widget.getByRole("button", {
      name: "¿Puedo habilitar o deshabilitar compras por internet en mi tarjeta?",
    }),
  ).toBeVisible();
});

test("una consulta fuera de alcance muestra la respuesta y las categorías disponibles", async ({
  page,
}) => {
  await openPublicAssistant(page, (body, index) =>
    reply(index, "Entiendo tu pregunta. Puedo mostrarte las categorías disponibles.", {
      bot_message: message(
        `bot-${index}`,
        "BOT",
        "Entiendo tu pregunta. Puedo mostrarte las categorías disponibles.",
      ),
      requires_clarification: true,
      suggested_action: "ASK_CLARIFICATION",
      fallback_reason: "OUT_OF_SCOPE",
      ui: {
        type: "FAQ_CATEGORY_CHOICES",
        menu_id: "faq_categories",
        options: [
          {
            id: `category:${cardCategoryId}`,
            label: "Tarjetas",
            action: "SHOW_FAQ_CATEGORY",
          },
          {
            id: "nav:menu",
            label: "Volver al menú",
            action: "SHOW_MENU",
          },
        ],
      },
    }),
  );
  const widget = page.getByRole("dialog", { name: "Asistente de atención" });

  await sendMessage(page, "2+2");

  await expect(
    widget.getByText("Entiendo tu pregunta. Puedo mostrarte las categorías disponibles."),
  ).toBeVisible();
  await expect(widget.locator(".assistant-response-status")).toHaveText(
    "Respuesta de respaldo. No se pudo validar una respuesta de IA.",
  );
  await expect(widget.getByRole("button", { name: "Tarjetas" })).toBeVisible();
  await expect(widget.getByRole("alert")).toHaveCount(0);
});

test("sustituye contenido GNB heredado y no muestra sus fuentes", async ({
  page,
}) => {
  const sentBodies = await openPublicAssistant(page, (body, index) => {
    if (body.option_id === `faq:${passwordFaqId}`) {
      const oldAnswer =
        "Banco GNB permite recuperar la contraseña desde su banca móvil.";
      return reply(index, oldAnswer, {
        bot_message: message(
          `bot-${index}`,
          "BOT",
          oldAnswer,
        ),
        response_source: "AI",
        sources: [
          {
            title: "Información de acceso de Banco GNB",
            category: "BANCA_DIGITAL",
            url: recoveryGuideUrl,
            verified_at: "2026-11-15T00:00:00Z",
          },
        ],
      });
    }
    return reply(index, "Elige la pregunta sobre tu contraseña.", {
      bot_message: message(
        `bot-${index}`,
        "BOT",
        "Elige la pregunta sobre tu contraseña.",
      ),
      requires_clarification: true,
      suggested_action: "ASK_CLARIFICATION",
      ui: {
        type: "FAQ_CHOICES",
        menu_id: "faq:password",
        options: [
          {
            id: `faq:${passwordFaqId}`,
            label: "¿Qué hago si olvidé mi contraseña de Banca Móvil?",
            action: "SELECT_FAQ",
          },
        ],
      },
    });
  });
  const widget = page.getByRole("dialog", { name: "Asistente de atención" });

  await expect(widget.locator('input[type="password"]')).toHaveCount(0);

  await sendMessage(page, "Olvidé mi contraseña");
  await widget
    .getByRole("button", {
      name: "¿Qué hago si olvidé mi contraseña de Banca Móvil?",
    })
    .click();
  await expect(widget.getByText(safeFaqFallback, { exact: true })).toBeVisible();
  await expect(
    widget.getByText("Banco GNB permite recuperar la contraseña desde su banca móvil."),
  ).toHaveCount(0);
  await expect(widget.getByText("Respuesta generada con IA.")).toHaveCount(0);
  await expect(widget.locator(".assistant-sources")).toHaveCount(0);
  await expect(widget.locator('a[href*="bancognb.com.pe"]')).toHaveCount(0);
  expect(sentBodies).toEqual([
    { content: "Olvidé mi contraseña" },
    { option_id: `faq:${passwordFaqId}` },
  ]);
});
