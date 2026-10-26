const activeConversationKey = "gnb.chat.conversation.v1";
const pendingTicketConversionKey = "gnb.chat.ticket-draft.v1";

export function getActiveConversationId(): string | null {
  try {
    return window.sessionStorage.getItem(activeConversationKey) || null;
  } catch {
    return null;
  }
}

export function saveActiveConversationId(conversationId: string): void {
  try {
    window.sessionStorage.setItem(activeConversationKey, conversationId);
  } catch {
    // The conversation can still continue in memory if storage is unavailable.
  }
}

export function removeActiveConversationId(): void {
  try {
    window.sessionStorage.removeItem(activeConversationKey);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function prepareTicketConversionReturn(conversationId: string): void {
  try {
    window.sessionStorage.setItem(activeConversationKey, conversationId);
    window.sessionStorage.setItem(pendingTicketConversionKey, conversationId);
  } catch {
    // Do not block authentication if the browser has disabled session storage.
  }
}

export function getPendingTicketConversionId(): string | null {
  try {
    const pendingId = window.sessionStorage.getItem(pendingTicketConversionKey);
    return pendingId === getActiveConversationId() ? pendingId : null;
  } catch {
    return null;
  }
}

export function clearPendingTicketConversion(conversationId?: string): void {
  try {
    const pendingId = window.sessionStorage.getItem(pendingTicketConversionKey);
    if (!conversationId || pendingId === conversationId) {
      window.sessionStorage.removeItem(pendingTicketConversionKey);
    }
  } catch {
    // Ignore unavailable browser storage.
  }
}
