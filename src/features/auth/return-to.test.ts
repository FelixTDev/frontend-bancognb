import { describe, expect, it } from "vitest";
import { getSafeReturnTo, withReturnTo } from "./return-to";

describe("authentication return path", () => {
  it("keeps an internal path and its query after authentication", () => {
    expect(getSafeReturnTo("/app/asistente?from=widget#conversation")).toBe(
      "/app/asistente?from=widget#conversation",
    );
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "/ingresar"])(
    "rejects an unsafe or looping return path: %s",
    (value) => expect(getSafeReturnTo(value)).toBeNull(),
  );

  it("adds an encoded return path to an existing authentication route", () => {
    expect(withReturnTo("/ingresar", "/app/asistente")).toBe(
      "/ingresar?returnTo=%2Fapp%2Fasistente",
    );
  });
});
