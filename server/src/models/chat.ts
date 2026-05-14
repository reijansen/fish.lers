/**
 * Chat System Domain Models
 * 
 * Canonical types for conversations, messages, and read state.
 * Used by repositories, services, and API responses.
 */

/**
 * Conversation Types
 */
export type ConversationType = "support" | "escalation" | "staff";

/**
 * Conversation Status
 */
export type ConversationStatus = "active" | "closed";

/**
 * A conversation (support, escalation, or staff).
 * 
 * Support: `support:<studentUID>` - One per student, permanent until deleted
 * Escalation: `escalation:<adminUID>:<escalationID>` - Multiple per admin
 * Staff: `staff:admins` - Single group chat for admins + superAdmins
 */
export interface Conversation {
  conversationID: string;
  type: ConversationType;
  status: ConversationStatus;
  
  // For support conversations
  studentUID?: string;
  
  // For escalation conversations
  adminUID?: string;
  escalationID?: string;
  escalationReason?: string;

  // For staff group chat
  staffKey?: "admins";
  
  // Participants
  participants: string[]; // Array of user UIDs
  
  // Metadata
  messageCount: number;
  lastMessageAt: string; // ISO timestamp
  lastMessagePreview?: string;
  lastMessageSenderUID?: string;
  lastMessageSenderRole?: "student" | "admin" | "superAdmin";
  closedAt?: string; // ISO timestamp
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

/**
 * What fields can be updated by the client for a conversation.
 */
export type ConversationUpdateInput = Partial<
  Pick<
    Conversation,
    "status" | "escalationReason" | "participants" | "messageCount" | "lastMessageAt" | "lastMessagePreview" | "lastMessageSenderUID" | "lastMessageSenderRole" | "adminUID"
  >
>;

/**
 * What the API returns for a conversation.
 */
export interface ConversationResponse extends Conversation {
  conversationID: string;
}

/**
 * A message within a conversation.
 */
export interface ChatMessage {
  messageID: string;
  conversationID: string;
  senderUID: string;
  senderRole: "student" | "admin" | "superAdmin";
  content: string;
  
  // Idempotency
  idempotencyKey?: string;
  
  // Metadata
  createdAt: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
  deletedAt?: string | null; // Soft delete marker (ISO timestamp) or null
}

/**
 * Input for creating a new message.
 */
export interface CreateMessageInput {
  conversationID: string;
  senderUID: string;
  senderRole: "student" | "admin" | "superAdmin";
  content: string;
  idempotencyKey?: string;
}

/**
 * What the API returns for a message.
 */
export interface ChatMessageResponse extends ChatMessage {
  messageID: string;
}

/**
 * Conversation read state (placeholder for Phase 5).
 * Tracks which participants have read messages up to a certain point.
 */
export interface ConversationReadState {
  conversationID: string;
  userUID: string;
  readUpToMessageID?: string; // Last message read by this user
  readUpToTimestamp?: string; // ISO timestamp of last read message
  unreadCount: number;
  lastUpdatedAt: string; // ISO timestamp
}

/**
 * Cursor-based pagination metadata.
 */
export interface PaginationCursor {
  beforeTimestamp?: string; // ISO timestamp to fetch messages before
  limit: number;
}

/**
 * List response with pagination info.
 */
export interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: PaginationCursor;
}
