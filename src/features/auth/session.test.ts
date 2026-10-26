import { beforeEach, describe, expect, it } from "vitest";
import { clearSession, getSession, saveSession } from "./session";

describe("session storage", () => {
  beforeEach(() => localStorage.clear());

  it("restores only valid persisted sessions", () => {
    saveSession({
      token: "token",
      user: {
        id: "1",
        full_name: "Ana",
        email: "ana@example.com",
        role: "CLIENTE",
      },
    });
    expect(getSession()?.user.role).toBe("CLIENTE");
    clearSession();
    expect(getSession()).toBeNull();
  });

  it("rejects malformed storage content", () => {
    localStorage.setItem("gnb.session.v1", '{"token":42}');
    expect(getSession()).toBeNull();
  });
});
