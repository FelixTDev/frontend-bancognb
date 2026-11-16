import {
  expect as playwrightExpect,
  test as playwrightTest,
  type Page,
  type Route,
} from "@playwright/test";

const isolatedApiBaseUrl =
  process.env.E2E_API_BASE_URL?.trim().replace(/\/+$/, "") || undefined;
const requiredIsolatedApiBaseUrl = "http://127.0.0.1:8001/api/v1";
const frontendOrigin = "http://127.0.0.1:4174";

if (isolatedApiBaseUrl && isolatedApiBaseUrl !== requiredIsolatedApiBaseUrl) {
  throw new Error(
    "E2E_API_BASE_URL must target the isolated local API at 127.0.0.1:8001/api/v1.",
  );
}

const allowedOrigins = new Set([frontendOrigin]);
if (isolatedApiBaseUrl) {
  allowedOrigins.add(new URL(isolatedApiBaseUrl).origin);
}

export const test = playwrightTest.extend({
  page: async ({ context, page }, provide, testInfo) => {
    const blockedRequests: string[] = [];
    const isAllowed = (url: string) => {
      try {
        return allowedOrigins.has(new URL(url).origin);
      } catch {
        return false;
      }
    };
    const blockIfUntrusted = async (route: Route) => {
      const url = route.request().url();
      if (!isAllowed(url)) {
        const origin = (() => {
          try {
            return new URL(url).origin;
          } catch {
            return "invalid-url";
          }
        })();
        blockedRequests.push(`${route.request().method()} ${origin}`);
        await route.abort("blockedbyclient");
        return true;
      }
      return false;
    };

    const installPageGuard = async (targetPage: Page) => {
      const originalRoute = targetPage.route.bind(targetPage);
      targetPage.route = (async (url, handler, options) =>
        originalRoute(
          url,
          async (route) => {
            if (await blockIfUntrusted(route)) return;
            await handler(route, route.request());
          },
          options,
        )) as typeof targetPage.route;

      await originalRoute("**/*", async (route) => {
        if (await blockIfUntrusted(route)) return;
        await route.continue();
      });

      let currentUser = {
        id: "e2e-client",
        full_name: "Cliente E2E",
        email: "cliente@demo.com",
        role: "CLIENTE",
        is_active: true,
      };
      const pageResult = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };
      const defaultConversation = (id: string) => ({
        id,
        user_id: currentUser.id,
        status: "ACTIVE",
        started_at: "2026-11-16T12:00:00Z",
        ended_at: null,
        turn_count: 0,
        menu_open: false,
        messages: [],
        ui: null,
      });
      const mockJson = (route: Route, body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      await originalRoute("**/api/v1/**", async (route) => {
        if (await blockIfUntrusted(route)) return;
        const request = route.request();
        const { pathname } = new URL(request.url());
        const method = request.method();

        if (pathname === "/api/v1/auth/login" && method === "POST") {
          const body = request.postDataJSON() as { email?: string };
          const role = body.email?.startsWith("supervisor")
            ? "SUPERVISOR"
            : body.email?.startsWith("asesor")
              ? "ASESOR"
              : "CLIENTE";
          currentUser = {
            id: `e2e-${role.toLowerCase()}`,
            full_name:
              role === "SUPERVISOR"
                ? "Supervisor E2E"
                : role === "ASESOR"
                  ? "Asesor E2E"
                  : "Cliente E2E",
            email: body.email ?? "cliente@demo.com",
            role,
            is_active: true,
          };
          await mockJson(route, { access_token: "e2e-local-token", user: currentUser });
          return;
        }

        if (pathname === "/api/v1/auth/me" && method === "GET") {
          await mockJson(route, currentUser);
          return;
        }
        if (pathname === "/api/v1/notifications/unread-count") {
          await mockJson(route, { unread_count: 0 });
          return;
        }
        if (pathname === "/api/v1/users/me/profile") {
          await mockJson(route, {
            full_name: currentUser.full_name,
            email: currentUser.email,
            phone: null,
            role: currentUser.role,
            is_active: true,
          });
          return;
        }
        if (pathname === "/api/v1/users/me/preferences") {
          await mockJson(route, {
            in_app_notifications: true,
            email_notifications: true,
            timezone: "America/Lima",
          });
          return;
        }
        if (pathname === "/api/v1/reports/summary") {
          await mockJson(route, {
            total_tickets: 0,
            new_tickets: 0,
            assigned_tickets: 0,
            in_process_tickets: 0,
            pending_client_tickets: 0,
            resolved_tickets: 0,
            closed_tickets: 0,
            cancelled_tickets: 0,
            average_resolution_time_hours: 0,
          });
          return;
        }
        if (pathname === "/api/v1/categories") {
          await mockJson(route, [
            {
              id: "e2e-category",
              name: "Atención general",
              description: "Categoría de pruebas",
              is_active: true,
            },
          ]);
          return;
        }
        if (pathname === "/api/v1/chat/conversations" && method === "POST") {
          await mockJson(route, defaultConversation("e2e-conversation"), 201);
          return;
        }
        if (
          pathname === "/api/v1/chat/conversations" &&
          method === "GET"
        ) {
          await mockJson(route, []);
          return;
        }
        const conversationMatch = pathname.match(
          /^\/api\/v1\/chat\/conversations\/([^/]+)$/,
        );
        if (conversationMatch?.[1] && method === "GET") {
          await mockJson(route, defaultConversation(conversationMatch[1]));
          return;
        }
        if (pathname.endsWith("/messages") && method === "POST") {
          const body = request.postDataJSON() as {
            content?: string;
            option_id?: string;
          };
          await mockJson(route, {
            user_message: {
              id: "e2e-user-message",
              sender_type: "USER",
              content: body.content ?? body.option_id ?? "Consulta",
              intent: null,
              confidence: null,
              created_at: "2026-11-16T12:00:00Z",
            },
            bot_message: {
              id: "e2e-bot-message",
              sender_type: "BOT",
              content: "Respuesta simulada del asistente.",
              intent: null,
              confidence: null,
              created_at: "2026-11-16T12:00:00Z",
            },
            resolved: false,
            offers_ticket: false,
            confidence: 0,
            requires_clarification: false,
            clarification_options: [],
            suggested_action: "NONE",
            menu_open: false,
            conversation_status: "ACTIVE",
            response_source: "DETERMINISTIC",
            sources: [],
          });
          return;
        }
        if (
          pathname.endsWith("/link-user") &&
          method === "POST"
        ) {
          const conversationId = pathname.split("/").at(-2) ?? "e2e-conversation";
          await mockJson(route, {
            id: conversationId,
            user_id: currentUser.id,
            status: "ACTIVE",
          });
          return;
        }

        let body: unknown = [];
        if (
          pathname.startsWith("/api/v1/tickets") ||
          pathname.startsWith("/api/v1/audit") ||
          pathname.startsWith("/api/v1/notifications")
        ) {
          body = pageResult;
        }
        await mockJson(route, body);
      });
    };

    await installPageGuard(page);
    context.on("page", (newPage) => {
      if (newPage !== page) void installPageGuard(newPage);
    });

    await provide(page);
    playwrightExpect(
      blockedRequests,
      `E2E attempted requests outside isolated origins in ${testInfo.title}`,
    ).toEqual([]);
  },
});

export { playwrightExpect as expect };
export type { APIResponse, Page, Route } from "@playwright/test";
