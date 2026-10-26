import { expect, test, type Page, type Route } from "@playwright/test";
import type {
  Comment,
  Ticket,
  TicketHistoryEntry,
  UserRole,
} from "../../src/shared/types/domain";

const ticketId = "ticket-detail-e2e";
const clientId = "00000000-0000-4000-8000-000000000001";
const advisorId = "00000000-0000-4000-8000-000000000002";
const releaseReason = "Carga regional redistribuida";

interface MockRequest {
  readonly method: string;
  readonly path: string;
}

type RouteHandler = (route: Route) => Promise<void>;

function json(status: number, body: unknown): RouteHandler {
  return (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
}

function ticketFixture(
  overrides: Partial<Ticket> = {},
): Ticket {
  return {
    id: ticketId,
    tracking_code: "SOL-E2E-001",
    client_id: clientId,
    client_name: "María Paredes",
    conversation_id: null,
    category_id: "category-e2e",
    subject: "Consulta de prueba",
    description: "Descripción de prueba para validar el detalle.",
    priority: "MEDIA",
    status: "ASIGNADO",
    source: "MANUAL",
    assigned_advisor_id: advisorId,
    assigned_advisor_name: "Ana Torres",
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T13:00:00Z",
    version: 4,
    assigned_at: "2026-09-01T12:30:00Z",
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function commentFixture(
  id: string,
  role: string,
  name: string | null,
  content: string,
): Comment {
  return {
    id,
    ticket_id: ticketId,
    author_id: `${id}-author-id`,
    author_name: name,
    author_role: role,
    content,
    created_at: "2026-09-01T14:00:00Z",
  };
}

function historyFixture(
  id: string,
  action: string,
  overrides: Partial<TicketHistoryEntry> = {},
): TicketHistoryEntry {
  return {
    id,
    ticket_id: ticketId,
    actor_id: advisorId,
    actor_name: "Luis Rivas",
    actor_role: "SUPERVISOR",
    action,
    old_value: null,
    new_value: null,
    description: null,
    created_at: "2026-09-01T14:30:00Z",
    ...overrides,
  };
}

function pageResult<T>(items: readonly T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    page_size: 20,
    pages: 1,
    total_pages: 1,
  };
}

async function installMockApp(page: Page, role: UserRole) {
  const user = {
    id: role === "ASESOR" ? advisorId : `${role.toLowerCase()}-e2e-id`,
    full_name: role === "ASESOR" ? "Ana Torres" : "Luis Rivas",
    email: `${role.toLowerCase()}@e2e.test`,
    role,
  };
  const handlers = new Map<string, RouteHandler>();
  const requests: MockRequest[] = [];
  const interceptedMutations: string[] = [];
  const unhandledMutations: string[] = [];

  await page.addInitScript((session) => {
    window.localStorage.setItem("gnb.session.v1", JSON.stringify(session));
  }, { token: "ticket-detail-e2e-token", user });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const key = `${method} ${path}`;
    requests.push({ method, path });
    const handler = handlers.get(key);
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      interceptedMutations.push(key);
      if (!handler) unhandledMutations.push(key);
    }
    if (handler) {
      await handler(route);
      return;
    }
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "E2E_UNMOCKED", message: "Respuesta E2E no configurada." }),
    });
  });

  const respond = (method: string, path: string, handler: RouteHandler) => {
    handlers.set(`${method} ${path}`, handler);
  };
  const respondJson = (method: string, path: string, status: number, body: unknown) =>
    respond(method, path, json(status, body));
  const requestCount = (method: string, path: string) =>
    requests.filter((request) => request.method === method && request.path === path).length;

  respondJson("GET", "/api/v1/auth/me", 200, user);
  respondJson("GET", "/api/v1/notifications/unread-count", 200, { unread_count: 0 });
  respondJson("GET", "/api/v1/notifications", 200, pageResult([]));
  respondJson("GET", "/api/v1/tickets/operations", 200, pageResult([]));
  respondJson("GET", "/api/v1/users/advisors", 200, []);

  return {
    requests,
    interceptedMutations,
    unhandledMutations,
    respond,
    respondJson,
    requestCount,
  };
}

function relatedTicketRequests(requests: readonly MockRequest[]) {
  const relatedPaths = [
    `/api/v1/tickets/${ticketId}/comments`,
    `/api/v1/tickets/${ticketId}/attachments`,
    `/api/v1/tickets/${ticketId}/history`,
    `/api/v1/tickets/${ticketId}/sla`,
  ];
  return requests.filter((request) => relatedPaths.includes(request.path));
}

test("el detalle espera autorización antes de cargar conversación, adjuntos, historial y SLA", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  let releaseTicketResponse!: () => void;
  const ticketResponse = new Promise<void>((resolve) => {
    releaseTicketResponse = resolve;
  });
  mock.respond("GET", `/api/v1/tickets/${ticketId}`, async (route) => {
    await ticketResponse;
    await json(200, ticketFixture())(route);
  });
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByRole("status", { name: "Cargando contenido" })).toBeVisible();
  expect(relatedTicketRequests(mock.requests)).toEqual([]);

  releaseTicketResponse();
  await expect(page.getByRole("heading", { name: "Consulta de prueba", level: 1 })).toBeVisible();
  await expect.poll(() => relatedTicketRequests(mock.requests).length).toBe(4);
  expect(mock.unhandledMutations).toEqual([]);
});

test("un 403 directo informa acceso denegado, no consulta recursos relacionados ni repite la llamada", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 403, {
    code: "FORBIDDEN",
    message: "No puedes ver este ticket.",
  });

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "No tienes acceso a esta solicitud" })).toBeVisible();
  await expect(page.getByText("No encontramos esta solicitud")).toHaveCount(0);
  expect(relatedTicketRequests(mock.requests)).toEqual([]);
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);

  await page.getByRole("button", { name: "Volver a la bandeja" }).click();
  await expect(page).toHaveURL(/\/asesor\/bandeja$/);
  expect(relatedTicketRequests(mock.requests)).toEqual([]);
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);
  expect(mock.unhandledMutations).toEqual([]);
});

test("distingue ticket inexistente de falta de acceso", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 404, {
    code: "NOT_FOUND",
    message: "No encontrado.",
  });

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "No encontramos esta solicitud" })).toBeVisible();
  expect(relatedTicketRequests(mock.requests)).toEqual([]);
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);
});

test("distingue el error de red y no consulta recursos secundarios", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  mock.respond("GET", `/api/v1/tickets/${ticketId}`, (route) => route.abort("failed"));

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "No pudimos conectar con el servicio" })).toBeVisible();
  expect(relatedTicketRequests(mock.requests)).toEqual([]);
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);
});

test("liberar por el Asesor confirma, navega al panel y no vuelve a consultar el detalle", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  let currentTicket = ticketFixture({ status: "EN_PROCESO" });
  mock.respond("GET", `/api/v1/tickets/${ticketId}`, (route) => json(200, currentTicket)(route));
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });
  mock.respond("POST", `/api/v1/tickets/${ticketId}/release`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      reason: "Redistribución operativa validada.",
      expected_version: currentTicket.version,
    });
    currentTicket = ticketFixture({
      status: "NUEVO",
      assigned_advisor_id: null,
      assigned_advisor_name: null,
      assigned_at: null,
      version: currentTicket.version + 1,
    });
    await json(200, currentTicket)(route);
  });

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "Consulta de prueba", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historial" })).toBeVisible();
  await page.getByLabel("Motivo para liberar").fill("Redistribución operativa validada.");
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Liberar ticket" }).click();

  await expect(page).toHaveURL(/\/asesor\/panel$/);
  await expect(page.getByText("El ticket volvió a Disponible y quedó sin responsable.", { exact: true })).toBeVisible();
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);
  expect(relatedTicketRequests(mock.requests).filter((request) => request.method === "GET")).toHaveLength(4);
  expect(mock.interceptedMutations).toEqual([`POST /api/v1/tickets/${ticketId}/release`]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("el Supervisor puede seguir consultando el detalle liberado", async ({ page }) => {
  const mock = await installMockApp(page, "SUPERVISOR");
  const releasedTicket = ticketFixture({
    status: "NUEVO",
    assigned_advisor_id: null,
    assigned_advisor_name: null,
    assigned_at: null,
  });
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 200, releasedTicket);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

  await page.goto(`/supervisor/tickets/${ticketId}`);
  await expect(page.getByRole("heading", { name: "Consulta de prueba", level: 1 })).toBeVisible();
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();
  await expect(page.getByText("Sin responsable", { exact: true })).toBeVisible();
  expect(mock.requestCount("GET", `/api/v1/tickets/${ticketId}`)).toBe(1);
  expect(relatedTicketRequests(mock.requests)).toHaveLength(4);
  expect(mock.unhandledMutations).toEqual([]);
});

test("comentarios e historial muestran nombres, roles, transición y motivo una sola vez", async ({ page }) => {
  const mock = await installMockApp(page, "SUPERVISOR");
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 200, ticketFixture());
  const comments: Comment[] = [
    commentFixture("comment-client", "CLIENTE", "María Paredes", "Necesito ayuda con un cargo."),
    commentFixture("comment-advisor", "ASESOR", "Ana Torres", "Estoy revisando el caso."),
    commentFixture("comment-supervisor", "SUPERVISOR", "Luis Rivas", "Coordinamos la atención."),
  ];
  const history: TicketHistoryEntry[] = [
    historyFixture("history-status", "STATUS_CHANGED", {
      old_value: "ASIGNADO",
      new_value: "NUEVO",
      description: releaseReason,
    }),
    historyFixture("history-release", "RELEASED", {
      description: releaseReason,
    }),
    historyFixture("history-assigned", "ASSIGNED", {
      old_value: "NUEVO",
      new_value: "ASIGNADO",
      description: "Reasignación para continuar la atención.",
    }),
    historyFixture("history-first-response", "FIRST_RESPONSE_SENT", {
      description: "Respuesta inicial registrada.",
    }),
    historyFixture("history-sla", "SLA_BREACHED", {
      description: "El plazo de resolución venció.",
    }),
  ];
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, comments);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, history);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

  await page.goto(`/supervisor/tickets/${ticketId}`);
  await expect(page.getByText("Cliente · María Paredes")).toBeVisible();
  await expect(page.getByText("Asesor · Ana Torres")).toBeVisible();
  await expect(page.locator(".messages").getByText("Supervisor · Luis Rivas", { exact: true })).toBeVisible();
  await expect(page.locator(".message-avatar--cliente")).toHaveText("MP");
  await expect(page.locator(".message-avatar--asesor")).toHaveText("AT");
  await expect(page.locator(".message-avatar--supervisor")).toHaveText("LR");
  await expect(page.getByText("María Paredes", { exact: true })).toBeVisible();
  await expect(page.getByText("Ana Torres", { exact: true })).toBeVisible();

  const historyPanel = page.locator(".detail-panel").filter({
    has: page.getByRole("heading", { name: "Historial" }),
  });
  await expect(historyPanel.getByText("Por atender → Disponible")).toBeVisible();
  await expect(historyPanel.locator(".timeline li").first().locator(".history-actor")).toHaveText("Por Supervisor · Luis Rivas");
  await expect(historyPanel.getByText("Primera respuesta enviada")).toBeVisible();
  await expect(historyPanel.getByText("Plazo de atención vencido")).toBeVisible();
  await expect(historyPanel.getByText(releaseReason, { exact: true })).toHaveCount(1);
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toContain(clientId);
  expect(visibleText).not.toContain(advisorId);
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
    conversation: document.querySelector(".conversation")?.getBoundingClientRect().width ?? 0,
  }));
  expect(dimensions.conversation).toBeGreaterThan(0);
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(mock.unhandledMutations).toEqual([]);
});

test("los nombres faltantes usan etiquetas neutrales y nunca muestran UUID", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 200, ticketFixture({
    client_name: null,
    assigned_advisor_name: null,
  }));
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, [
    commentFixture("comment-client", "CLIENTE", null, "Comentario sin nombre."),
    commentFixture("comment-advisor", "ASESOR", null, "Respuesta sin nombre."),
  ]);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

  await page.goto(`/asesor/tickets/${ticketId}`);
  const ticketFacts = page.locator(".staff-ticket-detail .detail-panel dl");
  await expect(ticketFacts.locator("dd").nth(0)).toHaveText("Cliente");
  await expect(ticketFacts.locator("dd").nth(1)).toHaveText("Asesor asignado");
  await expect(page.getByText("Cliente ·", { exact: false })).toHaveCount(0);
  await expect(page.locator(".message-avatar--cliente")).toHaveText("CL");
  await expect(page.locator(".message-avatar--asesor")).toHaveText("AS");
  const visibleText = await page.locator("body").innerText();
  expect(visibleText).not.toContain(clientId);
  expect(visibleText).not.toContain(advisorId);
});

for (const terminalStatus of ["CERRADO", "CANCELADO"] as const) {
  test(`el detalle ${terminalStatus} conserva los permisos de terminal`, async ({ page }) => {
    const mock = await installMockApp(page, "ASESOR");
    mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 200, ticketFixture({ status: terminalStatus }));
    mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, []);
    mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
    mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
    mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

    await page.goto(`/asesor/tickets/${ticketId}`);
    await expect(page.getByRole("textbox", { name: "Agregar comentario" })).toBeDisabled();
    await expect(page.getByText(/las acciones operativas están deshabilitadas/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Liberar ticket" })).toHaveCount(0);
    expect(mock.unhandledMutations).toEqual([]);
  });
}

test("el Asesor no ve la acción de liberar un ticket asignado a otra persona", async ({ page }) => {
  const mock = await installMockApp(page, "ASESOR");
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}`, 200, ticketFixture({
    assigned_advisor_id: "another-advisor-id",
    assigned_advisor_name: "Otra persona",
  }));
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/comments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/attachments`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/history`, 200, []);
  mock.respondJson("GET", `/api/v1/tickets/${ticketId}/sla`, 200, { status: "ACTIVE" });

  await page.goto(`/asesor/tickets/${ticketId}`);
  await expect(page.getByText("Este ticket pertenece a otro asesor.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Liberar ticket" })).toHaveCount(0);
  expect(mock.unhandledMutations).toEqual([]);
});
