import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPendingTicketConversion,
  getActiveConversationId,
  getPendingTicketConversionId,
  prepareTicketConversionReturn,
  saveActiveConversationId,
} from "./assistant-conversation.storage";

describe("assistant conversation session storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("keeps only the active conversation id and pending conversion marker", () => {
    prepareTicketConversionReturn("conversation-for-auth");

    expect(getActiveConversationId()).toBe("conversation-for-auth");
    expect(getPendingTicketConversionId()).toBe("conversation-for-auth");
    expect(Object.values(window.sessionStorage)).toEqual([
      "conversation-for-auth",
      "conversation-for-auth",
    ]);
  });

  it("ignores a pending conversion for another active conversation", () => {
    prepareTicketConversionReturn("conversation-before-restart");
    saveActiveConversationId("conversation-after-restart");

    expect(getPendingTicketConversionId()).toBeNull();
  });

  it("clears only the matching pending marker", () => {
    prepareTicketConversionReturn("conversation-for-auth");
    clearPendingTicketConversion("another-conversation");
    expect(getPendingTicketConversionId()).toBe("conversation-for-auth");

    clearPendingTicketConversion("conversation-for-auth");
    expect(getActiveConversationId()).toBe("conversation-for-auth");
    expect(getPendingTicketConversionId()).toBeNull();
  });
});
