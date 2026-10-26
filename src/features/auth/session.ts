import { z } from "zod";
import type { AuthSession } from "../../shared/types/domain";

const SESSION_KEY = "gnb.session.v1";
const sessionSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    full_name: z.string().min(1),
    email: z.email(),
    role: z.enum(["CLIENTE", "ASESOR", "SUPERVISOR"]),
  }),
});

export function getSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = sessionSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}
