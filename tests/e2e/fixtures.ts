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
