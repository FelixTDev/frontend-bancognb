export function getSafeReturnTo(value: string | null | undefined): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return null;
  }

  try {
    const target = new URL(value, window.location.origin);
    if (
      target.origin !== window.location.origin ||
      ["/ingresar", "/registro", "/verificar-cuenta"].includes(
        target.pathname,
      )
    ) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function withReturnTo(path: string, returnTo: string | null): string {
  if (!returnTo) return path;
  const query = new URLSearchParams({ returnTo }).toString();
  return `${path}?${query}`;
}
