/**
 * Chat Data Service
 * 
 * Business logic layer for chat conversations and messages.
 * Does NOT directly access Firestore; uses ChatRepository instead.
 * 
 * Purpose:
 * - Deterministic conversation ID generation
 * - Permission checks (who can access what)
 * - Input validation (length, content safety)
 * - High-level conversation/message operations
 */

import { ChatRepository } from "../repositories/chat.repo.js";
import { UserRepository } from "../repositories/users.repo.js";
import {
  Conversation,
  ConversationType,
  ChatMessage,
  CreateMessageInput,
  PaginatedResponse,
  PaginationCursor,
} from "../models/chat.js";
import { v4 as uuidv4 } from "uuid";

/**
 * User role information (from Firebase custom claims).
 */
export interface UserRole {
  uid: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * Chat Data Service.
 * Contains business logic for chat operations.
 */
export class ChatDataService {
  static readonly STAFF_ADMINS_CONVERSATION_ID = "staff:admins";
  // ========================================================================
  // CONVERSATION ID HELPERS (Deterministic)
  // ========================================================================

  /**
   * Generate deterministic conversation ID for student support.
   * Format: `support:<studentUID>:<adminUID>`
   * 
   * Deterministic: Always the same for a given student-admin pair.
   */
  static generateSupportConversationID(studentUID: string, adminUID?: string): string {
    return adminUID ? `support:${studentUID}:${adminUID}` : `support:${studentUID}`;
  }

  /**
   * Generate conversation ID for admin escalation.
   * Format: `escalation:<adminUID>:<escalationID>`
   * 
   * Deterministic admin part + random escalation ID.
   * Each escalation creates a new conversation visible to all superAdmins.
   */
  static generateEscalationConversationID(adminUID: string): string {
    const escalationID = uuidv4();
    return `escalation:${adminUID}:${escalationID}`;
  }

  /**
   * Generate deterministic conversation ID for staff group chat.
   * Format: `staff:admins`
   *
   * Single shared room for admins + superAdmins.
   */
  static generateStaffConversationID(): string {
    return ChatDataService.STAFF_ADMINS_CONVERSATION_ID;
  }

  /**
   * Parse a conversation ID to extract type and components.
   */
  static parseConversationID(
    conversationID: string
  ): {
    type: ConversationType;
    studentUID?: string;
    adminUID?: string;
    escalationID?: string;
    staffKey?: "admins";
  } | null {
    if (conversationID.startsWith("support:")) {
      const parts = conversationID.split(":");
      if (parts.length === 2) {
        const studentUID = parts[1];
        return { type: "support", studentUID };
      }
      if (parts.length === 3) {
        const studentUID = parts[1];
        const adminUID = parts[2];
        return { type: "support", studentUID, adminUID };
      }
    }

    if (conversationID.startsWith("escalation:")) {
      const parts = conversationID.split(":");
      if (parts.length === 3) {
        const adminUID = parts[1];
        const escalationID = parts[2];
        return { type: "escalation", adminUID, escalationID };
      }
    }

    if (conversationID === ChatDataService.STAFF_ADMINS_CONVERSATION_ID) {
      return { type: "staff", staffKey: "admins" };
    }

    return null;
  }

  // ========================================================================
  // PERMISSION CHECKS
  // ========================================================================

  /**
   * Check if a user can access (read) a conversation based on their role.
   * 
   * Rules:
   * - Students can only access their own support conversation
   * - Admins can access all support conversations + their own escalations
   * - SuperAdmins can access all conversations
   * - Closed conversations are readable by anyone who could read it before closing
   */
  static canUserAccessConversation(
    user: UserRole,
    conversation: Conversation
  ): boolean {
    // Support conversation: student owns it, or any admin
    if (conversation.type === "support") {
      if (user.uid === conversation.studentUID) {
        return true;
      }
      if (user.isAdmin && !user.isSuperAdmin) {
        if (!conversation.adminUID) return true;
        return conversation.adminUID === user.uid;
      }
      return false;
    }

    // Escalation conversation: admin who created it, or any superAdmin
    if (conversation.type === "escalation") {
      if (user.isSuperAdmin) {
        return true;
      }
      if (user.uid === conversation.adminUID) {
        return true;
      }
      return false;
    }

    // Staff conversation is shared by admins and superAdmins.
    if (conversation.type === "staff") {
      return user.isAdmin || user.isSuperAdmin;
    }

    return false;
  }

  /**
   * Check if a user can write to a conversation (send a message).
   * 
   * Rules:
   * - Students can write to their own support conversation (if active)
   * - Admins/SuperAdmins can write to any accessible conversation (if active)
   * - No one can write to closed conversations
   */
  static canUserWriteToConversation(
    user: UserRole,
    conversation: Conversation
  ): boolean {
    // Closed conversations are read-only
    if (conversation.status === "closed") {
      return false;
    }

    // Check read access first
    if (!this.canUserAccessConversation(user, conversation)) {
      return false;
    }

    // Students can only write to support conversations
    if (!user.isAdmin && !user.isSuperAdmin) {
      return conversation.type === "support" && user.uid === conversation.studentUID;
    }

    // Admins/SuperAdmins can write to any conversation they can read
    return true;
  }

  /**
   * Check if a user can escalate a support conversation.
   * Only admins (not superAdmins) can escalate.
   */
  static canUserEscalate(user: UserRole): boolean {
    return user.isAdmin && !user.isSuperAdmin;
  }

  /**
   * Check if a user can close a conversation.
   * Only admins and superAdmins can close.
   */
  static canUserCloseConversation(user: UserRole): boolean {
    return user.isAdmin || user.isSuperAdmin;
  }

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate message content.
   * - Non-empty
   * - Max 5000 characters
   * - No null bytes (XSS prevention)
   */
  static validateMessageContent(content: string): { valid: boolean; error?: string } {
    if (!content || typeof content !== "string") {
      return { valid: false, error: "Message content is required" };
    }

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: "Message cannot be empty" };
    }

    if (trimmed.length > 5000) {
      return { valid: false, error: "Message exceeds 5000 character limit" };
    }

    if (trimmed.includes("\x00")) {
      return { valid: false, error: "Message contains invalid characters" };
    }

    return { valid: true };
  }

  /**
   * Validate escalation reason.
   * - Non-empty
   * - Max 500 characters
   */
  static validateEscalationReason(reason: string): { valid: boolean; error?: string } {
    if (!reason || typeof reason !== "string") {
      return { valid: false, error: "Escalation reason is required" };
    }

    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      return { valid: false, error: "Escalation reason cannot be empty" };
    }

    if (trimmed.length > 500) {
      return { valid: false, error: "Escalation reason exceeds 500 character limit" };
    }

    return { valid: true };
  }

  // ========================================================================
  // HIGH-LEVEL OPERATIONS
  // ========================================================================

  /**
   * Get or create a support conversation for a student.
   * Creates if it doesn't exist; idempotent.
   */
  static async getOrCreateSupportConversation(
    studentUID: string,
    adminUID?: string
  ): Promise<Conversation> {
    const conversationID = this.generateSupportConversationID(studentUID, adminUID);
    console.log(`[ChatDataService] Getting or creating support conversation for ${studentUID} (ID: ${conversationID})`);
    let conversation = await ChatRepository.getConversation(conversationID);

    if (!conversation) {
      // Create new support conversation
      const now = new Date().toISOString();
      console.log(`[ChatDataService] Creating new support conversation: ${conversationID}`);
      conversation = await ChatRepository.upsertConversation(conversationID, {
        conversationID,
        type: "support",
        status: "active",
        studentUID,
        adminUID,
        participants: adminUID ? [studentUID, adminUID] : [studentUID],
        messageCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`[ChatDataService] Created support conversation:`, conversation);
    } else {
      console.log(`[ChatDataService] Support conversation already exists:`, conversation);
    }

    return conversation;
  }

  /**
   * Get or create the staff group chat for admins + superAdmins.
   */
  static async getOrCreateStaffAdminsConversation(): Promise<Conversation> {
    const conversationID = this.generateStaffConversationID();
    let conversation = await ChatRepository.getConversation(conversationID);

    if (!conversation) {
      const now = new Date().toISOString();
      conversation = await ChatRepository.upsertConversation(conversationID, {
        conversationID,
        type: "staff",
        status: "active",
        staffKey: "admins",
        participants: [],
        messageCount: 0,
        lastMessageAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    return conversation;
  }

  /**
   * Create an escalation conversation.
   * Called by an admin to escalate to superAdmins.
   */
  static async createEscalationConversation(
    adminUID: string,
    studentSupportConversationID: string,
    reason: string
  ): Promise<Conversation> {
    // Validate reason
    const validation = this.validateEscalationReason(reason);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const conversationID = this.generateEscalationConversationID(adminUID);
    const now = new Date().toISOString();

    const escalation = await ChatRepository.upsertConversation(conversationID, {
      conversationID,
      type: "escalation",
      status: "active",
      adminUID,
      escalationReason: reason,
      participants: [adminUID], // SuperAdmins will see it automatically
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return escalation;
  }

  /**
   * Add a message to a conversation with validation.
   */
  static async addMessageToConversation(
    conversationID: string,
    senderUID: string,
    senderRole: "student" | "admin" | "superAdmin",
    content: string,
    idempotencyKey?: string
  ): Promise<ChatMessage> {
    // Validate message content
    const validation = this.validateMessageContent(content);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Check for duplicates by idempotency key
    if (idempotencyKey) {
      const existing = await ChatRepository.messageExistsByIdempotencyKey(
        conversationID,
        idempotencyKey
      );
      if (existing) {
        return existing;
      }
    }

    // Add the message
    const message = await ChatRepository.addMessage({
      conversationID,
      senderUID,
      senderRole,
      content: content.trim(),
      idempotencyKey,
    });

    return message;
  }

  /**
   * Get messages in a conversation with pagination.
   */
  static async getConversationMessages(
    conversationID: string,
    cursor?: PaginationCursor
  ): Promise<PaginatedResponse<ChatMessage>> {
    return ChatRepository.getMessages(conversationID, cursor);
  }

  /**
   * Get inbox conversations for a user based on their role.
   * 
   * Students: their support conversation only
   * Admins: all support conversations + their escalations
   * SuperAdmins: all conversations
   */
  static async getConversationsForUser(user: UserRole): Promise<Conversation[]> {
    if (user.isSuperAdmin) {
      return ChatRepository.getSuperAdminConversations(user.uid);
    }

    if (user.isAdmin) {
      return ChatRepository.getAdminConversations(user.uid);
    }

    // Student
    return ChatRepository.getStudentConversations(user.uid);
  }

  /**
   * Close a conversation (mark as closed).
   * Only admins and superAdmins can do this.
   */
  static async closeConversation(conversationID: string): Promise<void> {
    const conversation = await ChatRepository.getConversation(conversationID);
    if (!conversation) {
      throw new Error(`Conversation ${conversationID} not found`);
    }

    await ChatRepository.updateConversation(conversationID, {
      status: "closed",
    });
  }

  /**
   * Delete a message (soft delete).
   */
  static async deleteMessage(
    conversationID: string,
    messageID: string
  ): Promise<void> {
    await ChatRepository.deleteMessage(conversationID, messageID);
  }

  /**
   * Update read state for a user (Phase 5 placeholder).
   */
  static async markConversationAsRead(
    conversationID: string,
    userUID: string,
    readUpToMessageID: string
  ): Promise<void> {
    const message = await ChatRepository.getMessageById(conversationID, readUpToMessageID);
    if (!message) {
      throw new Error("Invalid readUpToMessageID");
    }

    const existing = await ChatRepository.getReadState(conversationID, userUID);
    if (existing?.readUpToTimestamp) {
      // Enforce monotonic reads by timestamp
      const prev = new Date(existing.readUpToTimestamp).getTime();
      const next = new Date(message.createdAt).getTime();
      if (Number.isFinite(prev) && Number.isFinite(next) && next < prev) {
        // Ignore older read cursor
        return;
      }
    }

    await ChatRepository.updateReadState(conversationID, userUID, readUpToMessageID, message.createdAt);
  }

  /**
   * Create a direct escalation conversation (admin -> superAdmins).
   * Used by UI "New Chat" flows; not tied to a specific support conversation.
   */
  static async createDirectEscalationConversation(
    adminUID: string,
    reason: string
  ): Promise<Conversation> {
    const validation = this.validateEscalationReason(reason);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Reuse an existing active escalation thread for this admin to avoid duplicates.
    const existing = await ChatRepository.getLatestActiveEscalationForAdmin(adminUID);
    if (existing) {
      return existing;
    }

    const conversationID = this.generateEscalationConversationID(adminUID);
    const now = new Date().toISOString();

    // Include super admins as participants so escalations show up in their inbox after reload.
    // (Privacy: escalations are intended for the super admin group.)
    const superAdmins = await UserRepository.listSuperAdmins(50);
    const participantUIDs = Array.from(new Set([adminUID, ...superAdmins.map((u) => u.uid)]));

    return ChatRepository.upsertConversation(conversationID, {
      conversationID,
      type: "escalation",
      status: "active",
      adminUID,
      escalationReason: reason.trim(),
      participants: participantUIDs,
      messageCount: 0,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }
}
