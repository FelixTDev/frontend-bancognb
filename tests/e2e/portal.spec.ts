import { expect, test, type Page } from "@playwright/test";

const password = "demo-password-local";

async function login(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

async function openAppNavigation(page: Page, projectName: string) {
  if (projectName !== "tablet") return;
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await expect(page.getByRole("button", { name: "Cerrar menú" })).toBeFocused();
}

test("la portada presenta el servicio y navega por contenido público", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Banco GNB/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "acompañada",
  );
  await expect(
    page.getByRole("link", { name: "Crear una solicitud" }).first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Cómo funciona" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "recorrido",
  );
});

test("el widget anónimo existe solo en Landing y restaura el foco con Escape", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "Abrir Asistente GNB" });
  await expect(launcher).toBeVisible();
  await launcher.click();

  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await expect(widget).toBeVisible();
  await expect(
    widget.getByRole("button", { name: "Cerrar asistente" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    widget.getByRole("textbox", { name: "Escribe tu consulta" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    widget.getByRole("button", { name: "Cerrar asistente" }),
  ).toBeFocused();
  await expect
    .poll(() =>
      widget.evaluate((element) =>
        Number.parseFloat(getComputedStyle(element).animationDuration) || 0,
      ),
    )
    .toBeLessThanOrEqual(0.01);
  await expect(
    widget.getByText("No compartas contraseñas ni códigos de seguridad."),
  ).toBeVisible();
  await expect(
    widget.getByRole("textbox", { name: "Escribe tu consulta" }),
  ).toBeVisible();
  const sendBounds = await widget
    .getByRole("button", { name: "Enviar consulta" })
    .boundingBox();
  expect(sendBounds?.height ?? Number.MAX_VALUE).toBeLessThanOrEqual(56);

  await page.keyboard.press("Escape");
  await expect(widget).toBeHidden();
  await expect(launcher).toBeFocused();

  await page.locator(".closing-cta").scrollIntoViewIfNeeded();
  await expect(page.locator(".assistant-widget")).toHaveClass(/obstructed/);

  await page.goto("/ingresar");
  await expect(
    page.getByRole("button", { name: "Abrir Asistente GNB" }),
  ).toHaveCount(0);
  await page.goto("/registro");
  await expect(
    page.getByRole("button", { name: "Abrir Asistente GNB" }),
  ).toHaveCount(0);
});

test("el asistente respeta saludo, consulta, aclaración y acciones habilitadas por la API", async ({
  page,
}) => {
  let messageNumber = 0;
  const replies = [
    {
      user_message: { id: "greeting-user", sender_type: "USER", content: "Hola", created_at: new Date().toISOString() },
      bot_message: { id: "greeting-bot", sender_type: "BOT", content: "¡Hola! ¿En qué puedo ayudarte?", intent: "GREETING", confidence: 1, created_at: new Date().toISOString() },
      resolved: true,
      offers_ticket: false,
      suggested_action: "NONE",
      confidence: 1,
      requires_clarification: false,
      clarification_options: [],
      fallback_reason: null,
      conversation_status: "ACTIVE",
      response_source: "DETERMINISTIC",
      sources: [],
    },
    {
      user_message: { id: "status-user", sender_type: "USER", content: "Hola, ¿cómo consulto el estado de mi solicitud?", created_at: new Date().toISOString() },
      bot_message: { id: "status-bot", sender_type: "BOT", content: "Puedes consultar el estado desde la sección Mis solicitudes.", intent: "CONSULTAR_ESTADO_SOLICITUD", confidence: 0.92, created_at: new Date().toISOString() },
      resolved: true,
      offers_ticket: false,
      suggested_action: "NONE",
      confidence: 0.92,
      requires_clarification: false,
      clarification_options: [],
      fallback_reason: null,
      conversation_status: "ACTIVE",
      response_source: "FAQ",
      sources: [{ title: "Consultar estado de solicitud", category: "SOLICITUDES" }],
    },
    {
      user_message: { id: "unknown-user", sender_type: "USER", content: "No encuentro el trámite ZQX-913", created_at: new Date().toISOString() },
      bot_message: { id: "unknown-bot", sender_type: "BOT", content: "¿Puedes aclarar si consultas el estado de una solicitud o sus requisitos?", intent: null, confidence: 0.12, created_at: new Date().toISOString() },
      resolved: false,
      offers_ticket: false,
      suggested_action: "ASK_CLARIFICATION",
      confidence: 0.12,
      requires_clarification: true,
      clarification_options: ["Consultar el estado de una solicitud"],
      fallback_reason: "LOW_CONFIDENCE",
      conversation_status: "ACTIVE",
      response_source: "FALLBACK",
      sources: [],
    },
    {
      user_message: { id: "clarification-user", sender_type: "USER", content: "Consultar el estado de una solicitud", created_at: new Date().toISOString() },
      bot_message: { id: "clarification-bot", sender_type: "BOT", content: "Puedo registrar una solicitud de seguimiento para esta consulta.", intent: "CONSULTAR_ESTADO_SOLICITUD", confidence: 0.21, created_at: new Date().toISOString() },
      resolved: false,
      offers_ticket: true,
      suggested_action: "CONTACT_ADVISOR",
      confidence: 0.21,
      requires_clarification: false,
      clarification_options: [],
      fallback_reason: null,
      conversation_status: "ACTIVE",
      response_source: "DETERMINISTIC",
      sources: [],
    },
  ] as const;

  await page.route("**/api/v1/chat/conversations", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ id: "stateful-chat", status: "ACTIVE", messages: [] }),
    });
  });
  await page.route(
    "**/api/v1/chat/conversations/stateful-chat/messages",
    async (route) => {
      const reply = replies[messageNumber];
      messageNumber += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(reply) });
    },
  );
  let escalationRequest: Record<string, unknown> | null = null;
  await page.route(
    "**/api/v1/chat/conversations/stateful-chat/escalate",
    async (route) => {
      escalationRequest = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "stateful-chat", status: "ESCALATED", messages: [] }) });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();
  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  const composer = widget.getByRole("textbox", { name: "Escribe tu consulta" });
  const send = widget.getByRole("button", { name: "Enviar consulta" });

  await composer.fill("Hola");
  await send.click();
  await expect(widget.getByText("¡Hola! ¿En qué puedo ayudarte?")).toBeVisible();
  await expect(widget.locator(".assistant-notice--warning")).toHaveCount(0);
  await expect(widget.locator(".assistant-followup")).toHaveCount(0);
  await expect(widget.locator(".assistant-auth-prompt")).toHaveCount(0);

  await composer.fill("Hola, ¿cómo consulto el estado de mi solicitud?");
  await send.click();
  await expect(widget.getByText("Puedes consultar el estado desde la sección Mis solicitudes.")).toBeVisible();
  await expect(widget.locator(".assistant-notice--warning")).toHaveCount(0);
  await expect(widget.locator(".assistant-followup")).toHaveCount(0);

  await composer.fill("No encuentro el trámite ZQX-913");
  await send.click();
  await expect(widget.getByText("¿Puedes aclarar si consultas el estado de una solicitud o sus requisitos?")).toBeVisible();
  await expect(widget.locator(".assistant-clarification")).toBeVisible();
  await expect(widget.locator(".assistant-followup")).toHaveCount(0);
  await expect(widget.locator(".assistant-auth-prompt")).toHaveCount(0);
  await expect(widget.locator(".assistant-escalation")).toHaveCount(0);

  await widget.getByRole("button", { name: "Consultar el estado de una solicitud" }).click();
  await expect(widget.getByText("Puedo registrar una solicitud de seguimiento para esta consulta.")).toBeVisible();
  await expect(widget.locator(".assistant-followup")).toBeVisible();
  await expect(widget.getByRole("link", { name: "Iniciar sesión" })).toHaveCount(0);
  await widget.getByRole("button", { name: "Solicitar seguimiento" }).click();
  await expect.poll(() => escalationRequest).toEqual({ reason: "Solicitud de seguimiento desde el asistente digital" });
  await expect(widget.locator(".assistant-escalation")).toContainText("No es un chat humano en tiempo real");
});

test("el widget representa 429, reintento, aclaración y autenticación para convertir", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/v1/chat/conversations", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        id: "anonymous-conversation",
        status: "ACTIVE",
        started_at: new Date().toISOString(),
        turn_count: 0,
        last_activity_at: new Date().toISOString(),
        messages: [],
      }),
    });
  });
  await page.route(
    "**/api/v1/chat/conversations/anonymous-conversation/messages",
    async (route) => {
      attempts += 1;
      if (attempts === 1) {
        await route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Demasiadas solicitudes",
            error_code: "RATE_LIMITED",
            request_id: "request-rate-limit",
          }),
        });
        return;
      }
      if (attempts === 3) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            code: "CHAT_UNAVAILABLE",
            message: "El asistente no está disponible temporalmente.",
            request_id: "request-service-error",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_message: {
            id: "user-message",
            sender_type: "USER",
            content: "Necesito orientación",
            created_at: new Date().toISOString(),
          },
          bot_message: {
            id: "bot-message",
            sender_type: "BOT",
            content: "Necesito un dato adicional para orientarte.",
            confidence: 0.2,
            created_at: new Date().toISOString(),
          },
          confidence: 0.2,
          resolved: false,
          offers_ticket: true,
          suggested_action: "ASK_CLARIFICATION",
          requires_clarification: true,
          clarification_options: ["Consultar el estado", "Registrar un reclamo"],
          fallback_reason: "LOW_CONFIDENCE",
          conversation_status: "ACTIVE",
          response_source: "FALLBACK",
          sources: [],
        }),
      });
    },
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Asistente GNB" }).click();
  const widget = page.getByRole("dialog", { name: "Asistente GNB" });
  await widget
    .getByRole("textbox", { name: "Escribe tu consulta" })
    .fill("Necesito orientación");
  await widget.getByRole("button", { name: "Enviar consulta" }).click();
  await expect(widget.getByText(/límite de solicitudes/i)).toBeVisible();
  await expect(widget.getByText("request-rate-limit")).toBeVisible();

  await widget.getByRole("button", { name: "Reintentar" }).click();
  await expect(
    widget.getByText("Necesito un dato adicional para orientarte."),
  ).toBeVisible();
  await expect(widget.locator(".assistant-clarification")).toBeVisible();
  await expect(widget.locator(".assistant-notice--warning")).toHaveCount(0);
  await expect(widget.locator(".assistant-followup")).toHaveCount(0);
  await expect(
    widget.getByRole("button", { name: "Consultar el estado" }),
  ).toBeVisible();
  await expect(widget.locator(".assistant-auth-prompt")).toHaveCount(0);
  await widget.getByRole("button", { name: "Consultar el estado" }).click();
  await expect(
    widget.getByText("El asistente no está disponible temporalmente."),
  ).toBeVisible();
  await expect(widget.getByText("request-service-error")).toBeVisible();
});

test("nosotros presenta la historia institucional y sus canales de atención", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/nosotros");

  const about = page.locator(".about-page");
  await expect(
    about.getByRole("heading", {
      level: 1,
      name: "Una historia de confianza que sigue avanzando",
    }),
  ).toBeVisible();
  for (const heading of [
    "Quiénes somos",
    "Presencia que conecta",
    "Banca Personal",
    "Banca Empresarial",
    "Atención humana y calificada",
    "Juntos llegamos más lejos",
  ]) {
    await expect(about.getByRole("heading", { name: heading })).toBeVisible();
  }

  const images = about.locator("img");
  await expect(images).toHaveCount(5);
  await images.last().scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      images.evaluateAll((nodes) =>
        nodes.every(
          (node) =>
            node instanceof HTMLImageElement &&
            node.complete &&
            node.naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);

  const fit = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(fit.content).toBeLessThanOrEqual(fit.viewport + 1);

  await about
    .getByRole("link", { name: "Crear una solicitud" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/registro$/);
  await page.goBack();
  await expect(about).toBeVisible();
  await about
    .getByRole("link", { name: "Ir a preguntas frecuentes" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/preguntas-frecuentes$/);
  expect(consoleErrors).toEqual([]);
});

test("el formulario de ingreso muestra validación local", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Ingresa un correo válido")).toBeVisible();
});

test("cliente inicia sesión, consulta solicitudes y no entra a supervisión", async ({
  page,
}, testInfo) => {
  await login(page, "cliente@demo.com");
  await expect(page).toHaveURL(/\/app\/inicio$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hola");
  await openAppNavigation(page, testInfo.project.name);
  await page
    .locator(testInfo.project.name === "mobile" ? ".bottom-nav" : ".sidebar")
    .getByRole("link", { name: "Solicitudes" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Mis solicitudes",
  );
  if (testInfo.project.name === "desktop") {
    await page.goto("/app/nueva-solicitud");
    await expect(page.getByLabel("Categoría")).toBeVisible();
    await expect(page.getByLabel("Asunto")).toBeVisible();
    await expect(page.getByLabel("Descripción")).toBeVisible();
    await page.goto("/app/asistente");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Asistente digital",
    );
  }
  await page.goto("/supervisor/operacion");
  await expect(page).toHaveURL(/\/sin-acceso$/);
});

test("el asistente vincula, retroalimenta, escala, reinicia y prepara una solicitud", async ({
  page,
}, testInfo) => {
  const e2eUser = {
    id: "e2e-client",
    full_name: "Cliente E2E",
    email: "cliente@demo.com",
    role: "CLIENTE",
  };
  const unhandledMutations: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== "GET") {
      unhandledMutations.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 501,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unmocked mutation" }),
      });
      return;
    }
    if (path === "/api/v1/auth/me") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(e2eUser),
      });
      return;
    }
    if (path === "/api/v1/categories") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          { id: "digital", name: "Banca digital", is_active: true },
        ]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "e2e-token", user: e2eUser }),
    });
  });
  await login(page, "cliente@demo.com");
  await expect(page).toHaveURL(/\/app\/inicio$/);
  let linked = false;
  await page.route(
    "**/api/v1/chat/conversations/e2e-linked/link-user",
    async (route) => {
      linked = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "e2e-linked", status: "ACTIVE" }),
      });
    },
  );
  await page.route(
    "**/api/v1/chat/conversations/e2e-linked",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-linked",
          status: "ACTIVE",
          messages: [],
          turn_count: 0,
          started_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        }),
      });
    },
  );
  await page.route("**/api/v1/chat/conversations/e2e-linked/messages", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user_message: {
          id: "e2e-user-message",
          sender_type: "USER",
          content: "Necesito que un asesor revise esta consulta",
          created_at: new Date().toISOString(),
        },
        bot_message: {
          id: "e2e-bot-message",
          sender_type: "BOT",
          content: "Puedo derivar tu consulta al equipo de atención.",
          confidence: 0.2,
          created_at: new Date().toISOString(),
        },
        confidence: 0.2,
        resolved: false,
        offers_ticket: false,
        suggested_action: "CONTACT_ADVISOR",
        requires_clarification: false,
        clarification_options: [],
        fallback_reason: null,
        conversation_status: "ACTIVE",
        response_source: "DETERMINISTIC",
        sources: [],
      }),
    });
  });
  await page.route(
    "**/api/v1/chat/conversations/e2e-linked/feedback",
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          conversation_id: "e2e-linked",
          is_helpful: true,
        }),
      });
    },
  );
  await page.route(
    "**/api/v1/chat/conversations/e2e-linked/escalate",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-linked",
          status: "ESCALATED",
          escalation_reason: "Solicitud de seguimiento",
          messages: [],
        }),
      });
    },
  );
  await page.route(
    "**/api/v1/chat/conversations",
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-new",
          status: "ACTIVE",
          messages: [],
        }),
      });
    },
  );
  await page.route("**/api/v1/chat/conversations/e2e-new", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "e2e-new",
        status: "ACTIVE",
        messages: [],
        turn_count: 0,
      }),
    });
  });
  await page.route(
    "**/api/v1/chat/conversations/e2e-new/messages",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user_message: {
            id: "new-user-message",
            sender_type: "USER",
            content: "Necesito registrar esta consulta",
            created_at: new Date().toISOString(),
          },
          bot_message: {
            id: "new-bot-message",
            sender_type: "BOT",
            content: "Puedo ayudarte a crear una solicitud.",
            confidence: 0.8,
            created_at: new Date().toISOString(),
          },
          confidence: 0.8,
          resolved: false,
          offers_ticket: true,
          suggested_action: "CONVERT_TO_TICKET",
          requires_clarification: false,
          clarification_options: [],
          conversation_status: "ACTIVE",
          response_source: "DETERMINISTIC",
          sources: [],
        }),
      });
    },
  );
  await page.route(
    "**/api/v1/chat/conversations/e2e-new/convert-to-ticket",
    async (route) => {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-ticket",
          tracking_code: "TCK-E2E-001",
          status: "NUEVO",
        }),
      });
    },
  );
  await page.evaluate(() =>
    window.sessionStorage.setItem("gnb.chat.conversation.v1", "e2e-linked"),
  );
  await page.goto("/app/asistente");
  await expect.poll(() => linked).toBe(true);
  await expect(
    testInfo.project.name === "mobile"
      ? page.locator(".assistant-guide--mobile > summary")
      : page.locator(".assistant-guide:not(.assistant-guide--mobile) h2"),
  ).toHaveText("Cómo usar el asistente");
  await expect(page.locator('img[src*="guided-empty-state"]')).toHaveCount(0);

  const composer = page.locator(".assistant-composer");
  await expect(composer).toBeVisible();
  const bounds = await composer.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds) {
    const lowerLimit =
      testInfo.project.name === "mobile"
        ? ((await page.locator(".bottom-nav").boundingBox())?.y ?? 844)
        : page.viewportSize()?.height ?? 900;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(lowerLimit + 1);
  }
  if (testInfo.project.name !== "mobile") {
    const chatWidth = (await page.locator(".assistant-panel--page").boundingBox())
      ?.width;
    const guideWidth = (await page.locator(".assistant-guide").first().boundingBox())
      ?.width;
    expect(chatWidth ?? 0).toBeGreaterThan(guideWidth ?? Number.MAX_VALUE);
  }

  await page
    .getByPlaceholder("Escribe tu consulta…")
    .fill("Necesito que un asesor revise esta consulta");
  await page.getByPlaceholder("Escribe tu consulta…").press("Enter");
  await expect(
    page.getByRole("button", { name: "Solicitar seguimiento" }),
  ).toBeVisible();
  await expect(page.locator(".assistant-notice--warning")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Convertir en solicitud" }),
  ).toHaveCount(0);

  await page
    .getByRole("button", { name: "La respuesta fue útil" })
    .click();
  await expect(page.getByText("Gracias por tu opinión.")).toBeVisible();
  await page.getByRole("button", { name: "Solicitar seguimiento" }).click();
  await expect(
    page.locator(".assistant-escalation").getByText(/no es un chat humano en tiempo real/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reiniciar conversación" }).click();
  await expect(page.getByText("¿En qué podemos orientarte?")).toBeVisible();
  await page
    .getByPlaceholder("Escribe tu consulta…")
    .fill("Necesito registrar esta consulta");
  await page.getByPlaceholder("Escribe tu consulta…").press("Enter");
  await page.getByRole("button", { name: "Convertir en solicitud" }).click();
  const dialog = page.getByRole("dialog", { name: "Crear solicitud" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Categoría")).toBeVisible();
  await expect(dialog.getByLabel("Asunto")).toHaveValue(
    "Consulta iniciada en el asistente",
  );
  await expect(dialog.getByLabel("Descripción")).toHaveValue(
    /Necesito registrar esta consulta/,
  );
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  expect(unhandledMutations).toEqual([]);
});

test("asesor inicia sesión y abre su bandeja", async ({ page }, testInfo) => {
  await login(page, "asesor@demo.com");
  await expect(page).toHaveURL(/\/asesor\/panel$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Panel de atención",
  );
  await openAppNavigation(page, testInfo.project.name);
  await page
    .locator(testInfo.project.name === "mobile" ? ".bottom-nav" : ".sidebar")
    .getByRole("link", { name: "Bandeja" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bandeja de atención",
  );
});

test("supervisor inicia sesión y consulta la operación", async ({ page }) => {
  await login(page, "supervisor@demo.com");
  await expect(page).toHaveURL(/\/supervisor\/operacion$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Operación");
  if (test.info().project.name !== "desktop") {
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(
      page.getByRole("button", { name: "Cerrar menú" }),
    ).toBeFocused();
  }
  await page.getByRole("link", { name: "Reportes" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reportes");
  await page.goto("/supervisor/contenido");
  await page.getByRole("button", { name: "Crear pregunta" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.getByRole("tab", { name: "Categorías" }).click();
  await page.getByRole("button", { name: "Crear categoría" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.goto("/supervisor/sla");
  await page.getByRole("button", { name: "Nueva política" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
});

test("auditoría representa la respuesta real del API sin campos heredados", async ({
  page,
}) => {
  await login(page, "supervisor@demo.com");
  await expect(page).toHaveURL(/\/supervisor\/operacion$/);
  await page.route("**/api/v1/audit?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        page: 1,
        page_size: 20,
        total: 2,
        total_pages: 1,
        items: [
          {
            action: "LOGIN_SUCCESS",
            resource_type: "USER",
            actor_role: "SUPERVISOR",
            occurred_at: "2026-10-03T12:00:00.000Z",
            success: true,
            request_id: "req-audit-success",
            error_code: null,
          },
          {
            action: "LOGIN_FAILED",
            resource_type: "USER",
            actor_role: null,
            occurred_at: "2026-10-03T12:05:00.000Z",
            success: false,
            request_id: null,
            error_code: "INVALID_CREDENTIALS",
          },
        ],
      }),
    });
  });

  await page.goto("/supervisor/auditoria");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Auditoría");
  await expect(page.getByText("ÉXITO", { exact: true })).toBeVisible();
  await expect(page.getByText("ERROR", { exact: true })).toBeVisible();
  await expect(page.getByText("req-audit-success")).toBeVisible();
  await expect(page.getByText("Sin correlativo")).toBeVisible();
  await expect(page.locator(".audit-list time").first()).toContainText(
    "3/10/26",
  );
  await expect(page.getByText("Ocurrió un error inesperado")).toHaveCount(0);
});

test("la navegación móvil se abre y no desborda horizontalmente", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "comprobación móvil");
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir navegación" }).click();
  await expect(
    page.getByRole("navigation", { name: "Navegación principal" }),
  ).toBeVisible();
  const fit = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(fit.content).toBeLessThanOrEqual(fit.viewport + 1);
});
