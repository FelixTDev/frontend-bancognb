import { expect, test } from "./fixtures";

async function addAuthenticatedSession(page: import("./fixtures").Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "local-test-user",
        full_name: "Cliente de prueba",
        email: "cliente@example.test",
        role: "CLIENTE",
      }),
    }),
  );
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "gnb.session.v1",
      JSON.stringify({
        token: "local-test-session-token",
        user: {
          id: "local-test-user",
          full_name: "Cliente de prueba",
          email: "cliente@example.test",
          role: "CLIENTE",
        },
      }),
    );
  });
}

test("a signed-in user can open a password reset link", async ({ page }) => {
  await addAuthenticatedSession(page);

  await page.goto("/restablecer-acceso?token=local-one-time-token");

  await expect(
    page.getByRole("heading", { name: "Define una nueva contraseña" }),
  ).toBeVisible();
  await expect(page.getByLabel("Nueva contraseña")).toBeVisible();
});

test("a signed-in user can verify an email link", async ({ page }) => {
  await addAuthenticatedSession(page);
  await page.route("**/api/v1/auth/verify-email", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Correo electrónico verificado correctamente",
      }),
    }),
  );

  await page.goto("/verificar-cuenta?token=local-one-time-token");

  await expect(
    page.getByRole("heading", { name: "Cuenta verificada" }),
  ).toBeVisible();
  await expect(
    page.getByText("Tu correo fue verificado. Ya puedes ingresar."),
  ).toBeVisible();
});
