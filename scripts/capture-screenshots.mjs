import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const appUrl = "http://127.0.0.1:5173";
const apiUrl = "http://127.0.0.1:8000/api/v1";
const output = path.resolve("artifacts/screenshots");
const password = "demo-password-local";

const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
];

const publicRoutes = [
  ["inicio", "/"],
  ["como-funciona", "/como-funciona"],
  ["preguntas-frecuentes", "/preguntas-frecuentes"],
  ["nosotros", "/nosotros"],
  ["ayuda", "/ayuda"],
  ["privacidad", "/privacidad"],
  ["terminos", "/terminos"],
  ["ingresar", "/ingresar"],
  ["registro", "/registro"],
  ["recuperar-acceso", "/recuperar-acceso"],
  ["restablecer-acceso", "/restablecer-acceso"],
  ["verificar-cuenta", "/verificar-cuenta"],
];

const roleRoutes = {
  CLIENTE: [
    ["cliente-inicio", "/app/inicio"],
    ["cliente-solicitudes", "/app/solicitudes"],
    ["cliente-nueva-solicitud", "/app/nueva-solicitud"],
    ["cliente-faq", "/app/faq"],
    ["cliente-asistente", "/app/asistente"],
    ["cliente-perfil", "/app/perfil"],
  ],
  ASESOR: [
    ["asesor-panel", "/asesor/panel"],
    ["asesor-bandeja", "/asesor/bandeja"],
    ["asesor-historial", "/asesor/historial"],
    ["asesor-conocimiento", "/asesor/conocimiento"],
  ],
  SUPERVISOR: [
    ["supervisor-operacion", "/supervisor/operacion"],
    ["supervisor-cola", "/supervisor/cola"],
    ["supervisor-historial", "/supervisor/historial"],
    ["supervisor-asignaciones", "/supervisor/asignaciones"],
    ["supervisor-contenido", "/supervisor/contenido"],
    ["supervisor-sla", "/supervisor/sla"],
    ["supervisor-reportes", "/supervisor/reportes"],
    ["supervisor-auditoria", "/supervisor/auditoria"],
  ],
};

async function authenticate(email) {
  const response = await fetch(`${apiUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(`Login ${email}: ${response.status}`);
  const value = await response.json();
  return { token: value.access_token, user: value.user };
}

async function fetchFirstTicket(token, endpoint) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const value = await response.json();
  const items = Array.isArray(value) ? value : (value.items ?? []);
  return items[0]?.id ?? null;
}

async function fetchFirstTicketRecord(token, endpoint) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  const value = await response.json();
  const items = Array.isArray(value) ? value : (value.items ?? []);
  return items[0] ?? null;
}

async function fetchApiJson(token, endpoint) {
  const response = await fetch(`${apiUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : null;
}

async function captureCurrent(
  page,
  viewportName,
  slug,
  route,
  results,
  { fullPage = true } = {},
) {
  const failed = [];
  const onResponse = (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on("response", onResponse);
  await page.waitForTimeout(450);
  if (fullPage) {
    await page.evaluate(async () => {
      const step = Math.max(400, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      window.scrollTo(0, 0);
    });
  }
  await page.waitForTimeout(180);
  const file = path.join(output, viewportName, `${slug}.png`);
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage, animations: "disabled" });
  results.push({ viewport: viewportName, slug, route, file, failed });
  page.off("response", onResponse);
}

async function capture(page, viewportName, slug, route, results) {
  const failed = [];
  const onResponse = (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400) {
      failed.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on("response", onResponse);
  await page.goto(`${appUrl}${route}`, { waitUntil: "domcontentloaded" });
  const index = results.length;
  await captureCurrent(page, viewportName, slug, route, results);
  results[index].failed.push(...failed);
  page.off("response", onResponse);
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const sessions = {
  CLIENTE: await authenticate("cliente@demo.com"),
  ASESOR: await authenticate("asesor@demo.com"),
  SUPERVISOR: await authenticate("supervisor@demo.com"),
};
const detailIds = {
  CLIENTE: await fetchFirstTicket(
    sessions.CLIENTE.token,
    "/tickets/mine?page=1&page_size=1",
  ),
  ASESOR: await fetchFirstTicket(
    sessions.ASESOR.token,
    "/tickets/operations?queue=assigned_to_me&page=1&page_size=1",
  ),
  SUPERVISOR: await fetchFirstTicket(
    sessions.SUPERVISOR.token,
    "/tickets/operations?queue=recently_updated&page=1&page_size=1",
  ),
};
const unassignedTicket = await fetchFirstTicketRecord(
  sessions.ASESOR.token,
  "/tickets/operations?queue=unassigned&page=1&page_size=1",
);
const unassignedContext = unassignedTicket
  ? {
      ticket: await fetchApiJson(
        sessions.SUPERVISOR.token,
        `/tickets/${unassignedTicket.id}`,
      ),
      comments: await fetchApiJson(
        sessions.SUPERVISOR.token,
        `/tickets/${unassignedTicket.id}/comments`,
      ),
      attachments: await fetchApiJson(
        sessions.SUPERVISOR.token,
        `/tickets/${unassignedTicket.id}/attachments`,
      ),
      history: await fetchApiJson(
        sessions.SUPERVISOR.token,
        `/tickets/${unassignedTicket.id}/history`,
      ),
      sla: await fetchApiJson(
        sessions.SUPERVISOR.token,
        `/tickets/${unassignedTicket.id}/sla`,
      ),
    }
  : null;
const results = [];

for (const viewport of viewports) {
  const publicContext = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.isMobile ?? false,
    reducedMotion: "reduce",
  });
  const publicPage = await publicContext.newPage();
  for (const [slug, route] of publicRoutes) {
    await capture(publicPage, viewport.name, slug, route, results);
  }
  await publicContext.close();

  for (const [role, routes] of Object.entries(roleRoutes)) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      isMobile: viewport.isMobile ?? false,
      hasTouch: viewport.isMobile ?? false,
      reducedMotion: "reduce",
    });
    await context.addInitScript((session) => {
      localStorage.setItem("gnb.session.v1", JSON.stringify(session));
    }, sessions[role]);
    const page = await context.newPage();
    for (const [slug, route] of routes) {
      await capture(page, viewport.name, slug, route, results);
      if (role === "SUPERVISOR" && route === "/supervisor/cola") {
        await page.getByRole("tab", { name: "Vista Kanban" }).click();
        await captureCurrent(
          page,
          viewport.name,
          "supervisor-cola-kanban",
          route,
          results,
        );
      }
    }
    if (role === "ASESOR") {
      await page.goto(`${appUrl}/asesor/bandeja`, { waitUntil: "domcontentloaded" });
      if (viewport.isMobile) {
        await page.getByText("Filtros de la bandeja", { exact: true }).click();
        await captureCurrent(
          page,
          viewport.name,
          "asesor-bandeja-filtros-abiertos",
          "/asesor/bandeja",
          results,
          { fullPage: false },
        );
      }
      await page.getByLabel("Cola").selectOption("unassigned");
      if (viewport.isMobile) {
        await page.getByText("Cerrar filtros", { exact: true }).click();
      }
      await page.waitForTimeout(450);
      await captureCurrent(
        page,
        viewport.name,
        "asesor-bandeja-sin-asignar",
        "/asesor/bandeja?queue=unassigned",
        results,
      );
      if (unassignedContext?.ticket) {
        const ticketAfterTake = {
          ...unassignedTicket,
          status: "ASIGNADO",
          assigned_advisor_id: sessions.ASESOR.user.id,
          assigned_at: new Date().toISOString(),
          version: unassignedTicket.version + 1,
        };
        await page.route(
          new RegExp(`/api/v1/tickets/${unassignedTicket.id}(?:/.*)?$`),
          async (route) => {
            const request = route.request();
            const resource = new URL(request.url()).pathname;
            if (request.method() === "POST" && resource.endsWith("/take")) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(ticketAfterTake),
              });
            } else if (
              request.method() === "GET" &&
              resource === `/api/v1/tickets/${unassignedTicket.id}`
            ) {
              await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(ticketAfterTake),
              });
            } else if (resource.endsWith("/comments")) {
              await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(unassignedContext.comments ?? []) });
            } else if (resource.endsWith("/attachments")) {
              await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(unassignedContext.attachments ?? []) });
            } else if (resource.endsWith("/history")) {
              await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(unassignedContext.history ?? []) });
            } else if (resource.endsWith("/sla") && unassignedContext.sla) {
              await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(unassignedContext.sla) });
            } else {
              await route.continue();
            }
          },
        );
        const row = page.getByRole("row").filter({ hasText: unassignedTicket.tracking_code });
        await row.getByRole("button", { name: "Tomar ticket" }).click();
        await page.waitForURL(new RegExp(`/asesor/tickets/${unassignedTicket.id}$`));
        await captureCurrent(
          page,
          viewport.name,
          "asesor-ticket-despues-de-tomar",
          `/asesor/tickets/${unassignedTicket.id}`,
          results,
        );
      }
    }
    const id = detailIds[role];
    if (id) {
      const prefix =
        role === "CLIENTE"
          ? "/app/solicitudes"
          : role === "ASESOR"
            ? "/asesor/tickets"
            : "/supervisor/tickets";
      await capture(
        page,
        viewport.name,
        `${role.toLowerCase()}-ticket-detalle`,
        `${prefix}/${id}`,
        results,
      );
      if (role === "CLIENTE") {
        await capture(
          page,
          viewport.name,
          "cliente-solicitud-creada",
          `/app/solicitudes/${id}/creada`,
          results,
        );
      }
    }
    await context.close();
  }
}

await browser.close();
await writeFile(
  path.join(output, "manifest.json"),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), count: results.length, results },
    null,
    2,
  ),
);
const failures = results.flatMap((item) =>
  item.failed.map((failure) => `${item.viewport}/${item.slug}: ${failure}`),
);
console.log(`Captured ${results.length} pages.`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
