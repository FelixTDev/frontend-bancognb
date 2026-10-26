import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Ingresa tu nombre completo.").max(150),
  email: z.email("Ingresa un correo válido."),
  password: z
    .string()
    .min(8, "Usa al menos 8 caracteres.")
    .max(128)
    .regex(/[A-Z]/, "Incluye una mayúscula.")
    .regex(/[a-z]/, "Incluye una minúscula.")
    .regex(/[0-9]/, "Incluye un número."),
  phone: z.string().trim().max(30).optional(),
});

export const ticketSchema = z.object({
  category_id: z.string().min(1, "Selecciona una categoría."),
  subject: z
    .string()
    .trim()
    .min(3, "Describe brevemente tu solicitud.")
    .max(200),
  description: z.string().trim().min(5, "Cuéntanos un poco más.").max(10_000),
  priority: z.enum(["BAJA", "MEDIA", "ALTA", "URGENTE"]),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type TicketValues = z.infer<typeof ticketSchema>;
