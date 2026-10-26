import { describe, expect, it } from "vitest";
import { loginSchema, ticketSchema } from "./validation";

describe("form validation", () => {
  it("requires a valid login email and a password", () => {
    expect(
      loginSchema.safeParse({ email: "incorrecto", password: "" }).success,
    ).toBe(false);
  });

  it("accepts ticket fields that respect the backend contract", () => {
    expect(
      ticketSchema.safeParse({
        category_id: "cat-1",
        subject: "Consulta de atención",
        description: "Necesito orientación sobre mi solicitud.",
        priority: "MEDIA",
      }).success,
    ).toBe(true);
  });
});
