/**
 * Access Control for Conversations
 * 
 * Validates whether a user can access (read/write) a specific conversation.
 */

import { SocketUser } from "./socket-auth.js";
import { ChatDataService } from "../services/chat-data.service.js";
import { ChatRepository } from "../repositories/chat.repo.js";

/**
 * Check if a user can access a conversation.
 * 
 * Rules:
 * - Support conversations: student owner OR admins who are participants (claimed/assigned)
 * - Escalation conversations: owning admin OR any superAdmin; once joined, user becomes a participant
 */
export async function canUserAccessConversation(
  user: SocketUser,
  conversationID: string
): Promise<boolean> {
  // Parse conversation ID to extract type and components
  const parsed = ChatDataService.parseConversationID(conversationID);
  if (!parsed) {
    console.warn(`[Access Control] Invalid conversation ID: ${conversationID}`);
    return false;
  }

  const conversation = await ChatRepository.getConversation(conversationID);
  // If conversation doesn't exist yet:
  // - allow the student owner to access (they may create via API)
  // - allow the owning admin to access escalations (they may create via API)
  if (!conversation) {
    if (parsed.type === "support" && user.uid === parsed.studentUID) return true;
    if (parsed.type === "escalation" && user.uid === parsed.adminUID) return true;
    // SuperAdmins are allowed to access escalations even if conversation isn't loaded yet.
    if (parsed.type === "escalation" && user.superAdmin) return true;
    return false;
  }

  // Support conversation
  if (parsed.type === "support") {
    // Student: can access their own support conversation
    if (user.uid === parsed.studentUID) {
      return true;
    }

    // Admin/SuperAdmin: privacy-by-default, but allow a single admin to "claim" a support thread.
    // - If adminUID is unset: allow admin/superAdmin to join (claim happens on join)
    // - If adminUID is set: only that admin (or explicit participant) can access
    if (user.admin || user.superAdmin) {
      const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
      if (!conversation.adminUID) return true;
      if (conversation.adminUID === user.uid) return true;
      return participants.includes(user.uid);
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
    return Array.isArray(conversation.participants) && conversation.participants.includes(user.uid);
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
): Promise<boolean> {
  return canUserAccessConversation(user, conversationID);
}
