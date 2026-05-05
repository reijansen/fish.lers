/**
 * Chat Socket Protocol Types
 *
 * Shared contracts for payloads/acks for socket events.
 * Keep these minimal so client can mirror them easily.
 */

export type ChatSocketErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ChatSocketAck<T> =
  | { ok: true } & T
  | { ok: false; code: ChatSocketErrorCode; error: string };

export interface ConversationJoinPayload {
  conversationID: string;
}

export interface TypingPayload {
  conversationID: string;
  isTyping: boolean;
}

export interface ReadPayload {
  conversationID: string;
  readUpToMessageID: string;
}

