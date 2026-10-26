import type { TicketPriority } from "./types/domain";

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

export function formatCategoryDisplayName(name: string): string {
  return name
    .replace(/_+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.slice(0, 1).toLocaleUpperCase("es-PE") +
        word.slice(1).toLocaleLowerCase("es-PE"),
    )
    .join(" ");
}
