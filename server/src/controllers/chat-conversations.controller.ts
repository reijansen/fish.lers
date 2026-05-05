import { Request, Response } from "express";
import { ChatDataService } from "../services/chat-data.service.js";
import { canUserAccessConversation } from "../realtime/access-control.js";
import type { SocketUser } from "../realtime/socket-auth.js";
import { UserRepository } from "../repositories/users.repo.js";
import { ChatRepository } from "../repositories/chat.repo.js";

/**
 * POST /api/chat/support
 * Ensure the authenticated student's support conversation exists.
 */
export async function ensureMySupportConversation(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const conversation = await ChatDataService.getOrCreateSupportConversation(req.user.uid);
    res.status(200).json({ conversation });
  } catch (error: any) {
    console.error("[API] ensureMySupportConversation:", error?.message || error);
    res.status(500).json({ error: "Failed to ensure support conversation" });
  }
}

/**
 * POST /api/chat/support/:studentUID
 * Ensure a student's support conversation exists (admin/superAdmin only).
 */
export async function ensureStudentSupportConversation(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!req.user.admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const { studentUID } = req.params;
    if (!studentUID) {
      res.status(400).json({ error: "studentUID is required" });
      return;
    }

    const conversation = await ChatDataService.getOrCreateSupportConversation(studentUID);
    res.status(200).json({ conversation });
  } catch (error: any) {
    console.error("[API] ensureStudentSupportConversation:", error?.message || error);
    res.status(500).json({ error: "Failed to ensure support conversation" });
  }
}

/**
 * POST /api/chat/support/assign
 * Assign the current student's support conversation to a specific admin.
 * Body: { adminUID: string }
 */
export async function assignMySupportConversation(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const adminUID = typeof (req.body as any)?.adminUID === "string" ? (req.body as any).adminUID : "";
    if (!adminUID) {
      res.status(400).json({ error: "adminUID is required" });
      return;
    }

    const adminUser = await UserRepository.getById(adminUID);
    if (!adminUser || adminUser.role !== "admin") {
      res.status(400).json({ error: "Target user is not an admin" });
      return;
    }

    const conversation = await ChatDataService.getOrCreateSupportConversation(req.user.uid);
    const participants = Array.isArray(conversation.participants) ? conversation.participants : [];
    const nextParticipants = Array.from(new Set([...participants, req.user.uid, adminUID]));

    await ChatRepository.updateConversation(conversation.conversationID, {
      participants: nextParticipants,
      adminUID,
    });

    const updated = await ChatRepository.getConversation(conversation.conversationID);
    res.status(200).json({ conversation: updated || conversation });
  } catch (error: any) {
    console.error("[API] assignMySupportConversation:", error?.message || error);
    res.status(500).json({ error: "Failed to assign support conversation" });
  }
}

/**
 * POST /api/chat/escalations
 * Create a new escalation conversation (admin/superAdmin only).
 * Body: { reason?: string }
 */
export async function createEscalationConversation(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!req.user.admin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    const reason =
      typeof (req.body as any)?.reason === "string" ? (req.body as any).reason : "Direct escalation";

    const conversation = await ChatDataService.createDirectEscalationConversation(req.user.uid, reason);
    res.status(201).json({ conversation });
  } catch (error: any) {
    console.error("[API] createEscalationConversation:", error?.message || error);
    res.status(500).json({ error: "Failed to create escalation conversation" });
  }
}

/**
 * POST /api/chat/escalations/:adminUID
 * Create a direct escalation conversation targeted at a specific admin (superAdmin only).
 * Body: { reason?: string }
 */
export async function createEscalationConversationForAdmin(
  req: Request,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    if (!req.user.superAdmin) {
      res.status(403).json({ error: "Super admin access required" });
      return;
    }

    const { adminUID } = req.params;
    if (!adminUID) {
      res.status(400).json({ error: "adminUID is required" });
      return;
    }

    const reason =
      typeof (req.body as any)?.reason === "string" ? (req.body as any).reason : "Direct escalation";

    const conversation = await ChatDataService.createDirectEscalationConversation(adminUID, reason);
    res.status(201).json({ conversation });
  } catch (error: any) {
    console.error("[API] createEscalationConversationForAdmin:", error?.message || error);
    res.status(500).json({ error: "Failed to create escalation conversation" });
  }
}
