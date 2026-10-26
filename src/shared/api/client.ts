import { clearSession, getSession } from "../../features/auth/session";
import { createHttpClient } from "./http";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "http://localhost:8000/api/v1";

export const http = createHttpClient({
  baseUrl: API_BASE_URL,
  getToken: () => getSession()?.token ?? null,
  onUnauthorized: () => {
    clearSession();
    window.dispatchEvent(new CustomEvent("gnb:unauthorized"));
  },
});

export const queryString = (
  values: Readonly<
    Record<string, string | number | boolean | null | undefined>
  >,
): string => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
};
