/**
 * Access Control for Conversations
 * 
 * Validates whether a user can access (read/write) a specific conversation.
 */

import { SocketUser } from "./socket-auth.js";
import { ChatDataService } from "../services/chat-data.service.js";

/**
 * Check if a user can access a conversation.
 * 
 * Rules:
 * - Support conversations: student owner OR any admin/superAdmin
 * - Escalation conversations: owning admin OR any superAdmin
 */
export function canUserAccessConversation(
  user: SocketUser,
  conversationID: string
): boolean {
  // Parse conversation ID to extract type and components
  const parsed = ChatDataService.parseConversationID(conversationID);
  if (!parsed) {
    console.warn(`[Access Control] Invalid conversation ID: ${conversationID}`);
    return false;
  }

  // Support conversation
  if (parsed.type === "support") {
    // Student: can access their own support conversation
    if (user.uid === parsed.studentUID) {
      return true;
    }
    // Admin/SuperAdmin: can access all support conversations
    if (user.admin || user.superAdmin) {
      return true;
    }
    return false;
  }

  // Escalation conversation
  if (parsed.type === "escalation") {
    // Admin: can access their own escalations
    if (user.uid === parsed.adminUID) {
      return true;
    }
    // SuperAdmin: can access all escalations
    if (user.superAdmin) {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Check if a user can write to a conversation.
 * (Same as access for now; no closed/archived check yet)
 */
export function canUserWriteToConversation(
  user: SocketUser,
  conversationID: string
): boolean {
  return canUserAccessConversation(user, conversationID);
}
