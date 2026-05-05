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
import { listChatPeople } from "../controllers/chat-people.controller.js";
import {
  ensureMySupportConversation,
  ensureStudentSupportConversation,
  assignMySupportConversation,
  createEscalationConversation,
  createEscalationConversationForAdmin,
} from "../controllers/chat-conversations.controller.js";

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

/**
 * GET /api/chat/people
 * List people to start a chat with (role-filtered)
 */
router.get("/people", requireAuth, listChatPeople);

/**
 * POST /api/chat/support
 * Ensure current student's support conversation exists.
 */
router.post("/support", requireAuth, ensureMySupportConversation);

/**
 * POST /api/chat/support/assign
 * Assign current student's support conversation to a specific admin.
 */
router.post("/support/assign", requireAuth, assignMySupportConversation);

/**
 * POST /api/chat/support/:studentUID
 * Ensure a student's support conversation exists (admin only).
 */
router.post("/support/:studentUID", requireAuth, ensureStudentSupportConversation);

/**
 * POST /api/chat/escalations
 * Create a direct escalation conversation (admin only).
 */
router.post("/escalations", requireAuth, createEscalationConversation);

/**
 * POST /api/chat/escalations/:adminUID
 * SuperAdmin creates an escalation conversation with a specific admin.
 */
router.post("/escalations/:adminUID", requireAuth, createEscalationConversationForAdmin);

export default router;
