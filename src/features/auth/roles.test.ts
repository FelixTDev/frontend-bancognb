import { describe, expect, it } from "vitest";
import { homeForRole, isRoleAllowed } from "./roles";

describe("role authorization", () => {
  it.each([
    ["CLIENTE", "/app/inicio"],
    ["ASESOR", "/asesor/panel"],
    ["SUPERVISOR", "/supervisor/operacion"],
  ] as const)("maps %s to its home route", (role, expected) => {
    expect(homeForRole(role)).toBe(expected);
  });

  it("rejects a client from supervisor routes", () => {
    expect(isRoleAllowed("CLIENTE", ["SUPERVISOR"])).toBe(false);
  });
});
