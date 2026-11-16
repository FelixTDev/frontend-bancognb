import { expect, test, type Page } from "./fixtures";

const password = "demo-password-local";

async function login(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/ingresar$/);
}

async function installApiMocks(page: Page) {
  let user = {
    id: "route-smoke-client",
    full_name: "Cliente de pruebas",
    email: "cliente@demo.com",
    role: "CLIENTE",
    is_active: true,
  };

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const { pathname } = new URL(request.url());

    if (pathname === "/api/v1/auth/login" && request.method() === "POST") {
      const body = request.postDataJSON() as { email?: string };
      const role = body.email?.startsWith("supervisor")
        ? "SUPERVISOR"
        : body.email?.startsWith("asesor")
          ? "ASESOR"
          : "CLIENTE";
      user = {
        id: `route-smoke-${role.toLowerCase()}`,
        full_name:
          role === "SUPERVISOR"
            ? "Supervisor de pruebas"
            : role === "ASESOR"
              ? "Asesor de pruebas"
              : "Cliente de pruebas",
        email: body.email ?? "cliente@demo.com",
        role,
        is_active: true,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access_token: "route-smoke-token", user }),
      });
      return;
    }

    let body: unknown = [];
    if (pathname === "/api/v1/auth/me") body = user;
    else if (pathname === "/api/v1/notifications/unread-count") {
      body = { unread_count: 0 };
    } else if (pathname === "/api/v1/users/me/profile") {
      body = {
        full_name: user.full_name,
        email: user.email,
        phone: null,
        role: user.role,
        is_active: true,
      };
    } else if (pathname === "/api/v1/users/me/preferences") {
      body = {
        in_app_notifications: true,
        email_notifications: true,
        timezone: "America/Lima",
      };
    } else if (pathname === "/api/v1/reports/summary") {
      body = {
        total_tickets: 0,
        new_tickets: 0,
        assigned_tickets: 0,
        in_process_tickets: 0,
        pending_client_tickets: 0,
        resolved_tickets: 0,
        closed_tickets: 0,
        cancelled_tickets: 0,
        average_resolution_time_hours: 0,
      };
    } else if (
      pathname.startsWith("/api/v1/tickets") ||
      pathname.startsWith("/api/v1/audit") ||
      pathname.startsWith("/api/v1/notifications")
    ) {
      body = { items: [], total: 0, page: 1, page_size: 20, total_pages: 0 };
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function verifyRoutes(page: Page, paths: readonly string[]) {
  const failedApi: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400) {
      failedApi.push(
        `${response.status()} ${response.request().method()} ${response.url()}`,
      );
    }
  });
  for (const path of paths) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("Ocurrió un error inesperado")).toHaveCount(0);
    await expect(
      page.getByText("No pudimos cargar la información"),
    ).toHaveCount(0);
  }
  expect(failedApi, failedApi.join("\n")).toEqual([]);
}

test.describe("rutas autenticadas con respuestas mockeadas", () => {
  test.skip(({ browserName }) => browserName !== "chromium");

  test("cliente", async ({ page }) => {
    await installApiMocks(page);
    await login(page, "cliente@demo.com");
    await verifyRoutes(page, [
      "/app/inicio",
      "/app/solicitudes",
      "/app/nueva-solicitud",
      "/app/faq",
      "/app/asistente",
      "/app/perfil",
    ]);
  });

  test("asesor", async ({ page }) => {
    await installApiMocks(page);
    await login(page, "asesor@demo.com");
    await verifyRoutes(page, [
      "/asesor/panel",
      "/asesor/bandeja",
      "/asesor/historial",
      "/asesor/conocimiento",
    ]);
  });

  test("supervisor", async ({ page }) => {
    await installApiMocks(page);
    await login(page, "supervisor@demo.com");
    await verifyRoutes(page, [
      "/supervisor/operacion",
      "/supervisor/cola",
      "/supervisor/historial",
      "/supervisor/asignaciones",
      "/supervisor/contenido",
      "/supervisor/sla",
      "/supervisor/reportes",
      "/supervisor/auditoria",
    ]);
  });
});
