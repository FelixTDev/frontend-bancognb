export type UserRole = "CLIENTE" | "ASESOR" | "SUPERVISOR";
export type TicketStatus =
  | "NUEVO"
  | "ASIGNADO"
  | "EN_PROCESO"
  | "PENDIENTE_CLIENTE"
  | "RESUELTO"
  | "CERRADO"
  | "CANCELADO";
export type TicketPriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

export interface PublicUser {
  readonly id: string;
  readonly full_name: string;
  readonly email: string;
  readonly role: UserRole;
}

export interface AuthSession {
  readonly token: string;
  readonly user: PublicUser;
}

export interface Ticket {
  readonly id: string;
  readonly tracking_code: string;
  readonly client_id: string;
  /** Human-readable fields available in newer backend contracts. */
  readonly client_name?: string | null;
  readonly conversation_id: string | null;
  readonly category_id: string;
  readonly subject: string;
  readonly description: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly source: "MANUAL" | "CHATBOT";
  readonly assigned_advisor_id: string | null;
  readonly assigned_advisor_name?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
  readonly assigned_at: string | null;
  readonly resolved_at: string | null;
  readonly closed_at: string | null;
  readonly cancelled_at: string | null;
}

export interface TicketHistoryEntry {
  readonly id: string;
  readonly ticket_id: string;
  readonly actor_id: string | null;
  readonly actor_name?: string | null;
  readonly actor_role?: string | null;
  readonly action: string;
  readonly old_value: string | null;
  readonly new_value: string | null;
  readonly description: string | null;
  readonly created_at: string;
}

export interface TicketSummaryReport {
  readonly total_tickets: number;
  readonly new_tickets: number;
  readonly assigned_tickets: number;
  readonly in_process_tickets: number;
  readonly pending_client_tickets: number;
  readonly resolved_tickets: number;
  readonly closed_tickets: number;
  readonly cancelled_tickets: number;
  readonly average_resolution_time_hours: number;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly is_active: boolean;
}

export interface Comment {
  readonly id: string;
  readonly ticket_id: string;
  readonly author_id: string;
  readonly author_name?: string | null;
  readonly author_role?: string | null;
  readonly content: string;
  readonly created_at: string;
}

export interface Attachment {
  readonly id: string;
  readonly ticket_id: string;
  readonly comment_id: string | null;
  readonly uploaded_by_user_id: string;
  readonly original_filename: string;
  readonly mime_type_declared: string;
  readonly mime_type_detected: string;
  readonly file_size: number;
  readonly status: string;
  readonly created_at: string;
  readonly deleted_at: string | null;
}

export interface Faq {
  readonly id: string;
  readonly category_id: string;
  readonly title: string;
  readonly question: string;
  readonly answer: string;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly status: string;
  readonly is_active: boolean;
  readonly version: number;
}

export interface PageResult<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly page_size: number;
  readonly pages?: number;
  readonly total_pages?: number;
}
