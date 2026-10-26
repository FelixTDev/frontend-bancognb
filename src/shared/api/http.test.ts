import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpClient } from "./http";

describe("http client", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sends bearer and request id headers and reads the response request id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Request-ID": "server-request",
        },
      }),
    );
    const client = createHttpClient({
      baseUrl: "http://api.test",
      getToken: () => "secure-token",
    });

    const result = await client.request<{ ok: boolean }>("/health");

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer secure-token");
    expect(headers.get("X-Request-ID")).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.requestId).toBe("server-request");
  });

  it("normalizes backend error contracts and invokes unauthorized handling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "AUTHENTICATION_REQUIRED",
          message: "Tu sesión expiró.",
          details: null,
          request_id: "req-401",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    const onUnauthorized = vi.fn();
    const client = createHttpClient({
      baseUrl: "http://api.test",
      getToken: () => "expired",
      onUnauthorized,
    });

    await expect(client.request("/auth/me")).rejects.toEqual(
      expect.objectContaining({
        status: 401,
        code: "AUTHENTICATION_REQUIRED",
        requestId: "req-401",
      }),
    );
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
