import type {
  AuthSession,
  Attachment,
  Category,
  Comment,
  Faq,
  PageResult,
  PublicUser,
  Ticket,
  TicketHistoryEntry,
  TicketSummaryReport,
  TicketStatus,
} from "../types/domain";
import { API_BASE_URL, http, queryString } from "./client";
import { ApiError, type ApiErrorPayload } from "./http";
import type { components } from "./openapi";

type ApiSchemas = components["schemas"];

export interface LoginResponse extends AuthSession {
  readonly access_token: string;
}
export interface Profile {
  readonly full_name: string;
  readonly email: string;
  readonly phone?: string | null;
  readonly role: string;
  readonly is_active: boolean;
}
export interface Preference {
  readonly in_app_notifications: boolean;
  readonly email_notifications: boolean;
  readonly timezone: string;
}
export interface NotificationItem {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly is_read: boolean;
  readonly created_at: string;
  readonly related_ticket_id?: string | null;
  readonly type: string;
}
export type ChatMessage = ApiSchemas["ChatMessageRead"];
export type Conversation = ApiSchemas["ConversationRead"];
export type BotMessageResponse = ApiSchemas["BotMessageResponse"];
export type ChatbotSuggestedAction = ApiSchemas["ChatbotSuggestedAction"];
export type ChatbotSource = ApiSchemas["ChatbotSource"];
export type ChatbotUI = ApiSchemas["ChatbotUI"];
export type ChatbotUIOption = ApiSchemas["ChatbotUIOption"];
export type ChatFeedback = ApiSchemas["ChatFeedbackRead"];
export type ChatMessageCreateInput = ApiSchemas["MessageCreate"];
export type TicketCreateInput = ApiSchemas["TicketCreate"];
export type ChatTicket = ApiSchemas["TicketRead"];
export type ChatbotTicketDraft = ApiSchemas["ChatbotTicketDraft"];
export type ChatbotTicketDraftField = ApiSchemas["ChatbotTicketDraftField"];
export type ChatbotConvertedTicketSummary =
  ApiSchemas["ChatbotConvertedTicketSummary"];
export type LinkedConversation = ApiSchemas["LinkConversationResponse"];
export type SlaInfo = ApiSchemas["TicketSlaRead"];
export interface AuditItem {
  readonly action: string;
  readonly resource_type: string;
  readonly actor_role: string | null;
  readonly occurred_at: string;
  readonly success: boolean;
  readonly request_id: string | null;
  readonly error_code: string | null;
}

const data = async <T>(
  promise: ReturnType<typeof http.request<T>>,
): Promise<T> => (await promise).data;

export const api = {
  auth: {
    register: (body: Readonly<Record<string, unknown>>) =>
      data<PublicUser>(
        http.request("/auth/register", { method: "POST", body }),
      ),
    login: async (body: {
      readonly email: string;
      readonly password: string;
    }): Promise<AuthSession> => {
      const response = await data<{
        readonly access_token: string;
        readonly user: PublicUser;
      }>(http.request("/auth/login", { method: "POST", body }));
      return { token: response.access_token, user: response.user };
    },
    me: () => data<PublicUser>(http.request("/auth/me")),
    logout: () =>
      data<unknown>(http.request("/auth/logout", { method: "POST" })),
    forgotPassword: (email: string) =>
      data<unknown>(
        http.request("/auth/forgot-password", {
          method: "POST",
          body: { email },
        }),
      ),
    resetPassword: (body: {
      readonly token: string;
      readonly new_password: string;
    }) =>
      data<unknown>(
        http.request("/auth/reset-password", { method: "POST", body }),
      ),
    changePassword: (body: {
      readonly current_password: string;
      readonly new_password: string;
    }) =>
      data<unknown>(
        http.request("/auth/change-password", { method: "POST", body }),
      ),
    verifyEmail: (token: string) =>
      data<unknown>(
        http.request("/auth/verify-email", { method: "POST", body: { token } }),
      ),
  },
  users: {
    advisors: () =>
      data<readonly PublicUser[]>(http.request("/users/advisors")),
    profile: () => data<Profile>(http.request("/users/me/profile")),
    updateProfile: (body: Readonly<Record<string, unknown>>) =>
      data<Profile>(
        http.request("/users/me/profile", { method: "PATCH", body }),
      ),
    preferences: () => data<Preference>(http.request("/users/me/preferences")),
    updatePreferences: (body: Partial<Preference>) =>
      data<Preference>(
        http.request("/users/me/preferences", { method: "PATCH", body }),
      ),
  },
  categories: {
    list: () => data<readonly Category[]>(http.request("/categories")),
    create: (body: Readonly<Record<string, unknown>>) =>
      data<Category>(http.request("/categories", { method: "POST", body })),
    update: (id: string, body: Readonly<Record<string, unknown>>) =>
      data<Category>(
        http.request(`/categories/${id}`, { method: "PATCH", body }),
      ),
    setStatus: (id: string, isActive: boolean) =>
      data<Category>(
        http.request(`/categories/${id}/status`, {
          method: "PATCH",
          body: { is_active: isActive },
        }),
      ),
  },
  faqs: {
    list: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) =>
      data<readonly Faq[] | PageResult<Faq>>(
        http.request(`/faqs${queryString(params)}`),
      ),
    get: (id: string) => data<Faq>(http.request(`/faqs/${id}`)),
    create: (body: Readonly<Record<string, unknown>>) =>
      data<Faq>(http.request("/faqs", { method: "POST", body })),
    update: (id: string, body: Readonly<Record<string, unknown>>) =>
      data<Faq>(http.request(`/faqs/${id}`, { method: "PATCH", body })),
    admin: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) => data<unknown>(http.request(`/faqs/admin${queryString(params)}`)),
    metrics: () => data<unknown>(http.request("/faqs/admin/metrics/utility")),
    history: (id: string) => data<unknown>(http.request(`/faqs/${id}/history`)),
    feedback: (id: string, body: Readonly<Record<string, unknown>>) =>
      data<unknown>(
        http.request(`/faqs/${id}/feedback`, { method: "POST", body }),
      ),
    workflow: (id: string, status: string) =>
      data<Faq>(
        http.request(`/faqs/${id}/workflow`, {
          method: "PATCH",
          body: { status },
        }),
      ),
    setStatus: (id: string, isActive: boolean) =>
      data<Faq>(
        http.request(`/faqs/${id}/status`, {
          method: "PATCH",
          body: { is_active: isActive },
        }),
      ),
  },
  chat: {
    create: () =>
      data<Conversation>(
        http.request("/chat/conversations", { method: "POST", body: {} }),
      ),
    get: (id: string) =>
      data<Conversation>(http.request(`/chat/conversations/${id}`)),
    message: (id: string, body: ChatMessageCreateInput) =>
      data<BotMessageResponse>(
        http.request(`/chat/conversations/${id}/messages`, {
          method: "POST",
          body,
        }),
      ),
    escalate: (id: string, reason: string) =>
      data<Conversation>(
        http.request(`/chat/conversations/${id}/escalate`, {
          method: "POST",
          body: { reason },
        }),
      ),
    reset: (id: string) =>
      data<Conversation>(
        http.request(`/chat/conversations/${id}/reset`, {
          method: "POST",
          body: {},
        }),
      ),
    feedback: (
      id: string,
      body: {
        readonly is_helpful: boolean;
        readonly escalation_accepted?: boolean | null;
        readonly reason?: string | null;
      },
    ) =>
      data<ChatFeedback>(
        http.request(`/chat/conversations/${id}/feedback`, {
          method: "POST",
          body,
        }),
      ),
    link: (id: string) =>
      data<LinkedConversation>(
        http.request(`/chat/conversations/${id}/link-user`, { method: "POST" }),
      ),
    convert: (id: string, body: TicketCreateInput) =>
      data<ChatTicket>(
        http.request(`/chat/conversations/${id}/convert-to-ticket`, {
          method: "POST",
          body,
        }),
      ),
  },
  tickets: {
    create: (body: Readonly<Record<string, unknown>>) =>
      data<Ticket>(http.request("/tickets", { method: "POST", body })),
    list: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) =>
      data<readonly Ticket[] | PageResult<Ticket>>(
        http.request(`/tickets${queryString(params)}`),
      ),
    mine: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) =>
      data<readonly Ticket[] | PageResult<Ticket>>(
        http.request(`/tickets/mine${queryString(params)}`),
      ),
    operations: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) =>
      data<PageResult<Ticket>>(
        http.request(`/tickets/operations${queryString(params)}`),
      ),
    get: (id: string) => data<Ticket>(http.request(`/tickets/${id}`)),
    comments: (id: string) =>
      data<readonly Comment[]>(http.request(`/tickets/${id}/comments`)),
    comment: (id: string, content: string, expectedVersion?: number) =>
      data<Comment>(
        http.request(`/tickets/${id}/comments`, {
          method: "POST",
          body: { content, expected_version: expectedVersion },
        }),
      ),
    changeStatus: (
      id: string,
      status: TicketStatus,
      reason?: string,
      expectedVersion?: number,
    ) =>
      data<Ticket>(
        http.request(`/tickets/${id}/status`, {
          method: "POST",
          body: { status, reason, expected_version: expectedVersion },
        }),
      ),
    assign: (id: string, advisorId: string, expectedVersion?: number) =>
      data<Ticket>(
        http.request(`/tickets/${id}/assignments`, {
          method: "POST",
          body: { advisor_id: advisorId, expected_version: expectedVersion },
        }),
      ),
    take: (id: string, expectedVersion?: number) =>
      data<Ticket>(
        http.request(`/tickets/${id}/take`, {
          method: "POST",
          body: { expected_version: expectedVersion },
        }),
      ),
    release: (id: string, reason: string, expectedVersion?: number) =>
      data<Ticket>(
        http.request(`/tickets/${id}/release`, {
          method: "POST",
          body: { reason, expected_version: expectedVersion },
        }),
      ),
    history: (id: string) =>
      data<readonly TicketHistoryEntry[]>(
        http.request(`/tickets/${id}/history`),
      ),
    close: (id: string, reason?: string) =>
      data<Ticket>(
        http.request(`/tickets/${id}/close`, {
          method: "POST",
          body: { reason },
        }),
      ),
    reopen: (id: string, reason: string, expectedVersion?: number) =>
      data<Ticket>(
        http.request(`/tickets/${id}/reopen`, {
          method: "POST",
          body: { reason, expected_version: expectedVersion },
        }),
      ),
    cancel: (id: string, reason: string, expectedVersion?: number) =>
      data<Ticket>(
        http.request(`/tickets/${id}/cancel`, {
          method: "POST",
          body: { reason, expected_version: expectedVersion },
        }),
      ),
    sla: (id: string) => data<SlaInfo>(http.request(`/tickets/${id}/sla`)),
    pauseSla: (id: string, reason: string) =>
      data<SlaInfo>(
        http.request(`/tickets/${id}/sla/pause`, {
          method: "POST",
          body: { reason },
        }),
      ),
    resumeSla: (id: string, reason: string) =>
      data<SlaInfo>(
        http.request(`/tickets/${id}/sla/resume`, {
          method: "POST",
          body: { reason },
        }),
      ),
    attachments: (id: string) =>
      data<readonly Attachment[]>(http.request(`/tickets/${id}/attachments`)),
    deleteAttachment: (id: string) =>
      data<unknown>(http.request(`/attachments/${id}`, { method: "DELETE" })),
    downloadAttachment: (id: string) =>
      http.request<Blob>(`/attachments/${id}/download`),
  },
  notifications: {
    list: (
      params: Readonly<
        Record<string, string | number | boolean | undefined>
      > = {},
    ) =>
      data<PageResult<NotificationItem>>(
        http.request(`/notifications${queryString(params)}`),
      ),
    unreadCount: () =>
      data<{ readonly unread_count: number }>(
        http.request("/notifications/unread-count"),
      ),
    markRead: (id: string) =>
      data<NotificationItem>(
        http.request(`/notifications/${id}/read`, { method: "PATCH" }),
      ),
    readAll: () =>
      data<unknown>(
        http.request("/notifications/read-all", { method: "POST" }),
      ),
  },
  sla: {
    evaluate: () =>
      data<unknown>(http.request("/sla/evaluate", { method: "POST" })),
    policies: () => data<unknown>(http.request("/sla/policies")),
    createPolicy: (body: Readonly<Record<string, unknown>>) =>
      data<unknown>(http.request("/sla/policies", { method: "POST", body })),
    updatePolicy: (id: string, body: Readonly<Record<string, unknown>>) =>
      data<unknown>(
        http.request(`/sla/policies/${id}`, { method: "PATCH", body }),
      ),
  },
  reports: {
    summary: (params: Readonly<Record<string, string | undefined>> = {}) =>
      data<TicketSummaryReport>(
        http.request(`/reports/summary${queryString(params)}`),
      ),
    byStatus: (params: Readonly<Record<string, string | undefined>> = {}) =>
      data<unknown>(http.request(`/reports/by-status${queryString(params)}`)),
    byCategory: (params: Readonly<Record<string, string | undefined>> = {}) =>
      data<unknown>(http.request(`/reports/by-category${queryString(params)}`)),
    byPriority: (params: Readonly<Record<string, string | undefined>> = {}) =>
      data<unknown>(http.request(`/reports/by-priority${queryString(params)}`)),
    resolutionTime: (
      params: Readonly<Record<string, string | undefined>> = {},
    ) =>
      data<unknown>(
        http.request(`/reports/resolution-time${queryString(params)}`),
      ),
    export: (
      name: string,
      params: Readonly<Record<string, string | undefined>> = {},
    ) => http.request<Blob>(`/reports/${name}/export${queryString(params)}`),
  },
  audit: {
    list: (
      params: Readonly<Record<string, string | number | undefined>> = {},
    ) =>
      data<PageResult<AuditItem>>(http.request(`/audit${queryString(params)}`)),
  },
};

export function uploadAttachment(
  ticketId: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/tickets/${ticketId}/attachments`);
    xhr.responseType = "json";
    xhr.setRequestHeader("X-Request-ID", crypto.randomUUID());
    const token = localStorage.getItem("gnb.session.v1");
    if (token) {
      try {
        const parsed = JSON.parse(token) as { token?: string };
        if (parsed.token)
          xhr.setRequestHeader("Authorization", `Bearer ${parsed.token}`);
      } catch {
        /* invalid storage is cleared by session restoration */
      }
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300)
        resolve(xhr.response as Attachment);
      else {
        const payload = (xhr.response ?? {}) as ApiErrorPayload;
        reject(
          new ApiError({
            status: xhr.status,
            payload: {
              code: payload.code ?? `HTTP_${xhr.status}`,
              message: payload.message ?? "No pudimos adjuntar el archivo.",
              details: payload.details,
              request_id: payload.request_id,
            },
            requestId: xhr.getResponseHeader("X-Request-ID"),
          }),
        );
      }
    });
    xhr.addEventListener("error", () =>
      reject(
        new ApiError({
          status: 0,
          payload: {
            code: "NETWORK_ERROR",
            message: "No pudimos cargar el archivo.",
          },
          requestId: null,
        }),
      ),
    );
    const body = new FormData();
    body.append("file", file);
    xhr.send(body);
  });
}
