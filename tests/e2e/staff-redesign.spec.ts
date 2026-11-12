import { expect, test, type Page, type Route } from "@playwright/test";
import type { Attachment, Comment, Ticket, TicketHistoryEntry, UserRole } from "../../src/shared/types/domain";

const advisorId = "00000000-0000-4000-8000-000000000002";
const supervisorId = "00000000-0000-4000-8000-000000000003";
const newTicketId = "ticket-available-e2e";
const assignedTicketId = "ticket-assigned-e2e";
const clientId = "00000000-0000-4000-8000-000000000001";

function ticketFixture(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: assignedTicketId,
    tracking_code: "GNB-E2E-101",
    client_id: clientId,
    client_name: "María Paredes",
    conversation_id: null,
    category_id: "category-e2e",
    subject: "Revisión de una operación",
    description: "El cliente solicita revisar una operación registrada en su cuenta.",
    priority: "ALTA",
    status: "ASIGNADO",
    source: "MANUAL",
    assigned_advisor_id: advisorId,
    assigned_advisor_name: "Ana Torres",
    created_at: "2026-10-30T12:00:00Z",
    updated_at: "2026-11-05T13:00:00Z",
    version: 4,
    assigned_at: "2026-10-30T12:30:00Z",
    resolved_at: null,
    closed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

function pageResult<T>(items: readonly T[], page = 1, pageSize = 6, total = items.length) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return { items, total, page, page_size: pageSize, pages, total_pages: pages };
}

function commentFixture(id: string, content: string): Comment {
  return {
    id,
    ticket_id: assignedTicketId,
    author_id: advisorId,
    author_name: "Ana Torres",
    author_role: "ASESOR",
    content,
    created_at: "2026-11-06T12:00:00Z",
  };
}

function attachmentFixture(): Attachment {
  return {
    id: "attachment-e2e",
    ticket_id: assignedTicketId,
    comment_id: null,
    uploaded_by_user_id: advisorId,
    original_filename: "resumen.pdf",
    mime_type_declared: "application/pdf",
    mime_type_detected: "application/pdf",
    file_size: 2048,
    status: "AVAILABLE",
    created_at: "2026-11-05T13:20:00Z",
    deleted_at: null,
  };
}

function historyFixture(action: string, description: string | null = null): TicketHistoryEntry {
  return {
    id: `history-${action}`,
    ticket_id: assignedTicketId,
    actor_id: advisorId,
    actor_name: "Ana Torres",
    actor_role: "ASESOR",
    action,
    old_value: null,
    new_value: null,
    description,
    created_at: "2026-11-05T13:30:00Z",
  };
}

async function installMockApp(page: Page, role: UserRole) {
  const user = {
    id: role === "ASESOR" ? advisorId : supervisorId,
    full_name: role === "ASESOR" ? "Ana Torres" : "Luis Rivas",
    email: `${role.toLowerCase()}@e2e.test`,
    role,
  };
  const requests: { method: string; path: string; search: string }[] = [];
  const mutations: { method: string; path: string; body: unknown }[] = [];
  const unhandledMutations: string[] = [];
  let available = ticketFixture({
    id: newTicketId,
    tracking_code: "GNB-E2E-001",
    client_name: "Noelia Ramos",
    subject: "Consultar una transferencia",
    priority: "URGENTE",
    status: "NUEVO",
    assigned_advisor_id: null,
    assigned_advisor_name: null,
    assigned_at: null,
    version: 2,
  });
  let assigned = ticketFixture();
  let detailTicket = ticketFixture();
  const updateTicketMirrors = (updated: Ticket) => {
    if (available.id === updated.id) available = updated;
    if (assigned.id === updated.id) assigned = updated;
    if (detailTicket.id === updated.id) detailTicket = updated;
  };
  let comments: Comment[] = [];
  let history: TicketHistoryEntry[] = [historyFixture("CREATED", "Solicitud recibida.")];
  let commentPostCount = 0;

  await page.addInitScript((session) => {
    window.localStorage.setItem("gnb.session.v1", JSON.stringify(session));
  }, { token: "staff-redesign-e2e-token", user });

  await page.route("**/api/v1/**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    requests.push({ method, path, search: url.search });
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      let body: unknown = undefined;
      try { body = request.postDataJSON(); } catch { /* multipart requests have no JSON body */ }
      mutations.push({ method, path, body });
    }
    const fulfill = (status: number, body: unknown) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (method === "GET" && path === "/api/v1/auth/me") return fulfill(200, user);
    if (method === "GET" && path === "/api/v1/notifications/unread-count") return fulfill(200, { unread_count: 0 });
    if (method === "GET" && path === "/api/v1/notifications") return fulfill(200, pageResult([]));
    if (method === "GET" && path === "/api/v1/users/advisors") return fulfill(200, [
      { id: advisorId, full_name: "Ana Torres", email: "ana@e2e.test", role: "ASESOR" },
      { id: "00000000-0000-4000-8000-000000000004", full_name: "Clara Ríos", email: "clara@e2e.test", role: "ASESOR" },
    ]);
    if (method === "GET" && path === "/api/v1/categories") return fulfill(200, [{ id: "category-e2e", name: "Operaciones", is_active: true }]);

    if (path === "/api/v1/tickets/operations" && method === "GET") {
      const status = url.searchParams.get("status");
      const queue = url.searchParams.get("queue");
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const requestedSize = Number(url.searchParams.get("page_size") ?? 6);
      const items = queue === "unassigned"
        ? [available, assigned].filter((item) => item.status === "NUEVO" && item.assigned_advisor_id === null)
        : [assigned].filter((item) =>
            item.assigned_advisor_id === (role === "ASESOR" ? advisorId : item.assigned_advisor_id) &&
            (!status || item.status === status) &&
            (queue !== "assigned_to_me" || item.assigned_advisor_id === advisorId),
          );
      const search = url.searchParams.get("search")?.toLocaleLowerCase("es-PE");
      const filtered = items.filter((item) => !search || `${item.tracking_code} ${item.subject} ${item.client_name ?? ""}`.toLocaleLowerCase("es-PE").includes(search));
      return fulfill(200, pageResult(filtered, pageNumber, requestedSize));
    }

    if (path === "/api/v1/tickets" && method === "GET") {
      const status = url.searchParams.get("status");
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const requestedSize = Number(url.searchParams.get("page_size") ?? 20);
      if (status === "CERRADO" || status === "CANCELADO") {
        const closed = ticketFixture({ id: "ticket-closed-e2e", tracking_code: "GNB-E2E-C01", status: "CERRADO", closed_at: "2026-11-05T10:00:00Z" });
        const cancelled = ticketFixture({ id: "ticket-cancelled-e2e", tracking_code: "GNB-E2E-X01", status: "CANCELADO", cancelled_at: "2026-11-05T11:00:00Z" });
        return fulfill(200, pageResult(status === "CERRADO" ? [closed] : [cancelled], pageNumber, requestedSize));
      }
      const items = [available, assigned].filter((item) => item.status === status);
      return fulfill(200, pageResult(items, pageNumber, requestedSize));
    }

    const detailMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)$/);
    if (detailMatch && method === "GET") {
      if (detailMatch[1] === assignedTicketId) return fulfill(200, detailTicket);
      if (detailMatch[1] === "ticket-closed-e2e") return fulfill(200, ticketFixture({ id: "ticket-closed-e2e", tracking_code: "GNB-E2E-C01", status: "CERRADO", closed_at: "2026-11-05T10:00:00Z" }));
      if (detailMatch[1] === "ticket-cancelled-e2e") return fulfill(200, ticketFixture({ id: "ticket-cancelled-e2e", tracking_code: "GNB-E2E-X01", status: "CANCELADO", cancelled_at: "2026-11-05T11:00:00Z" }));
    }
    if (path === `/api/v1/tickets/${assignedTicketId}/comments` && method === "GET") return fulfill(200, comments);
    if (path === `/api/v1/tickets/${assignedTicketId}/comments` && method === "POST") {
      const body = request.postDataJSON() as { content: string; expected_version: number };
      if (body.expected_version !== detailTicket.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      commentPostCount += 1;
      const created = commentFixture(`comment-${commentPostCount}`, body.content);
      comments = [...comments, created];
      detailTicket = { ...detailTicket, version: detailTicket.version + 1, updated_at: created.created_at };
      history = [...history, historyFixture("COMMENT_ADDED", "Comentario agregado.")];
      return fulfill(201, created);
    }
    if (path === `/api/v1/tickets/${assignedTicketId}/attachments` && method === "GET") return fulfill(200, [attachmentFixture()]);
    if (path === `/api/v1/tickets/${assignedTicketId}/history` && method === "GET") return fulfill(200, history);
    if (/^\/api\/v1\/tickets\/[^/]+\/sla$/.test(path) && method === "GET") {
      return fulfill(200, {
        ticket_id: path.split("/")[4],
        status: "ACTIVE",
        first_response_due_at: "2026-11-07T15:00:00Z",
        resolution_due_at: "2026-11-10T15:00:00Z",
        paused_at: null,
      });
    }

    const takeMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/take$/);
    if (method === "POST" && takeMatch) {
      const id = takeMatch[1];
      const body = request.postDataJSON() as { expected_version: number };
      if (id !== available.id || body.expected_version !== available.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      available = { ...available, status: "ASIGNADO", assigned_advisor_id: advisorId, assigned_advisor_name: "Ana Torres", assigned_at: "2026-11-06T12:00:00Z", version: available.version + 1 };
      assigned = available;
      return fulfill(200, available);
    }

    const assignMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/assignments$/);
    if (method === "POST" && assignMatch) {
      const id = assignMatch[1];
      const body = request.postDataJSON() as { advisor_id: string; expected_version: number };
      const current = id === available.id ? available : assigned;
      if (body.expected_version !== current.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      const updated = { ...current, status: current.status === "NUEVO" ? "ASIGNADO" as const : current.status, assigned_advisor_id: body.advisor_id, assigned_advisor_name: body.advisor_id === "00000000-0000-4000-8000-000000000004" ? "Clara Ríos" : "Ana Torres", assigned_at: "2026-11-06T12:00:00Z", version: current.version + 1 };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const releaseMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/release$/);
    if (method === "POST" && releaseMatch) {
      const id = releaseMatch[1];
      const body = request.postDataJSON() as { reason: string; expected_version: number };
      const current = id === available.id ? available : id === detailTicket.id ? detailTicket : assigned;
      if (body.expected_version !== current.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      const updated: Ticket = {
        ...current,
        status: "NUEVO",
        assigned_advisor_id: null,
        assigned_advisor_name: null,
        assigned_at: null,
        version: current.version + 1,
      };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const statusMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/status$/);
    if (method === "POST" && statusMatch) {
      const body = request.postDataJSON() as { status: Ticket["status"]; expected_version: number };
      if (body.expected_version !== detailTicket.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      const updated = { ...detailTicket, status: body.status, version: detailTicket.version + 1, updated_at: "2026-11-06T12:05:00Z" };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const closeMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/close$/);
    if (method === "POST" && closeMatch) {
      const body = request.postDataJSON() as { reason?: string };
      void body;
      const updated: Ticket = { ...detailTicket, status: "CERRADO", closed_at: "2026-11-06T12:05:00Z", version: detailTicket.version + 1 };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const cancelMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/cancel$/);
    if (method === "POST" && cancelMatch) {
      const body = request.postDataJSON() as { reason: string; expected_version: number };
      if (body.expected_version !== detailTicket.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      const updated = { ...detailTicket, status: "CANCELADO" as const, cancelled_at: "2026-11-06T12:05:00Z", version: detailTicket.version + 1 };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const reopenMatch = path.match(/^\/api\/v1\/tickets\/([^/]+)\/reopen$/);
    if (method === "POST" && reopenMatch) {
      const body = request.postDataJSON() as { reason: string; expected_version: number };
      if (body.expected_version !== detailTicket.version) return fulfill(409, { code: "CONFLICT", message: "Version conflict." });
      const updated = { ...detailTicket, status: "EN_PROCESO" as const, resolved_at: null, version: detailTicket.version + 1 };
      updateTicketMirrors(updated);
      return fulfill(200, updated);
    }

    const isMutation = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
    if (isMutation) unhandledMutations.push(`${method} ${path}`);
    return fulfill(200, isMutation ? {} : []);
  });

  return {
    requests,
    mutations,
    unhandledMutations,
    get available() { return available; },
    get assigned() { return assigned; },
    get detailTicket() { return detailTicket; },
    get comments() { return comments; },
    get commentPostCount() { return commentPostCount; },
    setDetailTicket(value: Ticket) { detailTicket = value; updateTicketMirrors(value); },
    setAssignedTicket(value: Ticket) { assigned = value; updateTicketMirrors(value); },
    setAvailableTicket(value: Ticket) { available = value; updateTicketMirrors(value); },
  };
}

async function dragCardWithMouse(page: Page, sourceSelector: string, targetSelector: string) {
  const source = page.locator(sourceSelector).first();
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await page.locator(targetSelector).boundingBox();
  if (!sourceBox || !targetBox) throw new Error("No se encontró la tarjeta o etapa del arrastre.");
  const startX = sourceBox.x + Math.min(32, sourceBox.width / 3);
  const startY = sourceBox.y + 10;
  const viewportHeight = page.viewportSize()?.height ?? 900;
  const targetY = Math.max(
    targetBox.y + 18,
    Math.min(startY, targetBox.y + targetBox.height - 18, viewportHeight - 18),
  );
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetY, { steps: 12 });
  await page.mouse.up();
}

async function touchGesture(page: Page, startX: number, startY: number, endX: number, endY: number, holdMs = 0) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: startX, y: startY, id: 1, radiusX: 2, radiusY: 2, force: 1 }],
    });
    if (holdMs > 0) await page.waitForTimeout(holdMs);
    for (let step = 1; step <= 16; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{
          x: startX + (endX - startX) * step / 16,
          y: startY + (endY - startY) * step / 16,
          id: 1,
          radiusX: 2,
          radiusY: 2,
          force: 1,
        }],
      });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await session.detach();
  }
}

async function dragCardWithTouch(page: Page, sourceSelector: string, targetSelector: string) {
  const source = page.locator(sourceSelector).first();
  const target = page.locator(targetSelector).first();
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("No se encontró la tarjeta o etapa del arrastre táctil.");
  const startX = sourceBox.x + Math.min(32, sourceBox.width / 3);
  const startY = sourceBox.y + Math.min(64, sourceBox.height / 3);
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;
  await touchGesture(page, startX, startY, endX, endY, 400);
}

test("Asesor toma un ticket disponible con take y expected_version", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "flujo de toma verificado una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  await expect(page.getByRole("heading", { name: "Kanban de atención" })).toBeVisible();
  await expect(page.locator("#staff-stage-tab-NUEVO")).toContainText("1");
  await expect(page.getByRole("heading", { name: "Consultar una transferencia" })).toBeVisible();
  expect(mock.requests.some((item) => item.method === "GET" && item.path === `/api/v1/tickets/${newTicketId}`)).toBe(false);

  await page.getByRole("button", { name: "Tomar ticket" }).click();
  await expect.poll(() => mock.mutations.find((item) => item.path === `/api/v1/tickets/${newTicketId}/take`)?.body).toEqual({ expected_version: 2 });
  await expect(page.locator("#staff-stage-tab-NUEVO")).toContainText("0");
  await expect(page.locator("#staff-stage-panel-ASIGNADO").getByRole("heading", { name: "Consultar una transferencia" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir detalle GNB-E2E-001" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Asesor toma por touch desde el botón sin iniciar un arrastre", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "toque de botón verificado en móvil");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  await page.getByRole("button", { name: "Tomar ticket" }).tap();
  await expect.poll(() => mock.mutations.find((item) => item.path === `/api/v1/tickets/${newTicketId}/take`)?.body).toEqual({ expected_version: 2 });
  expect(mock.available.status).toBe("ASIGNADO");
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor inicia en Kanban y asigna usando la ruta versionada", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "flujo de asignación verificado una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");

  await page.goto("/supervisor/cola");
  await expect(page.getByRole("heading", { name: "Cola de atención" })).toBeVisible();
  await expect(page.locator("#staff-stage-tab-NUEVO")).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Asignar", exact: true }).click();
  const assignDialog = page.getByRole("dialog", { name: "Asignar ticket" });
  await assignDialog.getByLabel("Asesor activo").selectOption(advisorId);
  await assignDialog.getByRole("button", { name: "Asignar", exact: true }).click();
  await expect.poll(() => mock.available.status).toBe("ASIGNADO");
  const assignment = mock.mutations.find((item) => item.path === `/api/v1/tickets/${newTicketId}/assignments`);
  expect(assignment?.body).toEqual({ advisor_id: advisorId, expected_version: 2 });
  await expect(page.locator("#staff-stage-tab-NUEVO")).toContainText("0");
  await expect(page.locator("#staff-stage-panel-ASIGNADO").getByRole("heading", { name: "Consultar una transferencia" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor reasigna en RESUELTO y libera ese estado con motivo", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "reasignación y liberación verificadas una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  mock.setAssignedTicket(ticketFixture({ status: "RESUELTO", resolved_at: "2026-11-05T15:00:00Z", version: 7 }));

  await page.goto("/supervisor/cola");
  await page.getByLabel("Mover a… para GNB-E2E-101").selectOption("ASIGNADO");
  const reassignDialog = page.getByRole("dialog", { name: "Reasignar responsable" });
  await reassignDialog.getByLabel("Asesor activo").selectOption("00000000-0000-4000-8000-000000000004");
  await reassignDialog.getByRole("button", { name: "Reasignar", exact: true }).click();
  await expect.poll(() => mock.assigned.status).toBe("RESUELTO");
  expect(mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/assignments`)?.body).toEqual({ advisor_id: "00000000-0000-4000-8000-000000000004", expected_version: 7 });

  await page.getByLabel("Mover a… para GNB-E2E-101").selectOption("NUEVO");
  const releaseDialog = page.getByRole("dialog", { name: "Liberar ticket" });
  await releaseDialog.getByLabel("Motivo de liberación").fill("Revisión para otra cola.");
  await releaseDialog.getByRole("button", { name: "Liberar ticket", exact: true }).click();
  await expect.poll(() => mock.assigned.status).toBe("NUEVO");
  expect(mock.assigned.assigned_advisor_id).toBeNull();
  expect(mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/release`)?.body).toEqual({ reason: "Revisión para otra cola.", expected_version: 8 });
  expect(mock.unhandledMutations).toEqual([]);
});

test("Asesor responsable libera un ticket con motivo y versión actual", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "liberación del asesor verificada una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  mock.setAssignedTicket(ticketFixture({ status: "RESUELTO", resolved_at: "2026-11-05T15:00:00Z", version: 11 }));

  await page.goto("/asesor/panel");
  await expect(page.locator("#staff-stage-panel-RESUELTO")).toBeVisible();
  await page.getByLabel("Mover a… para GNB-E2E-101").selectOption("NUEVO");
  const releaseDialog = page.getByRole("dialog", { name: "Liberar ticket" });
  await releaseDialog.getByLabel("Motivo de liberación").fill("Debe revisarlo otro asesor.");
  await releaseDialog.getByRole("button", { name: "Liberar ticket", exact: true }).click();
  await expect.poll(() => mock.assigned.status).toBe("NUEVO");
  expect(mock.assigned.assigned_advisor_id).toBeNull();
  expect(mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/release`)?.body).toEqual({ reason: "Debe revisarlo otro asesor.", expected_version: 11 });
  await expect(page.locator("#staff-stage-panel-NUEVO .staff-ticket-card--redesign").filter({ hasText: "GNB-E2E-101" }).getByRole("button", { name: "Tomar ticket" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Asesor mueve ASIGNADO a EN_PROCESO con la versión del ticket", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "transición ordinaria verificada una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  const movement = page.locator("#staff-stage-panel-ASIGNADO").getByLabel("Mover a… para GNB-E2E-101");
  await movement.focus();
  await movement.press("ArrowDown");
  await expect.poll(() => mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/status`)?.body).toEqual({ status: "EN_PROCESO", expected_version: 4 });
  await expect.poll(() => mock.assigned.status).toBe("EN_PROCESO");
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByRole("heading", { name: "Revisión de una operación" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("el clic abre el detalle y el arrastre de tarjeta mueve solo después de responder la API", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "arrastre con mouse verificado una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  let statusRequestCount = 0;
  let resolveStatusRequest!: () => void;
  const statusRequestStarted = new Promise<void>((resolve) => { resolveStatusRequest = resolve; });
  await page.route(`**/api/v1/tickets/${assignedTicketId}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    statusRequestCount += 1;
    resolveStatusRequest();
    await new Promise((resolve) => setTimeout(resolve, 900));
    return route.fallback();
  });

  await page.goto("/supervisor/cola");
  await page.locator("#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign h4").click();
  await expect(page).toHaveURL(new RegExp(`/supervisor/tickets/${assignedTicketId}$`));
  await page.getByRole("link", { name: "Volver al tablero" }).click();
  await expect(page).toHaveURL(/\/supervisor\/cola$/);

  const sourceSelector = "#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign";
  const source = page.locator(sourceSelector).first();
  const target = page.locator("#staff-stage-panel-EN_PROCESO");
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("No se encontró la tarjeta o columna del arrastre.");
  const startX = sourceBox.x + 10;
  const startY = sourceBox.y + 10;
  const targetY = Math.max(targetBox.y + 24, Math.min(startY, targetBox.y + targetBox.height - 24));
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetY, { steps: 12 });
  await expect(page.locator("#staff-stage-panel-EN_PROCESO.staff-kanban__column[data-drop-state='target']")).toBeVisible();
  expect(statusRequestCount).toBe(0);
  await page.mouse.up();
  await statusRequestStarted;
  await expect(source.getByText("Por atender", { exact: true })).toBeVisible();
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByText("GNB-E2E-101", { exact: true })).toHaveCount(0);
  expect(mock.mutations).toEqual([]);

  await expect.poll(() => mock.assigned.status).toBe("EN_PROCESO");
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByText("GNB-E2E-101", { exact: true })).toBeVisible();
  expect(statusRequestCount).toBe(1);
  expect(mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/status`)?.body).toEqual({ status: "EN_PROCESO", expected_version: 4 });
  expect(mock.unhandledMutations).toEqual([]);
});

test("same-stage e invalid drops no llaman a la API", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "drops inválidos verificados una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  await page.goto("/supervisor/cola");

  await dragCardWithMouse(page, "#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign", "#staff-stage-panel-ASIGNADO");
  await expect(page.getByRole("status").filter({ hasText: "El ticket ya está en esa columna." })).toBeVisible();
  expect(mock.mutations).toEqual([]);

  await page.reload();
  await expect(page.locator("#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign")).toBeVisible();
  await dragCardWithMouse(page, "#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign", "#staff-stage-panel-RESUELTO");
  await expect(page.getByRole("status").filter({ hasText: /No se permite mover de Por atender a Resuelto por cerrar/ })).toBeVisible();
  expect(mock.mutations).toEqual([]);
  expect(mock.assigned.status).toBe("ASIGNADO");
});

test("el fallo de red conserva la etapa y permite reintentar el movimiento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "fallo de red y reintento verificados una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  let attempts = 0;
  await page.route(`**/api/v1/tickets/${assignedTicketId}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts += 1;
    if (attempts === 1) return route.abort("failed");
    return route.fallback();
  });

  await page.goto("/asesor/panel");
  const card = page.locator("#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign");
  await page.getByLabel("Mover a… para GNB-E2E-101").selectOption("EN_PROCESO");
  await expect(card.getByRole("alert").filter({ hasText: "No pudimos conectar con el servicio" })).toBeVisible();
  await expect(card.getByText("Por atender", { exact: true })).toBeVisible();
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByText("GNB-E2E-101", { exact: true })).toHaveCount(0);
  expect(mock.assigned.status).toBe("ASIGNADO");
  expect(attempts).toBe(1);

  await card.getByRole("button", { name: "Reintentar" }).click();
  await expect.poll(() => mock.assigned.status).toBe("EN_PROCESO");
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByText("GNB-E2E-101", { exact: true })).toBeVisible();
  expect(attempts).toBe(2);
  expect(mock.unhandledMutations).toEqual([]);
});

test("un conflicto 409 refresca el tablero y no reintenta el movimiento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "conflicto de movimiento verificado una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  let attempts = 0;
  await page.route(`**/api/v1/tickets/${assignedTicketId}/status`, async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    attempts += 1;
    return route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "CONFLICT", message: "El ticket cambió en paralelo." }),
    });
  });

  await page.goto("/asesor/panel");
  const operationListRequestsBeforeMove = mock.requests.filter((item) => item.method === "GET" && item.path === "/api/v1/tickets/operations").length;
  await page.getByLabel("Mover a… para GNB-E2E-101").selectOption("EN_PROCESO");
  await expect(page.getByRole("status").filter({ hasText: "El ticket cambió en paralelo. Actualizamos el tablero" })).toBeVisible();
  await expect.poll(() => mock.requests.filter((item) => item.method === "GET" && item.path === "/api/v1/tickets/operations").length).toBeGreaterThan(operationListRequestsBeforeMove);
  await expect(page.locator("#staff-stage-panel-ASIGNADO h3", { hasText: "Por atender" })).toBeVisible();
  await expect(page.locator("#staff-stage-panel-EN_PROCESO").getByText("GNB-E2E-101", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reintentar" })).toHaveCount(0);
  expect(mock.assigned.status).toBe("ASIGNADO");
  await page.waitForTimeout(150);
  expect(attempts).toBe(1);
  expect(mock.unhandledMutations).toEqual([]);
});

test("el arrastre touch desde una zona libre llega a una etapa válida", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "arrastre táctil verificado en móvil");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  await page.locator("#staff-stage-tab-ASIGNADO").tap();
  await expect(page.locator("#staff-stage-panel-ASIGNADO h4", { hasText: "Revisión de una operación" })).toBeVisible();

  await dragCardWithTouch(
    page,
    "#staff-stage-panel-ASIGNADO .staff-ticket-card--redesign",
    "#staff-stage-tab-EN_PROCESO",
  );

  await expect.poll(() => mock.assigned.status).toBe("EN_PROCESO");
  expect(mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/status`)?.body).toEqual({ status: "EN_PROCESO", expected_version: 4 });
  await expect(page.locator("#staff-stage-tab-EN_PROCESO")).toHaveAttribute("aria-selected", "true");
  expect(mock.unhandledMutations).toEqual([]);
});

test("un toque vertical en la tarjeta desplaza la página sin iniciar un movimiento", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "scroll táctil desde tarjeta verificado en móvil");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  const card = page.locator("#staff-stage-panel-NUEVO .staff-ticket-card--redesign");
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  if (!box) throw new Error("No se encontró la tarjeta disponible para probar scroll.");
  const startX = box.x + box.width / 2;
  const startY = box.y + Math.min(80, box.height / 3);
  const before = await page.evaluate(() => window.scrollY);
  await touchGesture(page, startX, startY, startX + 2, startY - 120);
  const after = await page.evaluate(() => window.scrollY);

  expect(after).toBeGreaterThan(before);
  expect(mock.mutations).toEqual([]);
  expect(mock.available.status).toBe("NUEVO");
});

test("un toque simple sobre una tarjeta propia abre el detalle sin moverla", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "clic táctil en tarjeta verificado en móvil");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/panel");
  await page.locator("#staff-stage-tab-ASIGNADO").tap();
  await page.locator("#staff-stage-panel-ASIGNADO h4", { hasText: "Revisión de una operación" }).tap();
  await expect(page.getByRole("heading", { name: "Revisión de una operación", level: 1 })).toBeVisible();
  expect(mock.mutations).toEqual([]);
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor cancela con motivo y expected_version, y el detalle queda en consulta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "cancelación verificada una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  await page.goto(`/supervisor/tickets/${assignedTicketId}`);
  await page.getByLabel("Mover a…").selectOption("CANCELADO");
  await page.getByLabel("Motivo de cancelación").fill("Solicitud duplicada confirmada.");
  await page.getByRole("button", { name: "Guardar estado" }).click();
  await expect.poll(() => mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/cancel`)?.body).toEqual({ reason: "Solicitud duplicada confirmada.", expected_version: 4 });
  await expect(page.getByText(/Modo consulta: ticket cancelado/i)).toBeVisible();
  await expect(page.getByLabel("Agregar comentario")).toHaveCount(0);
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor puede reasignar RESUELTO sin cambiar el estado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "reasignación en RESUELTO verificada una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  mock.setDetailTicket(ticketFixture({ status: "RESUELTO", resolved_at: "2026-11-05T15:00:00Z", version: 7 }));

  await page.goto(`/supervisor/tickets/${assignedTicketId}`);
  await page.getByLabel("Asignar o reasignar responsable").selectOption("00000000-0000-4000-8000-000000000004");
  await page.getByRole("button", { name: "Guardar reasignación" }).click();
  const assignment = mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/assignments`);
  expect(assignment?.body).toEqual({ advisor_id: "00000000-0000-4000-8000-000000000004", expected_version: 7 });
  await expect.poll(() => mock.detailTicket.status).toBe("RESUELTO");
  await expect(page.getByText("Resuelto por cerrar", { exact: true })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor reabre RESUELTO con motivo y expected_version", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "reapertura verificada una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  mock.setDetailTicket(ticketFixture({ status: "RESUELTO", resolved_at: "2026-11-05T15:00:00Z", version: 9 }));

  await page.goto(`/supervisor/tickets/${assignedTicketId}`);
  await page.getByLabel("Mover a…").selectOption("EN_PROCESO");
  await page.getByLabel("Motivo de reapertura").fill("Falta una validación del cliente.");
  await page.getByRole("button", { name: "Guardar estado" }).click();
  const reopen = mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/reopen`);
  expect(reopen?.body).toEqual({ reason: "Falta una validación del cliente.", expected_version: 9 });
  await expect.poll(() => mock.detailTicket.status).toBe("EN_PROCESO");
  await expect(page.getByText("En atención", { exact: true })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Supervisor cierra RESUELTO por el endpoint específico y deja el ticket en consulta", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "cierre verificado una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  mock.setDetailTicket(ticketFixture({ status: "RESUELTO", resolved_at: "2026-11-05T15:00:00Z", version: 12 }));

  await page.goto(`/supervisor/tickets/${assignedTicketId}`);
  await page.getByLabel("Mover a…").selectOption("CERRADO");
  await page.getByRole("button", { name: "Guardar estado" }).click();
  await expect.poll(() => mock.detailTicket.status).toBe("CERRADO");
  const close = mock.mutations.find((item) => item.path === `/api/v1/tickets/${assignedTicketId}/close`);
  expect(close?.body).toEqual({});
  await expect(page.getByLabel("Agregar comentario")).toHaveCount(0);
  await expect(page.getByText(/Modo consulta: ticket cerrado/i)).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("Historial consulta solo cerrados y cancelados y conserva el retorno al abrir detalle", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "historial verificado una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  await page.goto("/asesor/historial");
  await expect(page.getByRole("heading", { name: "Historial de atención" })).toBeVisible();
  const firstTicket = page.getByRole("link", { name: /Abrir detalle/ }).first();
  await expect(firstTicket).toBeVisible();
  await firstTicket.click();
  await expect(page.getByRole("heading", { name: "Revisión de una operación", level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Volver al tablero" }).click();
  await expect(page).toHaveURL(/\/asesor\/historial$/);
  const historyRequests = mock.requests.filter((item) => item.method === "GET" && item.path === "/api/v1/tickets");
  expect(historyRequests.map(({ search }) => new URLSearchParams(search).get("status")).sort()).toEqual(["CANCELADO", "CERRADO"]);
  expect(historyRequests.some(({ search }) => new URLSearchParams(search).get("status") === "RESUELTO")).toBe(false);
  expect(mock.unhandledMutations).toEqual([]);
});

test("detalle real muestra conversación y SLA, y un comentario lleva la versión actual", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "detalle y comentario verificados una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  let commentBody: unknown;
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().endsWith(`/tickets/${assignedTicketId}/comments`)) commentBody = request.postDataJSON();
  });

  await page.goto(`/asesor/tickets/${assignedTicketId}`);
  await expect(page.getByRole("heading", { name: "Revisión de una operación", level: 1 })).toBeVisible();
  await expect(page.getByText("SLA", { exact: true })).toBeVisible();
  await expect(page.getByText("resumen.pdf")).toBeVisible();
  await expect(page.getByText("Todavía no hay eventos en el historial.")).toHaveCount(0);
  await expect.poll(() => mock.requests.some((item) => item.path === `/api/v1/tickets/${assignedTicketId}/history`)).toBe(true);
  await expect(page.getByRole("link", { name: "Volver al tablero" })).toHaveAttribute("href", "/asesor/panel");

  await page.getByLabel("Agregar comentario").fill("Revisaré la operación y te actualizaré.");
  await page.getByRole("button", { name: "Enviar comentario" }).click();
  await expect(page.getByText("Revisaré la operación y te actualizaré.")).toBeVisible();
  expect(commentBody).toEqual({ content: "Revisaré la operación y te actualizaré.", expected_version: 4 });
  expect(mock.commentPostCount).toBe(1);
  expect(mock.unhandledMutations).toEqual([]);
});

test("un ticket terminal está en consulta y no muestra controles para escribir o cambiar estado", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "permiso terminal verificado una vez en desktop");
  const mock = await installMockApp(page, "SUPERVISOR");
  await page.route(`**/api/v1/tickets/${assignedTicketId}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ticketFixture({ status: "CERRADO", closed_at: "2026-11-05T15:00:00Z" })),
    });
  });

  await page.goto(`/supervisor/tickets/${assignedTicketId}`);
  await expect(page.getByText(/Modo consulta: ticket cerrado/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Acciones operativas" })).toHaveCount(0);
  await expect(page.getByLabel("Agregar comentario")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Descargar resumen.pdf" })).toBeVisible();
  expect(mock.unhandledMutations).toEqual([]);
});

test("un comentario con conflicto 409 no se reenvía automáticamente", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "conflicto de comentario verificado una vez en desktop");
  const mock = await installMockApp(page, "ASESOR");
  let postCount = 0;
  await page.route(`**/api/v1/tickets/${assignedTicketId}/comments`, async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    postCount += 1;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ code: "CONFLICT", message: "El ticket cambió." }),
    });
  });

  await page.goto(`/asesor/tickets/${assignedTicketId}`);
  await page.getByLabel("Agregar comentario").fill("Mensaje que requiere confirmación.");
  await page.getByRole("button", { name: "Enviar comentario" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "El ticket cambió. Actualiza la conversación" })).toBeVisible();
  await expect.poll(() => postCount).toBe(1);
  expect(mock.commentPostCount).toBe(0);
  expect(mock.unhandledMutations).toEqual([]);
});

test("tablero, historial y detalle ajustan el ancho a 1440, 820 y 390 px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "verificación visual ejecutada en los tres viewports requeridos");
  const mock = await installMockApp(page, "SUPERVISOR");
  const advisorPage = await page.context().newPage();
  const advisorMock = await installMockApp(advisorPage, "ASESOR");
  const viewports = [
    { width: 1440, height: 900, name: "desktop" },
    { width: 820, height: 1180, name: "tablet" },
    { width: 390, height: 844, name: "mobile" },
  ] as const;
  const capturePage = async (targetPage: Page, name: string) => {
    await targetPage.screenshot({ path: testInfo.outputPath(`${name}.png`) });
    await targetPage.screenshot({ path: testInfo.outputPath(`${name}-full.png`), fullPage: true });
  };

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await advisorPage.setViewportSize(viewport);
    await page.goto("/supervisor/cola");
    await expect(page.getByRole("heading", { name: "Cola de atención" })).toBeVisible();
    if (viewport.width <= 1100) {
      await expect(page.locator("#staff-stage-tab-NUEVO")).toBeVisible();
      await expect(page.locator("#staff-stage-panel-ASIGNADO")).toBeHidden();
    } else {
      await expect(page.locator("#staff-stage-tab-NUEVO")).toBeHidden();
      await expect(page.locator("#staff-stage-panel-ASIGNADO")).toBeVisible();
    }
    const boardDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(boardDimensions.content).toBeLessThanOrEqual(boardDimensions.viewport + 1);
    await capturePage(page, `staff-board-${viewport.name}`);

    await page.goto("/supervisor/historial");
    await expect(page.getByRole("heading", { name: "Historial de tickets" })).toBeVisible();
    const historyDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(historyDimensions.content).toBeLessThanOrEqual(historyDimensions.viewport + 1);
    await capturePage(page, `staff-history-${viewport.name}`);

    await page.goto(`/supervisor/tickets/${assignedTicketId}`);
    await expect(page.getByRole("heading", { name: "Revisión de una operación", level: 1 })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    await capturePage(page, `staff-detail-${viewport.name}`);

    await advisorPage.goto("/asesor/panel");
    await expect(advisorPage.getByRole("heading", { name: "Kanban de atención" })).toBeVisible();
    const advisorBoardDimensions = await advisorPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(advisorBoardDimensions.content).toBeLessThanOrEqual(advisorBoardDimensions.viewport + 1);
    await capturePage(advisorPage, `advisor-board-${viewport.name}`);

    await advisorPage.goto("/asesor/historial");
    await expect(advisorPage.getByRole("heading", { name: "Historial de atención" })).toBeVisible();
    await capturePage(advisorPage, `advisor-history-${viewport.name}`);

    await advisorPage.goto(`/asesor/tickets/${assignedTicketId}`);
    await expect(advisorPage.getByRole("heading", { name: "Revisión de una operación", level: 1 })).toBeVisible();
    const advisorDetailDimensions = await advisorPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(advisorDetailDimensions.content).toBeLessThanOrEqual(advisorDetailDimensions.viewport + 1);
    await capturePage(advisorPage, `advisor-detail-${viewport.name}`);
  }
  expect(mock.unhandledMutations).toEqual([]);
  expect(advisorMock.unhandledMutations).toEqual([]);
  await advisorPage.close();
});
