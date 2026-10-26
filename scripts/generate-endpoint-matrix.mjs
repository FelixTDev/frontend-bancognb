import { mkdir, writeFile } from "node:fs/promises";

const response = await fetch("http://127.0.0.1:8000/openapi.json");
if (!response.ok) throw new Error(`OpenAPI unavailable: ${response.status}`);
const spec = await response.json();

const routeFor = (path, method) => {
  if (path.includes("/auth/login")) return ["/ingresar", "Público"];
  if (path.includes("/auth/register") || path.includes("verify-email"))
    return ["/registro · /verificar-cuenta", "Público"];
  if (path.includes("forgot-password") || path.includes("reset-password"))
    return ["/recuperar-acceso · /restablecer-acceso", "Público"];
  if (path.includes("change-password"))
    return ["/app/perfil", "Cliente, Asesor, Supervisor"];
  if (path.includes("/auth/me") || path.includes("/auth/logout"))
    return ["Shell autenticado", "Cliente, Asesor, Supervisor"];
  if (path.includes("/users/me/"))
    return ["/app/perfil", "Cliente, Asesor, Supervisor"];
  if (path.includes("/users/advisors"))
    return ["/supervisor/asignaciones · detalle", "Supervisor"];
  if (path.includes("/categories"))
    return method === "get"
      ? ["Alta de solicitud · FAQ · contenido", "Público, Cliente, Supervisor"]
      : ["/supervisor/contenido", "Supervisor"];
  if (path.includes("/faqs/admin"))
    return ["/supervisor/contenido", "Supervisor"];
  if (path.includes("/faqs") && method === "get")
    return [
      "FAQ pública · FAQ cliente · conocimiento · contenido",
      "Público, Cliente, Asesor, Supervisor",
    ];
  if (path.includes("/faqs"))
    return [
      "FAQ cliente · /supervisor/contenido",
      path.includes("feedback") ? "Cliente" : "Supervisor",
    ];
  if (path.includes("/chat/")) return ["/app/asistente", "Cliente"];
  if (
    path.includes("/attachments/") ||
    path.includes("/tickets/{ticket_id}/attachments")
  )
    return ["Detalle de solicitud", "Cliente, Asesor, Supervisor"];
  if (path.includes("/tickets/mine"))
    return ["Inicio · solicitudes cliente", "Cliente"];
  if (path.includes("/tickets/operations"))
    return ["Panel y cola operativa", "Asesor, Supervisor"];
  if (path === "/api/v1/tickets" && method === "post")
    return ["/app/nueva-solicitud", "Cliente"];
  if (path.includes("/tickets/{ticket_id}/assignments"))
    return ["Asignaciones · detalle", "Supervisor"];
  if (path.includes("/tickets/{ticket_id}/take") || path.includes("/release"))
    return ["Detalle de ticket", "Asesor"];
  if (path.includes("/sla/pause") || path.includes("/sla/resume"))
    return ["Detalle de ticket", "Supervisor"];
  if (path.includes("/tickets"))
    return [
      "Listado · detalle de ticket",
      "Cliente, Asesor, Supervisor según operación",
    ];
  if (path.includes("/notifications"))
    return ["Cabecera del portal", "Cliente, Asesor, Supervisor"];
  if (path.includes("/sla/")) return ["/supervisor/sla", "Supervisor"];
  if (path.includes("/reports/"))
    return ["/supervisor/reportes · operación", "Supervisor"];
  if (path.includes("/audit")) return ["/supervisor/auditoria", "Supervisor"];
  if (path.includes("/health"))
    return ["Diagnóstico de despliegue", "Operación técnica"];
  return ["Integración transversal", "Según RBAC del backend"];
};

const rows = [];
for (const [path, operations] of Object.entries(spec.paths)) {
  for (const [method, operation] of Object.entries(operations)) {
    if (!["get", "post", "put", "patch", "delete"].includes(method)) continue;
    const [screen, role] = routeFor(path, method);
    rows.push({
      method: method.toUpperCase(),
      path,
      summary: operation.summary ?? operation.operationId ?? "—",
      screen,
      role,
      status: path.includes("/health") ? "Diagnóstico" : "Integrado",
    });
  }
}
rows.sort(
  (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
);

const lines = [
  "# Matriz de endpoints, pantallas y roles",
  "",
  "> Generada desde `http://localhost:8000/openapi.json`. El backend conserva la autoridad final de permisos; la columna de rol documenta la superficie del frontend.",
  "",
  "| Método | Endpoint | Pantalla/flujo | Rol de interfaz | Estado |",
  "|---|---|---|---|---|",
  ...rows.map(
    (row) =>
      `| ${row.method} | \`${row.path}\` | ${row.screen} | ${row.role} | ${row.status} |`,
  ),
  "",
  `Total: ${rows.length} operaciones documentadas.`,
  "",
];
await mkdir("docs", { recursive: true });
await writeFile("docs/endpoint-matrix.md", lines.join("\n"));
console.log(`Generated ${rows.length} endpoint rows.`);
