/**
 * Message Handler
 * 
 * Handles message persistence, broadcasting, and inbox notifications.
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { SocketUser } from "./socket-auth.js";
import { canUserWriteToConversation } from "./access-control.js";
import { ChatDataService } from "../services/chat-data.service.js";
import { ChatRepository } from "../repositories/chat.repo.js";
import { ROOM_PREFIXES } from "./socket-events.js";
import { REALTIME_CONFIG } from "./config.js";
import type { ChatSocketAck } from "./protocol.js";

/**
 * Configuration for message handling.
 */
export const MESSAGE_CONFIG = {
  MAX_MESSAGE_LENGTH: REALTIME_CONFIG.message.maxLength,
  RATE_LIMIT_MAX_MESSAGES: REALTIME_CONFIG.message.rateMax,
  RATE_LIMIT_WINDOW_MS: REALTIME_CONFIG.message.rateWindowMs,
} as const;

/**
 * Send and persist a message to a conversation.
 * Broadcasts to room and sends inbox notifications.
 */
export async function handleMessageSend(
  io: SocketIOServer,
  socket: Socket,
  user: SocketUser,
  payload: any,
  callback: any
): Promise<void> {
  try {
    const { conversationID, text, clientMessageID } = payload || {};

    // ====================================================================
    // Validation
    // ====================================================================

    if (!conversationID || typeof conversationID !== "string") {
      return callback({
        ok: false,
        code: "BAD_REQUEST",
        error: "conversationID is required",
      });
    }

    if (!text || typeof text !== "string") {
      return callback({
        ok: false,
        code: "BAD_REQUEST",
        error: "Message text is required",
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return callback({
        ok: false,
        code: "BAD_REQUEST",
        error: "Message cannot be empty",
      });
    }

    if (trimmedText.length > MESSAGE_CONFIG.MAX_MESSAGE_LENGTH) {
      return callback({
        ok: false,
        code: "BAD_REQUEST",
        error: `Message exceeds ${MESSAGE_CONFIG.MAX_MESSAGE_LENGTH} character limit`,
      });
    }

    if (trimmedText.includes("\0")) {
      return callback({
        ok: false,
        code: "BAD_REQUEST",
        error: "Message contains invalid characters",
      });
    }

    // ====================================================================
    // Authorization Check
    // ====================================================================

    if (!(await canUserWriteToConversation(user, conversationID))) {
      console.warn(
        `[Message] Access denied: ${user.uid} cannot write to ${conversationID}`
      );
      return callback({
        ok: false,
        code: "FORBIDDEN",
        error: "Access denied",
      });
    }

    // ====================================================================
    // Persist Message
    // ====================================================================

    const senderRole = user.superAdmin ? "superAdmin" : user.admin ? "admin" : "student";

    const message = await ChatDataService.addMessageToConversation(
      conversationID,
      user.uid,
      senderRole,
      trimmedText,
      clientMessageID
    );

    console.log(
      `[Message] Persisted message ${message.messageID} from ${user.uid} to ${conversationID}`
    );

    // ====================================================================
    // Broadcast Message to Room
    // ====================================================================

    const conversationRoom = `${ROOM_PREFIXES.CONVERSATION}${conversationID}`;
    io.to(conversationRoom).emit("message:new", {
      messageID: message.messageID,
      conversationID,
      senderUID: message.senderUID,
      senderRole: message.senderRole,
      content: message.content,
      createdAt: message.createdAt,
      clientMessageID, // For deduplication on client
    });

    console.log(`[Message] Broadcasted to room ${conversationRoom}`);

    // ====================================================================
    // Send Inbox Notifications
    // ====================================================================

    sendInboxNotifications(io, conversationID, user);

    // ====================================================================
    // Acknowledge Sender
    // ====================================================================

    const ack: ChatSocketAck<{
      message: {
        messageID: string;
        conversationID: string;
        senderUID: string;
        senderRole: string;
        content: string;
        createdAt: string;
      };
    }> = {
      ok: true,
      message: {
        messageID: message.messageID,
        conversationID,
        senderUID: message.senderUID,
        senderRole: message.senderRole,
        content: message.content,
        createdAt: message.createdAt,
      },
    };

    callback(ack);
  } catch (error: any) {
    console.error(`[Message] Error in message:send:`, error.message);
    callback({
      ok: false,
      code: "INTERNAL",
      error: error.message || "Failed to send message",
    });
  }
}

/**
 * Send inbox notifications based on conversation type and sender role.
 * 
 * Rules:
 * - Student sends to support: notify role:admins
 * - Admin replies in support: notify user:<studentUID>
 * - Admin escalates: notify role:superadmins
 * - SuperAdmin replies in escalation: notify user:<adminUID>
 */
export function sendInboxNotifications(
  io: SocketIOServer,
  conversationID: string,
  sender: SocketUser
): void {
  try {
    const parsed = ChatDataService.parseConversationID(conversationID);
    if (!parsed) return;

    // ====================================================================
    // Support Conversation
    // ====================================================================
    if (parsed.type === "support" && parsed.studentUID) {
      const senderIsStudent = !sender.admin && !sender.superAdmin;

      if (senderIsStudent) {
        // Student sent message → notify admins
        io.to(ROOM_PREFIXES.ROLE_ADMINS).emit("inbox:notify", {
          conversationID,
          type: "student_message",
          studentUID: parsed.studentUID,
          message: `New message in support conversation`,
        });
        console.log(`[Inbox] Notified ${ROOM_PREFIXES.ROLE_ADMINS} of student message`);
      } else {
        // Admin/SuperAdmin replied → notify student
        io.to(`${ROOM_PREFIXES.USER}${parsed.studentUID}`).emit("inbox:notify", {
          conversationID,
          type: "admin_reply",
          adminUID: sender.uid,
          message: `Admin replied to your support request`,
        });
        console.log(`[Inbox] Notified student ${parsed.studentUID} of admin reply`);
      }
    }

    // ====================================================================
    // Escalation Conversation
    // ====================================================================
    if (parsed.type === "escalation" && parsed.adminUID) {
      const senderIsAdmin = sender.admin && !sender.superAdmin;

      if (senderIsAdmin) {
        // Admin escalated → notify superAdmins
        io.to(ROOM_PREFIXES.ROLE_SUPERADMINS).emit("inbox:notify", {
          conversationID,
          type: "escalation_created",
          adminUID: parsed.adminUID,
          escalationID: parsed.escalationID,
          message: `New escalation from admin`,
        });
        console.log(
          `[Inbox] Notified ${ROOM_PREFIXES.ROLE_SUPERADMINS} of escalation`
        );
      } else if (sender.superAdmin) {
        // SuperAdmin replied → notify owning admin
        io.to(`${ROOM_PREFIXES.USER}${parsed.adminUID}`).emit("inbox:notify", {
          conversationID,
          type: "superadmin_reply",
          superAdminUID: sender.uid,
          message: `SuperAdmin responded to your escalation`,
        });
        console.log(`[Inbox] Notified admin ${parsed.adminUID} of superAdmin reply`);
      }
    }

    // ====================================================================
    // Staff Group Conversation (admins + superAdmins)
    // ====================================================================
    if (parsed.type === "staff") {
      io.to(ROOM_PREFIXES.ROLE_ADMINS).emit("inbox:notify", {
        conversationID,
        type: "staff_message",
        adminUID: sender.uid,
        message: `New message in staff chat`,
      });
      io.to(ROOM_PREFIXES.ROLE_SUPERADMINS).emit("inbox:notify", {
        conversationID,
        type: "staff_message",
        adminUID: sender.uid,
        message: `New message in staff chat`,
      });
    }
  } catch (error: any) {
    console.error(`[Inbox] Error sending notifications:`, error.message);
  }
}
