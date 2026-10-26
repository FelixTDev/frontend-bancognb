import { expect, test, type Page, type Route } from "@playwright/test";

const password = "demo-password-local";
const ticketId = "ticket-search-match";
const ticket = {
  id: ticketId,
  tracking_code: "TCK-MATCH-ON-SERVER",
  client_id: "client-fixture",
  conversation_id: null,
  category_id: "category-fixture",
  subject: "Consulta de prueba desde la segunda página",
  description: "Descripción devuelta por la búsqueda del servidor.",
  priority: "ALTA" as const,
  status: "EN_PROCESO" as const,
  source: "MANUAL" as const,
  assigned_advisor_id: null,
  created_at: "2026-10-01T12:00:00.000Z",
  updated_at: "2026-10-02T12:00:00.000Z",
  version: 1,
  assigned_at: null,
  resolved_at: null,
  closed_at: null,
  cancelled_at: null,
};
const firstPageTicket = {
  ...ticket,
  id: "ticket-first-page",
  tracking_code: "TCK-FIRST-PAGE",
  subject: "Solicitud que está en la primera página",
};
const faqs = [
  {
    id: "faq-balance",
    category_id: "category-digital",
    title: "Saldo de cuenta",
    question: "¿Cómo consulto el saldo de mi cuenta?",
    answer: "Puedes consultar el saldo en los canales digitales disponibles.",
    summary: "Consulta de saldo",
    tags: ["cuenta", "saldo"],
    status: "PUBLISHED",
    is_active: true,
    version: 1,
  },
  {
    id: "faq-card",
    category_id: "category-cards",
    title: "Bloqueo de tarjeta",
    question: "¿Cómo bloqueo mi tarjeta?",
    answer: "Contacta al banco por uno de sus canales de atención.",
    summary: "Bloqueo de tarjeta",
    tags: ["tarjeta", "bloqueo"],
    status: "PUBLISHED",
    is_active: true,
    version: 1,
  },
];
const categories = [
  {
    id: "category-digital",
    name: "BANCA_DIGITAL",
    description: "Canales digitales",
    is_active: true,
  },
  {
    id: "category-cards",
    name: "TARJETAS",
    description: "Tarjetas",
    is_active: true,
  },
];

async function login(page: Page) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill("cliente@demo.com");
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/app\/inicio$/);
}

function ticketPage(items: readonly (typeof ticket)[], total = items.length) {
  return {
    items,
    total,
    page: 1,
    page_size: 20,
    total_pages: Math.max(1, Math.ceil(total / 20)),
  };
}

async function fulfillReadOnly(route: Route, body: unknown) {
  expect(route.request().method()).toBe("GET");
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockTicketDetails(page: Page) {
  await page.route(`**/api/v1/tickets/${ticketId}`, (route) =>
    fulfillReadOnly(route, ticket),
  );
  await page.route(`**/api/v1/tickets/${ticketId}/comments`, (route) =>
    fulfillReadOnly(route, []),
  );
  await page.route(`**/api/v1/tickets/${ticketId}/attachments`, (route) =>
    fulfillReadOnly(route, []),
  );
  await page.route(`**/api/v1/tickets/${ticketId}/history`, (route) =>
    fulfillReadOnly(route, []),
  );
  await page.route(`**/api/v1/tickets/${ticketId}/sla`, (route) =>
    fulfillReadOnly(route, {
      status: "BREACHED",
      resolution_due_at: "2026-10-01T12:00:00.000Z",
    }),
  );
}

async function mockFaqReads(page: Page) {
  await page.route("**/api/v1/categories", (route) =>
    fulfillReadOnly(route, categories),
  );
  await page.route("**/api/v1/faqs**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    const search = (url.searchParams.get("search") ?? "").toLocaleLowerCase();
    const categoryId = url.searchParams.get("category_id");
    const filtered = faqs.filter((faq) => {
      const matchesSearch = search
        ? `${faq.question} ${faq.answer} ${faq.tags.join(" ")}`
            .toLocaleLowerCase()
            .includes(search)
        : true;
      return matchesSearch && (!categoryId || faq.category_id === categoryId);
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: filtered,
        total: filtered.length,
        page: Number(url.searchParams.get("page") ?? "1"),
        page_size: 100,
        total_pages: 1,
      }),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(width.content).toBeLessThanOrEqual(width.viewport + 1);
}

test("cliente busca en todas sus solicitudes, abre el detalle y lee sus estados", async ({
  page,
}) => {
  await login(page);
  let lastSearch: Record<string, string | null> | null = null;
  await page.route("**/api/v1/tickets/mine**", async (route) => {
    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    const search = url.searchParams.get("search");
    const status = url.searchParams.get("status");
    lastSearch = {
      search,
      status,
      page: url.searchParams.get("page"),
      page_size: url.searchParams.get("page_size"),
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        search ? ticketPage([ticket]) : ticketPage([firstPageTicket], 21),
      ),
    });
  });
  await mockTicketDetails(page);
  await page.goto("/app/solicitudes");
  await expect(
    page.getByRole("heading", { level: 1, name: "Mis solicitudes" }),
  ).toBeVisible();
  await expect(page.getByText("Página 1 de 2 · 21 resultados")).toBeVisible();

  await page
    .getByRole("textbox", { name: "Buscar solicitud" })
    .fill("TCK-MATCH-ON-SERVER");
  await expect(
    page.getByRole("link", { name: /TCK-MATCH-ON-SERVER/ }),
  ).toBeVisible();
  await expect
    .poll(() => lastSearch)
    .toEqual({
      search: "TCK-MATCH-ON-SERVER",
      status: null,
      page: "1",
      page_size: "20",
    });

  await page
    .getByRole("combobox", { name: "Estado" })
    .selectOption("EN_PROCESO");
  await expect
    .poll(() => lastSearch)
    .toEqual({
      search: "TCK-MATCH-ON-SERVER",
      status: "EN_PROCESO",
      page: "1",
      page_size: "20",
    });
  await page.getByRole("link", { name: /TCK-MATCH-ON-SERVER/ }).click();

  await expect(page).toHaveURL(new RegExp(`/app/solicitudes/${ticketId}$`));
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Consulta de prueba desde la segunda página",
    }),
  ).toBeVisible();
  await expect(page.getByText("TCK-MATCH-ON-SERVER")).toBeVisible();
  await expect(page.getByText("Prioridad")).toBeVisible();
  await expect(page.getByText("Alta", { exact: true })).toBeVisible();
  await expect(page.getByText("Estado", { exact: true })).toBeVisible();
  await expect(page.getByText("En atención", { exact: true })).toBeVisible();
  await expect(page.getByText("Vencido", { exact: true })).toBeVisible();
});

test("FAQ pública y autenticada usan búsqueda del servidor y acordeón accesible", async ({
  page,
}) => {
  const paths = ["/app/faq", "/preguntas-frecuentes"] as const;
  for (const [index, path] of paths.entries()) {
    if (index === 0) await login(page);
    await mockFaqReads(page);
    await page.goto(path);

    await expect(
      page.getByRole("textbox", { name: "Buscar preguntas frecuentes" }),
    ).toBeVisible();
    const firstQuestion = page
      .locator(".faq-list summary")
      .filter({ hasText: "¿Cómo consulto el saldo de mi cuenta?" });
    const secondQuestion = page
      .locator(".faq-list summary")
      .filter({ hasText: "¿Cómo bloqueo mi tarjeta?" });
    await expect(firstQuestion).toBeVisible();
    await expect(secondQuestion).toBeVisible();
    await expect(page.locator(".faq-list details[open]")).toHaveCount(0);

    await firstQuestion.focus();
    await expect(firstQuestion).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator(".faq-list details[open]")).toHaveCount(1);
    await secondQuestion.click();
    await expect(page.locator(".faq-list details[open]")).toHaveCount(1);
    await expect(page.locator(".faq-list details").first()).not.toHaveAttribute(
      "open",
      "",
    );

    await page
      .getByRole("textbox", { name: "Buscar preguntas frecuentes" })
      .fill("bloqueo");
    await expect(secondQuestion).toBeVisible();
    await expect(firstQuestion).toHaveCount(0);
    await page
      .getByRole("textbox", { name: "Buscar preguntas frecuentes" })
      .fill("");
    await page.getByRole("button", { name: "Tarjetas" }).click();
    await expect(secondQuestion).toBeVisible();
    await expect(firstQuestion).toHaveCount(0);
  }
});

test("las cinco pantallas del cliente no desbordan en móvil", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "comprobación de viewport móvil",
  );
  await login(page);
  await page.route("**/api/v1/tickets/mine**", (route) =>
    fulfillReadOnly(route, ticketPage([ticket])),
  );
  await mockTicketDetails(page);
  await mockFaqReads(page);

  for (const path of [
    "/app/inicio",
    "/app/solicitudes",
    `/app/solicitudes/${ticketId}`,
    "/app/faq",
    "/preguntas-frecuentes",
  ]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page);
  }
});
