/**
 * Chat Routes
 * 
 * REST API endpoints for chat functionality
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getConversationMessages,
  getUserConversations,
} from "../controllers/chat.controller.js";

const router = Router();

/**
 * GET /api/chat/:conversationId/messages
 * Get paginated message history for a conversation
 */
router.get("/:conversationId/messages", requireAuth, getConversationMessages);

/**
 * GET /api/chat/conversations
 * Get conversations for authenticated user (inbox)
 */
router.get("/conversations", requireAuth, getUserConversations);

export default router;
