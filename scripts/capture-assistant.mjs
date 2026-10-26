import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const appUrl = "http://127.0.0.1:5173";
const output = path.resolve("artifacts/screenshots/assistant-phase1-mock");
const viewports = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844, isMobile: true },
];
const session = {
  token: "screenshot-session-token",
  user: {
    id: "screenshot-client",
    full_name: "Cliente de demostración",
    email: "cliente@example.test",
    role: "CLIENTE",
  },
};
const category = {
  id: "screenshot-category",
  name: "Banca digital",
  description: "Canales digitales",
  is_active: true,
};
const source = {
  title: "Canales digitales",
  category: "Banca digital",
  url: "https://www.bancognb.com.pe/inicio/canales/canales-digitales",
  verified_at: "2026-10-05T00:00:00Z",
};

const json = (route, status, value) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(value),
  });

const conversation = (id, messages = []) => ({
  id,
  user_id: session.user.id,
  status: "ACTIVE",
  started_at: "2026-10-10T12:00:00Z",
  ended_at: null,
  turn_count: messages.length,
  last_activity_at: "2026-10-10T12:00:00Z",
  messages,
});

async function installApiMocks(page) {
  const unhandledMutations = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathName = url.pathname;

    if (request.method() === "GET") {
      if (pathName === "/api/v1/auth/me") {
        await json(route, 200, session.user);
        return;
      }
      if (pathName === "/api/v1/categories") {
        await json(route, 200, [category]);
        return;
      }
      const conversationMatch = pathName.match(
        /^\/api\/v1\/chat\/conversations\/([^/]+)$/,
      );
      if (conversationMatch?.[1]) {
        await json(route, 200, conversation(conversationMatch[1]));
        return;
      }
      await json(route, 200, []);
      return;
    }

    if (request.method() === "POST" && pathName === "/api/v1/chat/conversations") {
      await json(route, 201, conversation("screenshot-conversation"));
      return;
    }
    if (
      request.method() === "POST" &&
      /^\/api\/v1\/chat\/conversations\/[^/]+\/messages$/.test(pathName)
    ) {
      const content = request.postDataJSON()?.content ?? "Consulta de demostración";
      await json(route, 200, {
        user_message: {
          id: "screenshot-user-message",
          sender_type: "USER",
          content,
          intent: null,
          confidence: 0.8,
          created_at: "2026-10-10T12:01:00Z",
        },
        bot_message: {
          id: "screenshot-bot-message",
          sender_type: "BOT",
          content: "Puedes revisar la información oficial de los canales digitales.",
          intent: "FAQ",
          confidence: 0.8,
          created_at: "2026-10-10T12:01:01Z",
        },
        resolved: true,
        offers_ticket: false,
        confidence: 0.8,
        faq_id: null,
        source_category: "Banca digital",
        requires_clarification: false,
        clarification_options: [],
        suggested_action: "NONE",
        fallback_reason: null,
        conversation_status: "ACTIVE",
        response_source: "FAQ",
        sources: [source],
      });
      return;
    }
    if (request.method() === "POST" && pathName.endsWith("/link-user")) {
      const id = pathName.split("/").at(-2);
      await json(route, 200, { id, user_id: session.user.id, status: "ACTIVE" });
      return;
    }
    if (
      request.method() === "POST" &&
      /\/chat\/conversations\/[^/]+\/(feedback|escalate)$/.test(pathName)
    ) {
      await json(route, 200, { id: "screenshot-conversation", status: "ACTIVE" });
      return;
    }

    unhandledMutations.push(`${request.method()} ${pathName}`);
    await json(route, 501, {
      code: "E2E_UNMOCKED_MUTATION",
      message: "This screenshot mutation is not mocked.",
    });
  });
  return unhandledMutations;
}

const browser = await chromium.launch({ headless: true });
const results = [];

const observe = (page) => {
  const consoleErrors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/") && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return { consoleErrors, failedResponses };
};

for (const viewport of viewports) {
  const contextOptions = {
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.isMobile ?? false,
    reducedMotion: "reduce",
  };
  const directory = path.join(output, viewport.name);
  await mkdir(directory, { recursive: true });

  const publicContext = await browser.newContext(contextOptions);
  const publicPage = await publicContext.newPage();
  const publicMutations = await installApiMocks(publicPage);
  const publicEvidence = observe(publicPage);
  await publicPage.goto(`${appUrl}/`, { waitUntil: "networkidle" });
  await publicPage
    .getByRole("button", { name: "Abrir Asistente GNB" })
    .click();
  await publicPage
    .getByRole("dialog", { name: "Asistente GNB" })
    .waitFor({ state: "visible" });
  const widgetFile = path.join(directory, "inicio-asistente-widget.png");
  await publicPage.screenshot({ path: widgetFile, animations: "disabled" });
  results.push({
    viewport: viewport.name,
    surface: "landing-widget",
    file: widgetFile,
    unhandledMutations: publicMutations,
    ...publicEvidence,
  });
  await publicContext.close();

  const clientContext = await browser.newContext(contextOptions);
  await clientContext.addInitScript((value) => {
    localStorage.setItem("gnb.session.v1", JSON.stringify(value));
  }, session);
  const clientPage = await clientContext.newPage();
  const clientMutations = await installApiMocks(clientPage);
  const clientEvidence = observe(clientPage);
  await clientPage.goto(`${appUrl}/app/asistente`, {
    waitUntil: "networkidle",
  });
  await clientPage
    .getByRole("button", { name: "¿Cómo consulto el saldo de mi cuenta?" })
    .click();
  await clientPage
    .locator(".assistant-message--bot:not(:has(.assistant-typing))")
    .waitFor({ state: "visible", timeout: 10_000 });
  const clientFile = path.join(directory, "cliente-asistente.png");
  await clientPage.screenshot({ path: clientFile, animations: "disabled" });
  results.push({
    viewport: viewport.name,
    surface: "authenticated-assistant",
    file: clientFile,
    unhandledMutations: clientMutations,
    ...clientEvidence,
  });
  await clientContext.close();
}

await browser.close();
const manifest = {
  generatedAt: new Date().toISOString(),
  mode: "mocked-api",
  count: results.length,
  results,
};
await writeFile(
  path.join(output, "assistant-manifest.json"),
  JSON.stringify(manifest, null, 2),
);

const failures = results.flatMap((result) => [
  ...result.consoleErrors.map(
    (message) => `${result.viewport}/${result.surface}: console ${message}`,
  ),
  ...result.failedResponses.map(
    (message) => `${result.viewport}/${result.surface}: network ${message}`,
  ),
  ...result.unhandledMutations.map(
    (message) => `${result.viewport}/${result.surface}: unmocked ${message}`,
  ),
]);
console.log(`Captured ${results.length} assistant screenshots with mocked API responses.`);
if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
}
