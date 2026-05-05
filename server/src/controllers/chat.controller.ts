/**
 * Chat Controller
 * 
 * REST endpoints for chat functionality:
 * - GET /api/chat/:conversationId/messages - Get paginated message history
 */

import { Request, Response } from "express";
import { ChatRepository } from "../repositories/chat.repo.js";
import { canUserAccessConversation } from "../realtime/access-control.js";
import type { SocketUser } from "../realtime/socket-auth.js";

/**
 * GET /api/chat/:conversationId/messages
 * 
 * Get paginated messages for a conversation.
 * 
 * Query params:
 * - limit: number (default 50, max 100)
 * - before: string (cursor for pagination)
 * 
 * Response:
 * {
 *   items: Message[],
 *   hasMore: boolean,
 *   nextCursor?: string
 * }
 */
export async function getConversationMessages(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { conversationId } = req.params;
    const { limit = "50", before } = req.query;

    // ====================================================================
    // Validation
    // ====================================================================

    if (!conversationId || typeof conversationId !== "string") {
      res.status(400).json({ error: "conversationId is required" });
      return;
    }

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 50, 100);
    if (parsedLimit < 1) {
      res.status(400).json({ error: "limit must be >= 1" });
      return;
    }

    // ====================================================================
    // Authorization Check
    // ====================================================================

    // Build SocketUser object from request for access control check
    const user: SocketUser = {
      uid: req.user!.uid,
      email: req.user!.email,
      admin: req.user!.admin || false,
      superAdmin: req.user!.superAdmin || false,
    };

    if (!(await canUserAccessConversation(user, conversationId))) {
      console.warn(
        `[API] Access denied: ${user.uid} cannot access ${conversationId}`
      );
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // ====================================================================
    // Fetch Messages
    // ====================================================================

    // For cursor-based pagination, use the before string directly (ISO timestamp)
    const beforeCursor = before ? { beforeTimestamp: before as string, limit: parsedLimit } : undefined;

    const result = await ChatRepository.getMessages(
      conversationId,
      beforeCursor
    );

    // Limit to requested amount
    const items = result.items.slice(0, parsedLimit);
    const hasMore = result.items.length > parsedLimit;

    // Extract cursor from first item (chronologically oldest) if more results exist
    let nextCursor: string | undefined;
    if (hasMore && items.length > 0) {
      const lastMessage = items[0];
      nextCursor = lastMessage.createdAt;
    }

    console.log(
      `[API] Retrieved ${items.length} messages for ${conversationId} (user: ${user.uid})`
    );

    res.status(200).json({
      items,
      hasMore,
      nextCursor,
    });
  } catch (error: any) {
    console.error(`[API] Error in getConversationMessages:`, error.message);
    res.status(500).json({ error: "Failed to retrieve messages" });
  }
}

/**
 * GET /api/chat/conversations
 * 
 * Get conversations for authenticated user (inbox list).
 * Role-aware: students see only support, admins see support + escalations.
 * 
 * Query params:
 * - limit: number (default 20, max 50)
 * 
 * Response:
 * {
 *   conversations: Conversation[]
 * }
 */
export async function getUserConversations(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { limit = "20" } = req.query;

    // ====================================================================
    // Validation
    // ====================================================================

    const parsedLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
    if (parsedLimit < 1) {
      res.status(400).json({ error: "limit must be >= 1" });
      return;
    }

    // ====================================================================
    // Fetch Conversations (role-aware)
    // ====================================================================

    let conversations;
    const userId = req.user!.uid;
    const isAdmin = req.user!.admin || false;
    const isSuperAdmin = req.user!.superAdmin || false;

    if (isSuperAdmin) {
      // Privacy: superAdmins see only conversations they participate in
      conversations = await ChatRepository.getSuperAdminConversations(userId);
    } else if (isAdmin) {
      // Admins see support + their escalations
      conversations = await ChatRepository.getAdminConversations(userId);
    } else {
      // Students see only their support conversation
      const supportConvs = await ChatRepository.getStudentConversations(userId);
      conversations = supportConvs;
    }

    // Limit results
    const items = conversations.slice(0, parsedLimit);

    // ====================================================================
    // Phase 5: server-backed unread counts
    // ====================================================================

    const unreadCounts: Record<string, number> = {};

    await Promise.all(
      items.map(async (conv) => {
        try {
          const readState = await ChatRepository.getReadState(conv.conversationID, userId);

          // No messages => no unread
          if (!conv.lastMessageAt) {
            unreadCounts[conv.conversationID] = 0;
            return;
          }

          const readUpTo = readState?.readUpToTimestamp;
          if (readUpTo && new Date(conv.lastMessageAt).getTime() <= new Date(readUpTo).getTime()) {
            unreadCounts[conv.conversationID] = 0;
            return;
          }

          const afterTimestamp = readUpTo || "1970-01-01T00:00:00.000Z";
          // Cap unread count to avoid heavy reads for large threads
          const unread = await ChatRepository.countUnreadMessagesAfter(conv.conversationID, afterTimestamp, 999);
          unreadCounts[conv.conversationID] = unread;
        } catch {
          unreadCounts[conv.conversationID] = 0;
        }
      })
    );

    console.log(
      `[API] Retrieved ${items.length} conversations for ${userId}`
    );

    res.status(200).json({
      conversations: items,
      unreadCounts,
    });
  } catch (error: any) {
    console.error(`[API] Error in getUserConversations:`, error.message);
    res.status(500).json({ error: "Failed to retrieve conversations" });
  }
}
