import { expect, test, type Page } from "./fixtures";

const password = "demo-password-local";

async function login(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).not.toHaveURL(/\/ingresar$/);
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

test.describe("rutas conectadas al backend", () => {
  test.skip(({ browserName }) => browserName !== "chromium");

  test("cliente", async ({ page }) => {
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
    await login(page, "asesor@demo.com");
    await verifyRoutes(page, [
      "/asesor/panel",
      "/asesor/bandeja",
      "/asesor/historial",
      "/asesor/conocimiento",
    ]);
  });

  test("supervisor", async ({ page }) => {
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
