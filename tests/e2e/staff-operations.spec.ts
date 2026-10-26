import { expect, test, type APIResponse, type Page } from "@playwright/test";
import type { Ticket } from "../../src/shared/types/domain";

const apiBase = "http://localhost:8000/api/v1";
const password = "demo-password-local";

async function login(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/ingresar$/);
}

async function session(page: Page) {
  return page.evaluate(() => {
    const value = window.localStorage.getItem("gnb.session.v1");
    return value ? JSON.parse(value) as { token: string; user: { id: string } } : null;
  });
}

async function responseJson(response: APIResponse): Promise<unknown> {
  return response.ok() ? await response.json() as unknown : [];
}

function ticketPage(ticket: Ticket | null) {
  return { items: ticket ? [ticket] : [], total: ticket ? 1 : 0, page: 1, page_size: 20, pages: 1, total_pages: 1 };
}

function responseTickets(value: unknown): Ticket[] {
  if (Array.isArray(value)) return value as Ticket[];
  if (value && typeof value === "object" && "items" in value && Array.isArray(value.items)) return value.items as Ticket[];
  return [];
}

test("asesor ve solo las cuatro columnas activas en el Kanban personal", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación funcional en desktop");
  await login(page, "asesor@demo.com");
  const operationParams: URLSearchParams[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/tickets/operations")) operationParams.push(url.searchParams);
  });
  await page.goto("/asesor/panel");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Panel de atención");
  for (const column of ["Por atender", "En atención", "Esperando al cliente", "Resuelto por cerrar"]) {
    await expect(page.getByRole("heading", { name: column, level: 3 })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Cerrado" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Cancelado" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Abrir bandeja" })).toHaveAttribute("href", "/asesor/bandeja");
  const boardStatuses = [...new Set(operationParams
    .filter((params) => params.get("queue") === "assigned_to_me")
    .map((params) => params.get("status"))
    .filter((value): value is string => Boolean(value)))].sort();
  expect(boardStatuses).toEqual(["ASIGNADO", "EN_PROCESO", "PENDIENTE_CLIENTE", "RESUELTO"]);
  await page.goto("/supervisor/asignaciones");
  await expect(page).toHaveURL(/\/sin-acceso$/);
});

test("tomar un ticket sin asignar usa take, refresca la vista y abre el detalle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "flujo de toma en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  expect(advisorSession).not.toBeNull();
  const queueResponse = await page.request.get(`${apiBase}/tickets/operations?queue=unassigned&page=1&page_size=1`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { items: Ticket[] };
  test.skip(!queue.items[0], "El backend no tiene tickets sin asignar en la cola de prueba.");
  const ticket = queue.items[0];
  const supervisorLoginResponse = await page.request.post(`${apiBase}/auth/login`, {
    data: { email: "supervisor@demo.com", password },
  });
  expect(supervisorLoginResponse.ok()).toBeTruthy();
  const supervisorLogin = await supervisorLoginResponse.json() as { access_token: string };
  const supervisorHeaders = { Authorization: `Bearer ${supervisorLogin.access_token}` };
  const [commentsResponse, attachmentsResponse, historyResponse, slaResponse] = await Promise.all([
    page.request.get(`${apiBase}/tickets/${ticket.id}/comments`, { headers: supervisorHeaders }),
    page.request.get(`${apiBase}/tickets/${ticket.id}/attachments`, { headers: supervisorHeaders }),
    page.request.get(`${apiBase}/tickets/${ticket.id}/history`, { headers: supervisorHeaders }),
    page.request.get(`${apiBase}/tickets/${ticket.id}/sla`, { headers: supervisorHeaders }),
  ]);
  const related = {
    comments: await responseJson(commentsResponse),
    attachments: await responseJson(attachmentsResponse),
    history: await responseJson(historyResponse),
    sla: slaResponse.ok() ? await responseJson(slaResponse) : null,
  };
  let takeCalled = false;
  let ticketAfterTake: Ticket | null = null;
  const routePattern = new RegExp(`/api/v1/tickets/${ticket.id}(?:/.*)?$`);
  await page.route(routePattern, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path.endsWith("/take")) {
      takeCalled = true;
      expect(request.postDataJSON()).toHaveProperty("expected_version", ticket.version);
      ticketAfterTake = {
        ...ticket,
        status: "ASIGNADO",
        assigned_advisor_id: advisorSession?.user.id ?? null,
        assigned_at: new Date().toISOString(),
        version: ticket.version + 1,
      };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ticketAfterTake) });
      return;
    }
    if (request.method() === "GET" && path === `/api/v1/tickets/${ticket.id}`) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ticketAfterTake ?? ticket) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/comments")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(related.comments) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/attachments")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(related.attachments) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/history")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(related.history) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/sla")) {
      if (related.sla) await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(related.sla) });
      else await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ code: "NOT_FOUND", message: "No hay información de SLA." }) });
      return;
    }
    await route.continue();
  });

  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("response", (response) => { if (response.url().includes("/api/v1/") && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  await page.goto("/asesor/bandeja");
  await page.getByLabel("Cola").selectOption("unassigned");
  await expect(page.getByText(ticket.tracking_code)).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: ticket.tracking_code });
  await expect(row.getByRole("link")).toHaveCount(0);
  await row.getByRole("button", { name: "Tomar ticket" }).click();
  await expect(page).toHaveURL(new RegExp(`/asesor/tickets/${ticket.id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(ticket.subject);
  await expect(page.getByText("Por atender", { exact: true })).toBeVisible();
  expect(takeCalled).toBe(true);
  expect(failedResponses).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("409 al tomar aclara el conflicto y 403 explica el permiso", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación funcional en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=unassigned&page=1&page_size=1`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  const queue = await response.json() as { items: Ticket[] };
  test.skip(!queue.items[0], "El backend no tiene tickets sin asignar en la cola de prueba.");
  const ticket = queue.items[0];
  let attempts = 0;
  let queueReads = 0;
  await page.route(`**/api/v1/tickets/${ticket.id}/take`, async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "CONFLICT", message: "Ticket asignado." }) });
      return;
    }
    if (attempts === 2) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ code: "FORBIDDEN", message: "Prohibido." }) });
  });
  page.on("request", (request) => {
    if (request.url().includes("/tickets/operations") && request.url().includes("queue=unassigned")) queueReads += 1;
  });
  await page.goto("/asesor/bandeja");
  await page.getByLabel("Cola").selectOption("unassigned");
  const row = page.getByRole("row").filter({ hasText: ticket.tracking_code });
  await row.getByRole("button", { name: "Tomar ticket" }).click();
  await expect(page.getByText("Este ticket ya fue tomado por otro asesor. Actualizamos la bandeja.")).toBeVisible();
  await expect.poll(() => queueReads).toBeGreaterThanOrEqual(2);
  await row.getByRole("button", { name: "Tomar ticket" }).click();
  await expect(page.getByText(/No pudimos conectar con el servicio/i)).toBeVisible();
  await row.getByRole("button", { name: "Reintentar" }).click();
  await expect(page.getByText("No tienes permisos para tomar este ticket.")).toBeVisible();
});

test("la asignación masiva del supervisor usa assignments con versión y asesor activo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación de asignación en desktop");
  await login(page, "supervisor@demo.com");
  const supervisorSession = await session(page);
  const queueResponse = await page.request.get(`${apiBase}/tickets/operations?queue=unassigned&page=1&page_size=1`, {
    headers: { Authorization: `Bearer ${supervisorSession?.token}` },
  });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { items: Ticket[] };
  test.skip(!queue.items[0], "El backend no tiene tickets sin asignar en la cola de prueba.");
  const ticket = queue.items[0];
  const advisorsResponse = await page.request.get(`${apiBase}/users/advisors`, {
    headers: { Authorization: `Bearer ${supervisorSession?.token}` },
  });
  expect(advisorsResponse.ok()).toBeTruthy();
  const advisors = await advisorsResponse.json() as { id: string; full_name: string }[];
  test.skip(!advisors[0], "El backend no tiene asesores activos en la cola de prueba.");
  let assignmentBody: Record<string, unknown> | null = null;
  await page.route(`**/api/v1/tickets/${ticket.id}/assignments`, async (route) => {
    assignmentBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ ...ticket, assigned_advisor_id: advisors[0].id, status: "ASIGNADO", version: ticket.version + 1 }),
    });
  });
  await page.goto("/supervisor/asignaciones");
  await page.getByRole("checkbox", { name: `Seleccionar ${ticket.tracking_code}` }).check();
  await page.getByLabel("Asesor responsable").selectOption(advisors[0].id);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Asignar selección" }).click();
  await expect(page.getByText("1 tickets asignados correctamente.")).toBeVisible();
  expect(assignmentBody).toEqual({ advisor_id: advisors[0].id, expected_version: ticket.version });
});

test("el asesor libera solo su ticket con motivo y versión esperada", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación de liberación en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const queueResponse = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&page=1&page_size=1`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { items: Ticket[] };
  test.skip(!queue.items[0], "El backend no tiene tickets asignados al asesor de prueba.");
  const ticket = queue.items[0];
  let releaseBody: Record<string, unknown> | null = null;
  let detailReads = 0;
  const relatedReads: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() !== "GET") return;
    if (url.pathname === `/api/v1/tickets/${ticket.id}`) detailReads += 1;
    if (["comments", "attachments", "history", "sla"].some((resource) => url.pathname === `/api/v1/tickets/${ticket.id}/${resource}`)) {
      relatedReads.push(url.pathname);
    }
  });
  await page.route(`**/api/v1/tickets/${ticket.id}/release`, async (route) => {
    releaseBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...ticket, status: "NUEVO", assigned_advisor_id: null, assigned_at: null, version: ticket.version + 1 }),
    });
  });
  await page.goto(`/asesor/tickets/${ticket.id}`);
  await expect.poll(() => relatedReads.length).toBe(4);
  expect(detailReads).toBe(1);
  await page.getByLabel("Motivo para liberar").fill("Redistribución operativa validada.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Liberar ticket" }).click();
  await expect(page).toHaveURL(/\/asesor\/panel$/);
  await expect(page.getByText("El ticket volvió a Disponible y quedó sin responsable.", { exact: true })).toBeVisible();
  expect(detailReads).toBe(1);
  expect(relatedReads).toHaveLength(4);
  expect(releaseBody).toEqual({ reason: "Redistribución operativa validada.", expected_version: ticket.version });
});

test("el supervisor puede liberar un ticket asignado desde el detalle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación de liberación global en desktop");
  await login(page, "supervisor@demo.com");
  const supervisorSession = await session(page);
  const queueResponse = await page.request.get(`${apiBase}/tickets?status=ASIGNADO&page=1&page_size=1`, {
    headers: { Authorization: `Bearer ${supervisorSession?.token}` },
  });
  expect(queueResponse.ok()).toBeTruthy();
  const queue = await queueResponse.json() as { items: Ticket[] };
  test.skip(!queue.items[0], "El backend no tiene tickets asignados para el supervisor de prueba.");
  const ticket = queue.items[0];
  let releaseBody: Record<string, unknown> | null = null;
  await page.route(`**/api/v1/tickets/${ticket.id}/release`, async (route) => {
    releaseBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...ticket, status: "NUEVO", assigned_advisor_id: null, assigned_at: null, version: ticket.version + 1 }),
    });
  });
  await page.goto(`/supervisor/tickets/${ticket.id}`);
  await page.getByLabel("Motivo para liberar globalmente").fill("Liberación global por cobertura.");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Liberar ticket globalmente" }).click();
  await expect(page.getByText("Disponible", { exact: true })).toBeVisible();
  expect(releaseBody).toEqual({ reason: "Liberación global por cobertura.", expected_version: ticket.version });
});

test("el supervisor alterna tabla y Kanban sin incluir estados terminales y no desborda", async ({ page }, testInfo) => {
  await login(page, "supervisor@demo.com");
  await page.goto("/supervisor/cola");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cola de atención");
  await expect(page.getByRole("tab", { name: "Vista tabla" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Vista Kanban" }).click();
  const expected = ["Disponible", "Por atender", "En atención", "Esperando al cliente", "Resuelto por cerrar"];
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("heading", { level: 3, name: "Disponible" })).toBeVisible();
    for (const status of ["ASIGNADO", "EN_PROCESO", "PENDIENTE_CLIENTE", "RESUELTO"]) {
      await expect(page.locator(`.staff-kanban__column[data-status="${status}"]`)).toBeHidden();
    }
  } else {
    for (const status of expected) await expect(page.getByRole("heading", { level: 3, name: status })).toBeVisible();
  }
  await expect(page.getByRole("heading", { level: 3, name: "Cerrado" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 3, name: "Cancelado" })).toHaveCount(0);
  if (testInfo.project.name === "mobile") {
    await expect(page.getByRole("tab", { name: "Disponible" })).toHaveAttribute("aria-selected", "true");
    await expect(page.locator('.staff-kanban__column[data-status="NUEVO"]')).toBeVisible();
    await expect(page.locator('.staff-kanban__column[data-status="ASIGNADO"]')).toBeHidden();
  }
  const fit = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(fit.content).toBeLessThanOrEqual(fit.viewport + 1);
  await page.getByRole("tab", { name: "Vista tabla" }).click();
  await expect(page.locator(".staff-table")).toBeVisible();
  const tableFit = await page.evaluate(() => {
    const wrapper = document.querySelector<HTMLElement>(".staff-table-wrap");
    return {
      viewport: document.documentElement.clientWidth,
      content: document.body.scrollWidth,
      wrapperWidth: wrapper?.clientWidth ?? 0,
      tableWidth: wrapper?.scrollWidth ?? 0,
    };
  });
  expect(tableFit.content).toBeLessThanOrEqual(tableFit.viewport + 1);
  expect(tableFit.wrapperWidth).toBeLessThanOrEqual(tableFit.viewport + 1);
  if (testInfo.project.name === "mobile") expect(tableFit.tableWidth).toBeGreaterThan(tableFit.wrapperWidth);
});

test("el filtro de estado selecciona y muestra la columna correspondiente en Kanban móvil", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "regresión del selector móvil");
  await login(page, "supervisor@demo.com");
  await page.goto("/supervisor/cola");
  await page.getByText("Filtros de la cola", { exact: true }).click();
  await page.getByLabel("Estado").selectOption("ASIGNADO");
  await page.getByText("Cerrar filtros", { exact: true }).click();
  await page.getByRole("tab", { name: "Vista Kanban" }).click();

  await expect(page.getByRole("tab", { name: "Por atender" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".staff-kanban")).toHaveAttribute("data-mobile-status", "ASIGNADO");
  await expect(page.locator('.staff-kanban__column[data-status="ASIGNADO"]')).toBeVisible();
});

test("el Kanban del asesor identifica al responsable y ofrece controles accesibles de movimiento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "movimiento por arrastre en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&status=ASIGNADO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  const ticket = (await response.json() as { items: Ticket[] }).items[0];
  test.skip(!ticket, "El backend no tiene tickets Por atender para el asesor de prueba.");

  await page.goto("/asesor/panel");
  const card = page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: ticket.tracking_code });
  await expect(card.getByText("A tu cargo", { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: `Arrastrar ${ticket.tracking_code}` })).toHaveAttribute("draggable", "true");
  await expect(card.getByLabel(`Cambiar estado para ${ticket.tracking_code}`)).toBeVisible();
});

test("el Kanban del Supervisor muestra el asesor real y distingue tickets sin asignar", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "etiquetas de responsable en desktop");
  await login(page, "supervisor@demo.com");
  const supervisorSession = await session(page);
  const headers = { Authorization: `Bearer ${supervisorSession?.token}` };
  const [assignedResponse, unassignedResponse, advisorsResponse] = await Promise.all([
    page.request.get(`${apiBase}/tickets?status=ASIGNADO&page=1&page_size=20`, { headers }),
    page.request.get(`${apiBase}/tickets/operations?queue=unassigned&page=1&page_size=20`, { headers }),
    page.request.get(`${apiBase}/users/advisors`, { headers }),
  ]);
  expect(assignedResponse.ok()).toBeTruthy();
  expect(unassignedResponse.ok()).toBeTruthy();
  expect(advisorsResponse.ok()).toBeTruthy();
  const assignedTicket = responseTickets(await assignedResponse.json()).find((item) => item.assigned_advisor_id !== null);
  const unassignedTicket = (await unassignedResponse.json() as { items: Ticket[] }).items.find((item) => item.status === "NUEVO");
  const advisors = await advisorsResponse.json() as { id: string; full_name: string }[];
  test.skip(!assignedTicket || !unassignedTicket, "Se requieren tickets asignados y sin asignar en el backend de prueba.");
  if (!assignedTicket || !unassignedTicket) return;
  const ownerLabel = advisors.find(({ id }) => id === assignedTicket.assigned_advisor_id)?.full_name ?? "Asesor asignado";
  await page.route("**/api/v1/tickets?**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    if (route.request().method() !== "GET" || !status) return route.continue();
    const value = status === "ASIGNADO" ? [assignedTicket] : status === "NUEVO" ? [unassignedTicket] : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
  });
  await page.goto("/supervisor/cola");
  await page.getByRole("tab", { name: "Vista Kanban" }).click();
  const assignedCard = page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: assignedTicket.tracking_code });
  const unassignedCard = page.locator('.staff-kanban__column[data-status="NUEVO"] .staff-ticket-card').filter({ hasText: unassignedTicket.tracking_code });
  await expect(assignedCard.locator(".staff-ticket-card__owner")).toHaveText(ownerLabel);
  await expect(unassignedCard.locator(".staff-ticket-card__owner")).toHaveText("Sin asignar");
});

test("el movimiento ordinario del asesor es inmediato y maneja expected_version, conflictos y reintentos", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "movimiento mediante drag and drop en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&status=ASIGNADO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  let currentTicket = (await response.json() as { items: Ticket[] }).items[0];
  test.skip(!currentTicket, "El backend no tiene tickets Por atender para el asesor de prueba.");
  let mutationAttempts = 0;
  const mutationBodies: unknown[] = [];
  await page.route("**/api/v1/tickets/operations**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("queue") !== "assigned_to_me" || !url.searchParams.has("status")) return route.continue();
    const visible = currentTicket.status === url.searchParams.get("status") && currentTicket.assigned_advisor_id === advisorSession?.user.id;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ticketPage(visible ? currentTicket : null)) });
  });
  await page.route(`**/api/v1/tickets/${currentTicket.id}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    mutationAttempts += 1;
    mutationBodies.push(route.request().postDataJSON());
    if (mutationAttempts === 1) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ code: "CONFLICT", message: "Ticket actualizado." }) });
      return;
    }
    if (mutationAttempts === 2) {
      await route.abort("failed");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 800));
    currentTicket = { ...currentTicket, status: "EN_PROCESO", version: currentTicket.version + 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket) });
  });
  await page.goto("/asesor/panel");
  const sourceColumn = page.locator('.staff-kanban__column[data-status="ASIGNADO"]');
  const card = sourceColumn.locator(".staff-ticket-card").filter({ hasText: currentTicket.tracking_code });
  const dragHandle = card.getByRole("button", { name: `Arrastrar ${currentTicket.tracking_code}` });
  const targetColumn = page.locator('.staff-kanban__column[data-status="EN_PROCESO"]');

  await dragHandle.dragTo(targetColumn);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("El ticket cambió en paralelo. Actualizamos el tablero; vuelve a elegir el movimiento.")).toBeVisible();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: `Arrastrar ${currentTicket.tracking_code}` }).dragTo(targetColumn);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card.getByRole("alert")).toContainText("No pudimos conectar con el servicio");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Reintentar" }).click();
  await expect(card).toHaveAttribute("aria-busy", "true");
  await expect(card.getByText("Actualizando estado…")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('.staff-kanban__column[data-status="EN_PROCESO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code })).toBeVisible();
  expect(mutationAttempts).toBe(3);
  expect(mutationBodies).toEqual([
    { status: "EN_PROCESO", expected_version: currentTicket.version - 1 },
    { status: "EN_PROCESO", expected_version: currentTicket.version - 1 },
    { status: "EN_PROCESO", expected_version: currentTicket.version - 1 },
  ]);
});

test("el Kanban bloquea transiciones inválidas sin enviar mutaciones", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "validación del drag and drop en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&status=ASIGNADO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  const ticket = (await response.json() as { items: Ticket[] }).items[0];
  test.skip(!ticket, "El backend no tiene tickets Por atender para el asesor de prueba.");
  let writes = 0;
  await page.route(`**/api/v1/tickets/${ticket.id}/**`, async (route) => {
    if (route.request().method() === "POST") writes += 1;
    await route.continue();
  });
  await page.goto("/asesor/panel");
  const card = page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: ticket.tracking_code });
  const dragHandle = card.getByRole("button", { name: `Arrastrar ${ticket.tracking_code}` });
  const target = page.locator('.staff-kanban__column[data-status="RESUELTO"]');
  const beginDragOver = async (destination: ReturnType<typeof page.locator>) => {
    await dragHandle.evaluate((element) => {
      const transfer = new DataTransfer();
      (window as typeof window & { kanbanTestTransfer?: DataTransfer }).kanbanTestTransfer = transfer;
      element.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    });
    await destination.evaluate((element) => {
      const transfer = (window as typeof window & { kanbanTestTransfer?: DataTransfer }).kanbanTestTransfer;
      element.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
  };
  const dropOn = async (destination: ReturnType<typeof page.locator>) => {
    await destination.evaluate((element) => {
      const transfer = (window as typeof window & { kanbanTestTransfer?: DataTransfer }).kanbanTestTransfer;
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    });
  };
  await beginDragOver(target);
  await expect(target).toHaveAttribute("data-drop-state", "invalid");
  await dropOn(target);
  await expect(page.locator(".staff-kanban-feedback")).toContainText("No se permite mover de Por atender a Resuelto por cerrar.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(card).toBeVisible();
  const source = page.locator('.staff-kanban__column[data-status="ASIGNADO"]');
  await beginDragOver(source);
  await expect(source).toHaveAttribute("data-drop-state", "invalid");
  await dropOn(source);
  await expect(page.locator(".staff-kanban-feedback")).toContainText("El ticket ya está en esa columna.");
  await expect(card).toBeVisible();
  expect(writes).toBe(0);
});

test("Supervisor asigna NUEVO a ASIGNADO usando el endpoint de asignación y versionado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "flujo de asignación en desktop");
  await login(page, "supervisor@demo.com");
  const supervisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=unassigned&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${supervisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  const candidateTicket = (await response.json() as { items: Ticket[] }).items.find((item) => item.status === "NUEVO");
  test.skip(!candidateTicket, "El backend no tiene tickets NUEVO sin asignar para la prueba.");
  if (!candidateTicket) return;
  let currentTicket: Ticket = candidateTicket;
  let assignmentBody: unknown;
  await page.route("**/api/v1/tickets?**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    if (route.request().method() !== "GET" || !status) return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket.status === status ? [currentTicket] : []) });
  });
  await page.route(`**/api/v1/tickets/${currentTicket.id}/assignments`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    assignmentBody = route.request().postDataJSON();
    const body = assignmentBody as { advisor_id: string; expected_version: number };
    currentTicket = { ...currentTicket, status: "ASIGNADO", assigned_advisor_id: body.advisor_id, assigned_at: new Date().toISOString(), version: currentTicket.version + 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket) });
  });
  await page.goto("/supervisor/cola");
  await page.getByRole("tab", { name: "Vista Kanban" }).click();
  const card = page.locator('.staff-kanban__column[data-status="NUEVO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code });
  await card.getByRole("button", { name: `Arrastrar ${currentTicket.tracking_code}` }).dragTo(page.locator('.staff-kanban__column[data-status="ASIGNADO"]'));
  const dialog = page.getByRole("dialog");
  const advisorSelect = dialog.getByLabel("Asesor activo");
  const selectedAdvisor = await advisorSelect.locator("option").nth(1).getAttribute("value");
  expect(selectedAdvisor).toBeTruthy();
  await advisorSelect.selectOption(selectedAdvisor ?? "");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code })).toBeVisible();
  expect(assignmentBody).toEqual({ advisor_id: selectedAdvisor, expected_version: currentTicket.version - 1 });
});

test("Supervisor libera a NUEVO con motivo y elimina al responsable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "flujo de liberación en desktop");
  await login(page, "supervisor@demo.com");
  const supervisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets?status=ASIGNADO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${supervisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  const candidateTicket = responseTickets(await response.json()).find((item) => item.assigned_advisor_id !== null);
  test.skip(!candidateTicket, "El backend no tiene tickets asignados para la prueba.");
  if (!candidateTicket) return;
  let currentTicket: Ticket = candidateTicket;
  let releaseBody: unknown;
  await page.route("**/api/v1/tickets?**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    if (route.request().method() !== "GET" || !status) return route.continue();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket.status === status ? [currentTicket] : []) });
  });
  await page.route(`**/api/v1/tickets/${currentTicket.id}/release`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    releaseBody = route.request().postDataJSON();
    currentTicket = { ...currentTicket, status: "NUEVO", assigned_advisor_id: null, assigned_at: null, version: currentTicket.version + 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket) });
  });
  await page.goto("/supervisor/cola");
  await page.getByRole("tab", { name: "Vista Kanban" }).click();
  const card = page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code });
  await card.getByRole("button", { name: `Arrastrar ${currentTicket.tracking_code}` }).dragTo(page.locator('.staff-kanban__column[data-status="NUEVO"]'));
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel("Motivo de liberación").fill("Redistribución de carga");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  const newCard = page.locator('.staff-kanban__column[data-status="NUEVO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code });
  await expect(newCard).toBeVisible();
  await expect(newCard.getByText("Sin asignar", { exact: true })).toBeVisible();
  expect(releaseBody).toEqual({ reason: "Redistribución de carga", expected_version: currentTicket.version - 1 });
});

test("reabrir un ticket RESUELTO mantiene diálogo y envía motivo con expected_version", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "acción de reapertura del Asesor en desktop");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&status=RESUELTO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  let currentTicket = (await response.json() as { items: Ticket[] }).items[0];
  test.skip(!currentTicket, "El backend no tiene tickets RESUELTO para el asesor de prueba.");
  let statusBody: unknown;
  await page.route("**/api/v1/tickets/operations**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("queue") !== "assigned_to_me" || !url.searchParams.has("status")) return route.continue();
    const visible = currentTicket.status === url.searchParams.get("status") && currentTicket.assigned_advisor_id === advisorSession?.user.id;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ticketPage(visible ? currentTicket : null)) });
  });
  await page.route(`**/api/v1/tickets/${currentTicket.id}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    statusBody = route.request().postDataJSON();
    currentTicket = { ...currentTicket, status: "EN_PROCESO", version: currentTicket.version + 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket) });
  });
  await page.goto("/asesor/panel");
  const card = page.locator('.staff-kanban__column[data-status="RESUELTO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code });
  await card.getByLabel(`Cambiar estado para ${currentTicket.tracking_code}`).selectOption("EN_PROCESO");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Motivo de reanudación")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirmar" })).toBeDisabled();
  await dialog.getByLabel("Motivo de reanudación").fill("Continuar seguimiento");
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.locator('.staff-kanban__column[data-status="EN_PROCESO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code })).toBeVisible();
  expect(statusBody).toEqual({ status: "EN_PROCESO", reason: "Continuar seguimiento", expected_version: currentTicket.version - 1 });
});

test("el selector accesible permite mover en mobile con la misma mutación versionada", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "alternativa accesible en dispositivos móviles");
  await login(page, "asesor@demo.com");
  const advisorSession = await session(page);
  const response = await page.request.get(`${apiBase}/tickets/operations?queue=assigned_to_me&status=ASIGNADO&page=1&page_size=20`, {
    headers: { Authorization: `Bearer ${advisorSession?.token}` },
  });
  expect(response.ok()).toBeTruthy();
  let currentTicket = (await response.json() as { items: Ticket[] }).items[0];
  test.skip(!currentTicket, "El backend no tiene tickets Por atender para la prueba.");
  let sentVersion: unknown;
  await page.route("**/api/v1/tickets/operations**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("queue") !== "assigned_to_me" || !url.searchParams.has("status")) return route.continue();
    const visible = currentTicket.status === url.searchParams.get("status") && currentTicket.assigned_advisor_id === advisorSession?.user.id;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(ticketPage(visible ? currentTicket : null)) });
  });
  await page.route(`**/api/v1/tickets/${currentTicket.id}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = route.request().postDataJSON() as { expected_version?: number };
    sentVersion = body.expected_version;
    currentTicket = { ...currentTicket, status: "EN_PROCESO", version: currentTicket.version + 1 };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(currentTicket) });
  });
  await page.goto("/asesor/panel");
  const card = page.locator('.staff-kanban__column[data-status="ASIGNADO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code });
  await card.getByLabel(`Cambiar estado para ${currentTicket.tracking_code}`).selectOption("EN_PROCESO");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('.staff-kanban__column[data-status="EN_PROCESO"] .staff-ticket-card').filter({ hasText: currentTicket.tracking_code })).toBeVisible();
  expect(sentVersion).toBe(currentTicket.version - 1);
});

test("el historial del asesor mantiene filtros y paginación acotada", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "comprobación funcional en desktop");
  await login(page, "asesor@demo.com");
  const historyStatuses = new Set<string>();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/v1/tickets" && url.searchParams.has("status")) historyStatuses.add(url.searchParams.get("status") ?? "");
  });
  await page.goto("/asesor/historial");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Historial de atención");
  await expect(page.getByLabel("Periodo")).toHaveValue("7d");
  await expect(page.getByLabel("Estado")).toHaveValue("");
  await expect.poll(() => [...historyStatuses].sort()).toEqual(["CANCELADO", "CERRADO"]);
  await expect(page.getByLabel("Estado").getByRole("option", { name: "Resueltos pendientes de cierre" })).toHaveCount(1);
  await expect(page.locator('.staff-kanban__column[data-status="RESUELTO"]')).toHaveCount(0);
  await page.getByLabel("Estado").selectOption("CERRADO");
  await expect(page.getByLabel("Estado")).toHaveValue("CERRADO");
  await page.getByLabel("Estado").selectOption("RESUELTO");
  await expect(page.getByLabel("Estado")).toHaveValue("RESUELTO");
  await expect.poll(() => historyStatuses.has("RESUELTO")).toBe(true);
  const fit = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(fit.content).toBeLessThanOrEqual(fit.viewport + 1);
});
