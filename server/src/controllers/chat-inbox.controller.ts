import { Request, Response } from "express";
import { ChatRepository } from "../repositories/chat.repo.js";
import { canUserAccessConversation } from "../realtime/access-control.js";
import type { SocketUser } from "../realtime/socket-auth.js";

function normalizeFolder(value: unknown): "inbox" | "archived" {
  const v = typeof value === "string" ? value.toLowerCase().trim() : "";
  return v === "archived" ? "archived" : "inbox";
}

function toBool(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return null;
}

async function getConversationOr403(req: Request, res: Response, conversationId: string) {
  const user: SocketUser = {
    uid: req.user!.uid,
    email: req.user!.email,
    admin: req.user!.admin || false,
    superAdmin: req.user!.superAdmin || false,
  };
  if (!(await canUserAccessConversation(user, conversationId))) {
    res.status(403).json({ error: "Access denied" });
    return null;
  }
  const conv = await ChatRepository.getConversation(conversationId);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return null;
  }
  return conv;
}

function addUid(list: string[] | undefined, uid: string): string[] {
  const set = new Set((list || []).filter(Boolean));
  set.add(uid);
  return Array.from(set);
}

function removeUid(list: string[] | undefined, uid: string): string[] {
  return (list || []).filter((x) => x && x !== uid);
}

/**
 * PATCH /api/chat/:conversationId/archive
 * Body: { archived: boolean }
 */
export async function setConversationArchived(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;
    const archived = toBool((req.body || {}).archived);
    if (archived === null) {
      res.status(400).json({ error: "archived must be boolean" });
      return;
    }

    const conv = await getConversationOr403(req, res, conversationId);
    if (!conv) return;

    const uid = req.user!.uid;
    const nextArchivedFor = archived ? addUid(conv.archivedFor, uid) : removeUid(conv.archivedFor, uid);
    const nextDeletedFor = removeUid(conv.deletedFor, uid); // un-delete on archive toggle

    await ChatRepository.updateConversation(conversationId, {
      archivedFor: nextArchivedFor,
      deletedFor: nextDeletedFor,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[API] Error in setConversationArchived:", error?.message || error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
}

/**
 * PATCH /api/chat/:conversationId/delete
 * Body: { deleted: boolean }
 *
 * Messenger-style delete: hides the conversation from this user's inbox only.
 */
export async function setConversationDeleted(req: Request, res: Response): Promise<void> {
  try {
    const { conversationId } = req.params;
    const deleted = toBool((req.body || {}).deleted);
    if (deleted === null) {
      res.status(400).json({ error: "deleted must be boolean" });
      return;
    }

    const conv = await getConversationOr403(req, res, conversationId);
    if (!conv) return;

    if (conv.type === "staff" && deleted) {
      res.status(400).json({ error: "Staff conversations cannot be deleted" });
      return;
    }

    const uid = req.user!.uid;
    const nextDeletedFor = deleted ? addUid(conv.deletedFor, uid) : removeUid(conv.deletedFor, uid);
    const nextArchivedFor = deleted ? removeUid(conv.archivedFor, uid) : conv.archivedFor || [];

    await ChatRepository.updateConversation(conversationId, {
      deletedFor: nextDeletedFor,
      archivedFor: nextArchivedFor,
    });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("[API] Error in setConversationDeleted:", error?.message || error);
    res.status(500).json({ error: "Failed to update conversation" });
  }
}

/**
 * GET /api/chat/conversations?folder=inbox|archived
 * (Controller helper for server-side filtering)
 */
export function filterConversationFolder(items: any[], uid: string, folder: "inbox" | "archived") {
  return (items || []).filter((conv) => {
    const deletedFor = Array.isArray(conv.deletedFor) ? conv.deletedFor : [];
    if (deletedFor.includes(uid)) return false;
    const archivedFor = Array.isArray(conv.archivedFor) ? conv.archivedFor : [];
    const isArchived = archivedFor.includes(uid);
    return folder === "archived" ? isArchived : !isArchived;
  });
}

export { normalizeFolder };

