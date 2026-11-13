import { expect, test, type Page, type Route } from "./fixtures";

const session = {
  token: "assistant-phase1-test-token",
  user: {
    id: "assistant-phase1-client",
    full_name: "Cliente de pruebas",
    email: "cliente@example.test",
    role: "CLIENTE",
  },
};

const category = {
  id: "category-digital",
  name: "Banca digital",
  description: "Canales digitales",
  is_active: true,
};

const conversationId = "assistant-phase1-conversation";

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

function conversation(
  id: string,
  messages: readonly ReturnType<typeof message>[] = [],
  ui?: unknown,
) {
  return {
    id,
    user_id: null,
    status: "ACTIVE",
    started_at: "2026-10-10T12:00:00Z",
    ended_at: null,
    turn_count: messages.length,
    last_activity_at: "2026-10-10T12:00:00Z",
    messages,
    ui,
  };
}

function reply(
  action: "NONE" | "ASK_CLARIFICATION" | "CONVERT_TO_TICKET" | "CONTACT_ADVISOR",
  overrides: Record<string, unknown> = {},
) {
  return {
    user_message: message("user-message", "USER", "Necesito orientación"),
    bot_message: message("bot-message", "BOT", "Respuesta del asistente"),
    resolved: false,
    offers_ticket: false,
    confidence: 0.8,
    faq_id: null,
    source_category: null,
    requires_clarification: false,
    clarification_options: [],
    suggested_action: action,
    fallback_reason: null,
    conversation_status: "ACTIVE",
    response_source: "DETERMINISTIC",
    sources: [],
    ...overrides,
  };
}

async function fulfillJson(route: Route, status: number, value: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });
}

async function installApiGuard(
  page: Page,
  options: { readonly authenticated?: boolean } = {},
) {
  const unhandledMutations: string[] = [];
  if (options.authenticated) {
    await page.addInitScript((value) => {
      localStorage.setItem("gnb.session.v1", JSON.stringify(value));
    }, session);
  }

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") {
      const linkMatch = url.pathname.match(
        /^\/api\/v1\/chat\/conversations\/([^/]+)\/link-user$/,
      );
      if (linkMatch?.[1]) {
        await fulfillJson(route, 200, {
          id: linkMatch[1],
          user_id: session.user.id,
          status: "ACTIVE",
        });
        return;
      }
      unhandledMutations.push(`${request.method()} ${url.pathname}`);
      await fulfillJson(route, 501, {
        code: "E2E_UNMOCKED_MUTATION",
        message: "The E2E test did not mock this mutation.",
      });
      return;
    }

    if (url.pathname === "/api/v1/auth/me") {
      await fulfillJson(route, 200, session.user);
      return;
    }
    if (url.pathname === "/api/v1/categories") {
      await fulfillJson(route, 200, [category]);
      return;
    }
    const conversationMatch = url.pathname.match(
      /^\/api\/v1\/chat\/conversations\/([^/]+)$/,
    );
    if (conversationMatch?.[1]) {
      await fulfillJson(route, 200, conversation(conversationMatch[1]));
      return;
    }
    await fulfillJson(route, 200, []);
  });
  return unhandledMutations;
}

async function openAssistant(page: Page, authenticated = true) {
  const unhandledMutations = await installApiGuard(page, { authenticated });
  await page.goto(authenticated ? "/app/asistente" : "/");
  if (!authenticated) {
    await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();
  }
  return unhandledMutations;
}

async function sendMessage(page: Page, text: string) {
  const composer = page.getByRole("textbox", { name: "Escribe tu consulta" });
  await composer.fill(text);
  await composer.press("Enter");
}

async function installCreateAndMessageRoutes(
  page: Page,
  getReply: (index: number) => unknown,
  id = conversationId,
) {
  let sent = 0;
  await page.route("**/api/v1/chat/conversations", (route) =>
    fulfillJson(route, 201, conversation(id)),
  );
  await page.route(
    "**/api/v1/chat/conversations/*/messages",
    async (route) => {
      const current = sent;
      sent += 1;
      await fulfillJson(route, 200, getReply(current));
    },
  );
  return () => sent;
}

test("muestra sugerencias, aclaraciones y fuentes desde campos estructurados", async ({
  page,
}) => {
  const unhandled = await openAssistant(page, false);
  const sent = await installCreateAndMessageRoutes(page, (index) => {
    if (index === 0) {
      return reply("ASK_CLARIFICATION", {
        bot_message: message("clarification", "BOT", "Elige una opción."),
        requires_clarification: true,
        clarification_options: ["Consultar un saldo"],
        offers_ticket: true,
        sources: [
          {
            title: "Canales digitales",
            category: "Banca digital",
            url: "https://www.bancognb.com.pe/inicio/canales/canales-digitales",
            verified_at: "2026-10-05T00:00:00Z",
          },
          {
            title: "Fuente no segura",
            category: null,
            url: "javascript:alert(1)",
            verified_at: null,
          },
        ],
      });
    }
    if (index === 1) {
      return reply("NONE", {
        bot_message: message("plain-reply", "BOT", "Si quieres, puedo crear un ticket."),
        offers_ticket: true,
      });
    }
    return reply("CONVERT_TO_TICKET", {
      bot_message: message("convert-reply", "BOT", "Puedo continuar con esta consulta."),
      offers_ticket: false,
    });
  });

  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await sendMessage(page, "Quiero consultar un tema sin usar las preguntas sugeridas");
  await expect(widget.getByRole("button", { name: "Consultar un saldo" })).toBeVisible();
  const sourceLink = widget.getByRole("link", { name: "Canales digitales" });
  await expect(sourceLink).toHaveAttribute(
    "href",
    "https://www.bancognb.com.pe/inicio/canales/canales-digitales",
  );
  await expect(sourceLink).toHaveAttribute("rel", /noopener/);
  await expect(widget.getByText(/verificada/i)).toBeVisible();
  await expect(widget.getByText("Fuente no segura")).toBeVisible();
  await expect(widget.locator('a[href^="javascript:"]')).toHaveCount(0);

  await sendMessage(page, "Mi siguiente pregunta es libre");
  await expect(widget.getByText("Si quieres, puedo crear un ticket.")).toBeVisible();
  await expect(widget.getByRole("link", { name: "Iniciar sesión" })).toHaveCount(0);
  await expect(widget.getByRole("button", { name: "Convertir en solicitud" })).toHaveCount(0);

  await sendMessage(page, "Puedo convertir esta consulta");
  await expect(widget.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  expect(sent()).toBe(3);
  expect(unhandled).toEqual([]);
});

test("muestra una respuesta de IA aceptada con su fuente verificada", async ({
  page,
}) => {
  await openAssistant(page, false);
  const sent = await installCreateAndMessageRoutes(page, () =>
    reply("NONE", {
      bot_message: message(
        "accepted-ai-answer",
        "BOT",
        "Los servicios adicionales pueden configurarse desde canales digitales.",
      ),
      response_source: "AI",
      fallback_reason: null,
      sources: [
        {
          title: "Compras por internet en tarjetas",
          category: "Tarjetas",
          url: "https://www.bancognb.com.pe/inicio/banca-personas/tarjetas",
          verified_at: "2026-11-01T00:00:00Z",
        },
      ],
    }),
  );

  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await sendMessage(page, "¿Cómo configuro compras por internet?");
  await expect.poll(sent).toBe(1);

  await expect(
    widget.getByText(
      "Los servicios adicionales pueden configurarse desde canales digitales.",
    ),
  ).toBeVisible();
  await expect(
    widget.getByRole("link", { name: "Compras por internet en tarjetas" }),
  ).toHaveAttribute(
    "href",
    "https://www.bancognb.com.pe/inicio/banca-personas/tarjetas",
  );
  await expect(widget.getByText(/verificada/i)).toBeVisible();
  await expect(widget.getByText("OUT_OF_CONTEXT")).toHaveCount(0);
  await expect(widget.getByText("GENERATED")).toHaveCount(0);
});

test("muestra el fallback sin fuentes inventadas y permite continuar consultando", async ({
  page,
}) => {
  await openAssistant(page, false);
  const sent = await installCreateAndMessageRoutes(page, (index) =>
    index === 0
      ? reply("NONE", {
          bot_message: message(
            "safe-fallback",
            "BOT",
            "No encontré información suficiente para responder con seguridad.",
          ),
          fallback_reason: "OUT_OF_CONTEXT",
          response_source: "FALLBACK",
          sources: [],
        })
      : reply("NONE", {
          bot_message: message(
            "followup-after-fallback",
            "BOT",
            "Puedo ayudarte con otra consulta.",
          ),
          sources: [],
        }),
  );

  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await sendMessage(page, "¿Qué debería hacer?");
  await expect(
    widget.getByText(
      "No encontré información suficiente para responder con seguridad.",
    ),
  ).toBeVisible();
  await expect(
    widget.getByRole("heading", { name: "Fuentes consultadas" }),
  ).toHaveCount(0);

  await sendMessage(page, "Quiero consultar otra cosa");
  await expect(
    widget.getByText("Puedo ayudarte con otra consulta."),
  ).toBeVisible();
  expect(sent()).toBe(2);
});

test("muestra opciones del contrato y envía el option_id seleccionado", async ({
  page,
}) => {
  const unhandled = await openAssistant(page, false);
  const sentBodies: Record<string, unknown>[] = [];
  await page.route("**/api/v1/chat/conversations", (route) =>
    fulfillJson(route, 201, conversation(conversationId)),
  );
  await page.route(
    "**/api/v1/chat/conversations/*/messages",
    async (route) => {
      sentBodies.push(route.request().postDataJSON() as Record<string, unknown>);
      const current = sentBodies.length - 1;
      if (current === 1) {
        await route.abort("failed");
        return;
      }
      await fulfillJson(
        route,
        200,
        current === 0
          ? reply("ASK_CLARIFICATION", {
              bot_message: message(
                "faq-discovery-reply",
                "BOT",
                "¿Sobre qué categoría quieres consultar?",
              ),
              ui: {
                type: "FAQ_CATEGORY_CHOICES",
                menu_id: "faq-discovery",
                options: [
                  {
                    id: "category:00000000-0000-4000-8000-000000000001",
                    label: "Tarjetas",
                    action: "SHOW_FAQ_CATEGORY",
                  },
                ],
              },
            })
          : reply("NONE", {
              bot_message: message(
                "faq-category-reply",
                "BOT",
                "Estas son las consultas frecuentes sobre tarjetas.",
              ),
              ui: {
                type: "FAQ_CHOICES",
                menu_id: "faq:category",
                options: [
                  {
                    id: "faq:00000000-0000-4000-8000-000000000002",
                    label: "¿Cómo habilito compras por internet?",
                    action: "SELECT_FAQ",
                  },
                ],
              },
            }),
      );
    },
  );

  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await sendMessage(page, "¿Qué consultas puedo hacer?");
  await widget
    .getByRole("button", { name: "Tarjetas", exact: true })
    .click();
  await widget.getByRole("button", { name: "Reintentar" }).click();

  await expect(
    widget.getByText("Estas son las consultas frecuentes sobre tarjetas."),
  ).toBeVisible();
  await expect(
    widget.getByRole("button", {
      name: "¿Cómo habilito compras por internet?",
    }),
  ).toBeVisible();
  expect(sentBodies).toEqual([
    { content: "¿Qué consultas puedo hacer?" },
    { option_id: "category:00000000-0000-4000-8000-000000000001" },
    { option_id: "category:00000000-0000-4000-8000-000000000001" },
  ]);
  expect(unhandled).toEqual([]);
});

test("restaura las opciones interactivas persistidas por el backend", async ({
  page,
}) => {
  const restoredId = "conversation-with-restored-ui";
  const ui = {
    type: "FAQ_SUBCATEGORY_CHOICES",
    menu_id: "faq-category:cards",
    options: [
      {
        id: "subcategory:0123456789abcdef",
        label: "Compras por internet",
        action: "SHOW_FAQ_SUBCATEGORY",
      },
    ],
  };
  await page.addInitScript((id) => {
    sessionStorage.setItem("gnb.chat.conversation.v1", id);
  }, restoredId);
  const unhandled = await installApiGuard(page, { authenticated: false });
  await page.route(
    `**/api/v1/chat/conversations/${restoredId}`,
    (route) =>
      fulfillJson(
        route,
        200,
        conversation(restoredId, [
          message("restored-user", "USER", "Quiero consultar sobre tarjetas"),
          message("restored-bot", "BOT", "Elige un tema para continuar."),
        ], ui),
      ),
  );

  await page.goto("/");
  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();

  await expect(
    widget.getByRole("button", { name: "Compras por internet" }),
  ).toBeVisible();
  expect(unhandled).toEqual([]);
});

test("solicitar contacto con asesor requiere una acción explícita", async ({
  page,
}) => {
  const unhandled = await openAssistant(page, false);
  await installCreateAndMessageRoutes(page, () =>
    reply("CONTACT_ADVISOR", {
      bot_message: message("advisor-offer", "BOT", "Puedes solicitar seguimiento."),
    }),
  );
  let escalations = 0;
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}/escalate`,
    async (route) => {
      escalations += 1;
      await fulfillJson(route, 200, {
        id: conversationId,
        status: "ESCALATED",
        messages: [],
      });
    },
  );

  await sendMessage(page, "Quisiera consultar con alguien");
  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await expect(widget.getByRole("button", { name: "Solicitar seguimiento" })).toBeVisible();
  expect(escalations).toBe(0);

  await widget.getByRole("button", { name: "Solicitar seguimiento" }).click();
  await expect(widget.locator(".assistant-escalation")).toContainText(
    "No es un chat humano en tiempo real",
  );
  expect(escalations).toBe(1);
  expect(unhandled).toEqual([]);
});

test("revisa el formulario y confirma una sola conversión aunque se haga doble clic", async ({
  page,
}) => {
  const unhandled = await openAssistant(page);
  await installCreateAndMessageRoutes(page, () =>
    reply("CONVERT_TO_TICKET", {
      bot_message: message("convert-offer", "BOT", "Puedo registrar esta solicitud."),
    }),
  );
  let conversions = 0;
  let submitted: Record<string, unknown> | null = null;
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}/convert-to-ticket`,
    async (route) => {
      conversions += 1;
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 100));
      await fulfillJson(route, 201, {
        id: "created-ticket",
        tracking_code: "TCK-2026-0042",
        status: "NUEVO",
      });
    },
  );

  await sendMessage(page, "Necesito ayuda con banca digital");
  await page.getByRole("button", { name: "Convertir en solicitud" }).click();
  const dialog = page.locator(".assistant-ticket-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Categoría").selectOption(category.id);
  await dialog.getByLabel("Asunto").fill("No puedo ingresar a la banca móvil");
  await dialog
    .getByLabel("Descripción")
    .fill("La aplicación no me permite iniciar sesión desde esta mañana.");
  await dialog.getByLabel("Prioridad").selectOption("ALTA");
  await dialog.getByRole("button", { name: "Revisar resumen" }).click();

  await expect(dialog.getByText("No puedo ingresar a la banca móvil")).toBeVisible();
  await expect(dialog.getByText("La aplicación no me permite iniciar sesión desde esta mañana.")).toBeVisible();
  await expect(dialog.getByText("Banca digital")).toBeVisible();
  expect(conversions).toBe(0);

  const confirm = dialog.getByRole("button", { name: "Confirmar creación de solicitud" });
  await confirm.dblclick();
  await expect(dialog.getByText("TCK-2026-0042")).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Ver detalle de la solicitud" }),
  ).toHaveAttribute("href", "/app/solicitudes/created-ticket");
  expect(conversions).toBe(1);
  expect(submitted).toEqual({
    category_id: category.id,
    subject: "No puedo ingresar a la banca móvil",
    description: "La aplicación no me permite iniciar sesión desde esta mañana.",
    priority: "ALTA",
  });
  expect(unhandled).toEqual([]);
});

test("retorna del ingreso, vincula la conversación y retoma el formulario sin crearlo", async ({
  page,
}) => {
  const unhandled = await openAssistant(page, false);
  await installCreateAndMessageRoutes(page, () => reply("CONVERT_TO_TICKET"));
  let loginCount = 0;
  let links = 0;
  let conversions = 0;
  await page.route("**/api/v1/auth/login", async (route) => {
    loginCount += 1;
    await fulfillJson(route, 200, {
      access_token: session.token,
      user: session.user,
    });
  });
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
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}/convert-to-ticket`,
    async (route) => {
      conversions += 1;
      await fulfillJson(route, 201, {
        id: "should-not-be-created",
        tracking_code: "TCK-UNEXPECTED",
        status: "NUEVO",
      });
    },
  );
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}`,
    (route) =>
      fulfillJson(
        route,
        200,
        conversation(conversationId, [
          message("history-user", "USER", "Necesito ayuda con mi consulta"),
          message("history-bot", "BOT", "Puedo registrar una solicitud."),
        ]),
      ),
  );

  await sendMessage(page, "Necesito ayuda con mi consulta");
  await page.getByRole("link", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/ingresar\?returnTo=%2Fapp%2Fasistente/);
  const storedDraft = await page.evaluate(() => ({
    activeConversation: sessionStorage.getItem("gnb.chat.conversation.v1"),
    draft: sessionStorage.getItem("gnb.chat.ticket-draft.v1"),
    allValues: Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index);
      return key ? (sessionStorage.getItem(key) ?? "") : "";
    }),
  }));
  expect(storedDraft.activeConversation).toBe(conversationId);
  expect(storedDraft.draft).toBe(conversationId);
  expect(storedDraft.allValues.join(" ")).not.toContain("demo-password");

  await page.getByLabel("Correo electrónico").fill(session.user.email);
  await page.locator('input[name="password"]').fill("Demo-password-2026");
  await page.getByRole("button", { name: "Ingresar" }).click();
  const dialog = page.locator(".assistant-ticket-dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(() => links).toBe(1);
  await expect(dialog.getByLabel("Descripción")).toHaveValue(
    /Necesito ayuda con mi consulta/,
  );
  expect(loginCount).toBe(1);
  expect(conversions).toBe(0);
  expect(unhandled).toEqual([]);
});

test("el registro conserva el retorno al asistente hasta el ingreso", async ({
  page,
}) => {
  const unhandled = await openAssistant(page, false);
  await installCreateAndMessageRoutes(page, () => reply("CONVERT_TO_TICKET"));
  await page.route("**/api/v1/auth/register", async (route) => {
    await fulfillJson(route, 201, {
      id: "registered-client",
      full_name: "Cliente de pruebas",
      email: "cliente@example.test",
      role: "CLIENTE",
    });
  });

  await sendMessage(page, "Necesito registrar una consulta");
  await page.getByRole("link", { name: "Registrarme" }).click();
  await expect(page).toHaveURL(/\/registro\?returnTo=%2Fapp%2Fasistente/);
  await page.getByLabel("Nombre completo").fill("Cliente de pruebas");
  await page.getByLabel("Correo electrónico").fill("cliente@example.test");
  await page.locator('input[name="password"]').fill("Demo-password-2026");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/verificar-cuenta\?returnTo=%2Fapp%2Fasistente/);
  await page.getByRole("link", { name: "Ir al ingreso" }).click();
  await expect(page).toHaveURL(/\/ingresar\?returnTo=%2Fapp%2Fasistente/);
  expect(unhandled).toEqual([]);
});

test("un 401 vuelve a ingresar, recupera la conversación y vuelve a pedir confirmación", async ({
  page,
}) => {
  const unhandled = await openAssistant(page);
  await installCreateAndMessageRoutes(page, () => reply("CONVERT_TO_TICKET"));
  let conversionAttempts = 0;
  let links = 0;
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}/convert-to-ticket`,
    async (route) => {
      conversionAttempts += 1;
      if (conversionAttempts === 1) {
        await fulfillJson(route, 401, {
          code: "AUTHENTICATION_REQUIRED",
          message: "Autenticación requerida.",
        });
        return;
      }
      await fulfillJson(route, 201, {
        id: "ticket-after-login",
        tracking_code: "TCK-AFTER-LOGIN",
        status: "NUEVO",
      });
    },
  );
  await page.route("**/api/v1/auth/login", async (route) =>
    fulfillJson(route, 200, {
      access_token: session.token,
      user: session.user,
    }),
  );
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
  await page.route(
    `**/api/v1/chat/conversations/${conversationId}`,
    (route) =>
      fulfillJson(
        route,
        200,
        conversation(conversationId, [
          message("auth-user", "USER", "Necesito registrar una consulta"),
          message("auth-bot", "BOT", "Puedo continuar con esta solicitud."),
        ]),
      ),
  );

  await sendMessage(page, "Necesito registrar una consulta");
  await page.getByRole("button", { name: "Convertir en solicitud" }).click();
  let dialog = page.locator(".assistant-ticket-dialog");
  await dialog.getByLabel("Categoría").selectOption(category.id);
  await dialog
    .getByLabel("Descripción")
    .fill("Texto temporal que no debe guardarse en sessionStorage.");
  await dialog.getByRole("button", { name: "Revisar resumen" }).click();
  await dialog
    .getByRole("button", { name: "Confirmar creación de solicitud" })
    .click();

  await expect(page).toHaveURL(/\/ingresar$/);
  await expect(page.getByText(/Tu sesión venció/)).toBeVisible();
  const storedValues = await page.evaluate(() =>
    Array.from({ length: sessionStorage.length }, (_, index) => {
      const key = sessionStorage.key(index);
      return key ? (sessionStorage.getItem(key) ?? "") : "";
    }),
  );
  expect(storedValues.join(" ")).not.toContain("Texto temporal");
  expect(storedValues.join(" ")).not.toContain("demo-password-local");

  await page.getByLabel("Correo electrónico").fill(session.user.email);
  await page.locator('input[name="password"]').fill("demo-password-local");
  await page.getByRole("button", { name: "Ingresar" }).click();
  dialog = page.locator(".assistant-ticket-dialog");
  await expect(dialog).toBeVisible();
  await expect.poll(() => links).toBe(1);
  expect(conversionAttempts).toBe(1);

  await dialog.getByLabel("Categoría").selectOption(category.id);
  await dialog.getByRole("button", { name: "Revisar resumen" }).click();
  expect(conversionAttempts).toBe(1);
  await dialog
    .getByRole("button", { name: "Confirmar creación de solicitud" })
    .click();
  await expect(dialog.getByText("TCK-AFTER-LOGIN")).toBeVisible();
  expect(conversionAttempts).toBe(2);
  expect(unhandled).toEqual([]);
});

test("reinicia en una conversación nueva y tras recargar solo recupera su historial", async ({
  page,
}) => {
  await page.addInitScript(({ savedSession, activeId }) => {
    localStorage.setItem("gnb.session.v1", JSON.stringify(savedSession));
    if (!sessionStorage.getItem("gnb.chat.conversation.v1")) {
      sessionStorage.setItem("gnb.chat.conversation.v1", activeId);
    }
  }, { savedSession: session, activeId: "old-conversation" });
  const unhandled = await installApiGuard(page, { authenticated: false });
  const fetched: string[] = [];
  await page.route("**/api/v1/chat/conversations/old-conversation", async (route) => {
    fetched.push("old-conversation");
    await fulfillJson(
      route,
      200,
      conversation("old-conversation", [
        message("old-user", "USER", "Historial anterior que debe conservarse"),
      ]),
    );
  });
  await page.route("**/api/v1/chat/conversations/new-conversation", async (route) => {
    fetched.push("new-conversation");
    await fulfillJson(route, 200, conversation("new-conversation"));
  });
  let creates = 0;
  await page.route("**/api/v1/chat/conversations", async (route) => {
    creates += 1;
    await fulfillJson(route, 201, conversation("new-conversation"));
  });

  await page.goto("/app/asistente");
  await expect(page.getByText("Historial anterior que debe conservarse")).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar conversación" }).click();
  const resetConfirmation = page.getByRole("alertdialog");
  await expect(resetConfirmation).toContainText("permanecerá guardada");
  await resetConfirmation
    .getByRole("button", { name: "Reiniciar conversación" })
    .click();
  await expect(page.getByText("¿Qué necesitas resolver hoy?")).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("gnb.chat.conversation.v1"),
    ),
  ).toBe("new-conversation");
  await page.reload();
  await expect(page.getByText("¿Qué necesitas resolver hoy?")).toBeVisible();
  await expect(page.getByText("Historial anterior que debe conservarse")).toHaveCount(0);
  expect(fetched).toEqual(["old-conversation", "new-conversation"]);
  expect(creates).toBe(1);
  expect(unhandled).toEqual([]);
});

test("si falla el reinicio conserva la conversación y permite reintentarlo", async ({
  page,
}) => {
  await page.addInitScript((savedSession) => {
    localStorage.setItem("gnb.session.v1", JSON.stringify(savedSession));
    sessionStorage.setItem("gnb.chat.conversation.v1", "recoverable-conversation");
  }, session);
  const unhandled = await installApiGuard(page, { authenticated: false });
  await page.route("**/api/v1/chat/conversations/recoverable-conversation", (route) =>
    fulfillJson(
      route,
      200,
      conversation("recoverable-conversation", [
        message("kept-message", "USER", "Este historial debe permanecer visible"),
      ]),
    ),
  );
  let creates = 0;
  await page.route("**/api/v1/chat/conversations", async (route) => {
    creates += 1;
    if (creates === 1) {
      await fulfillJson(route, 503, {
        code: "SERVICE_UNAVAILABLE",
        message: "No disponible",
      });
      return;
    }
    await fulfillJson(route, 201, conversation("replacement-conversation"));
  });

  await page.goto("/app/asistente");
  await expect(page.getByText("Este historial debe permanecer visible")).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar conversación" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Reiniciar conversación" })
    .click();
  await expect(page.getByRole("alert")).toContainText("Tu conversación actual sigue disponible");
  await expect(page.getByText("Este historial debe permanecer visible")).toBeVisible();
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("gnb.chat.conversation.v1"),
    ),
  ).toBe("recoverable-conversation");

  await page.getByRole("button", { name: "Iniciar una conversación nueva" }).click();
  await expect(page.getByText("¿Qué necesitas resolver hoy?")).toBeVisible();
  expect(creates).toBe(2);
  expect(unhandled).toEqual([]);
});

for (const failure of [
  { name: "403", status: 403, expected: "No tienes permisos" },
  { name: "404", status: 404, expected: "No encontramos esta conversación" },
  { name: "409", status: 409, expected: "La conversación ya cambió" },
  { name: "429", status: 429, expected: "límite de solicitudes" },
  { name: "red", status: 0, expected: "No pudimos conectar" },
]) {
  test(`conserva el formulario tras un error ${failure.name} al crear el ticket`, async ({
    page,
  }) => {
    const unhandled = await openAssistant(page);
    await installCreateAndMessageRoutes(page, () => reply("CONVERT_TO_TICKET"));
    await page.route(
      `**/api/v1/chat/conversations/${conversationId}/convert-to-ticket`,
      async (route) => {
        if (failure.status === 0) {
          await route.abort("failed");
          return;
        }
        await fulfillJson(route, failure.status, {
          code: `HTTP_${failure.status}`,
          message: "Error simulado de conversión.",
        });
      },
    );

    await sendMessage(page, "Necesito ayuda con mi cuenta");
    await page.getByRole("button", { name: "Convertir en solicitud" }).click();
    const dialog = page.locator(".assistant-ticket-dialog");
    await dialog.getByLabel("Categoría").selectOption(category.id);
    await dialog.getByLabel("Asunto").fill("Consulta que debe conservarse");
    await dialog.getByLabel("Descripción").fill("Descripción editable conservada.");
    await dialog.getByLabel("Prioridad").selectOption("ALTA");
    await dialog.getByRole("button", { name: "Revisar resumen" }).click();
    await dialog
      .getByRole("button", { name: "Confirmar creación de solicitud" })
      .click();

    await expect(dialog.getByRole("alert")).toContainText(failure.expected);
    await dialog.getByRole("button", { name: "Editar solicitud" }).click();
    await expect(dialog.getByLabel("Asunto")).toHaveValue(
      "Consulta que debe conservarse",
    );
    await expect(dialog.getByLabel("Descripción")).toHaveValue(
      "Descripción editable conservada.",
    );
    expect(unhandled).toEqual([]);
  });
}
