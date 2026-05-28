/**
 * Socket.io Room Management and Event Handlers
 * 
 * Handles room strategy (user rooms, role rooms)
 * Implements realtime events (conversation:join, ping)
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { getSocketUser, SocketUser } from "./socket-auth.js";
import { canUserAccessConversation } from "./access-control.js";
import { checkRateLimit } from "./rate-limiter.js";
import { handleMessageSend, MESSAGE_CONFIG } from "./message-handler.js";
import { ChatDataService } from "../services/chat-data.service.js";
import { REALTIME_CONFIG } from "./config.js";
import type { ChatSocketAck, ConversationJoinPayload, TypingPayload, ReadPayload } from "./protocol.js";
import { ChatRepository } from "../repositories/chat.repo.js";

/**
 * Room naming conventions:
 */
export const ROOM_PREFIXES = {
  USER: "user:", // user:<uid>
  ROLE_ADMINS: "role:admins",
  ROLE_SUPERADMINS: "role:superadmins",
  CONVERSATION: "conversation:", // conversation:<conversationID>
} as const;

/**
 * Setup room strategy on socket connection.
 * Joins user and role-based rooms.
 */
export function setupRoomStrategy(socket: Socket): void {
  const user = getSocketUser(socket);

  // Join user-specific room
  const userRoom = `${ROOM_PREFIXES.USER}${user.uid}`;
  socket.join(userRoom);
  console.log(`[Rooms] ${user.uid} joined ${userRoom}`);

  // Join role-based rooms
  if (user.superAdmin) {
    socket.join(ROOM_PREFIXES.ROLE_SUPERADMINS);
    console.log(`[Rooms] ${user.uid} joined ${ROOM_PREFIXES.ROLE_SUPERADMINS}`);
  } else if (user.admin) {
    socket.join(ROOM_PREFIXES.ROLE_ADMINS);
    console.log(`[Rooms] ${user.uid} joined ${ROOM_PREFIXES.ROLE_ADMINS}`);
  }
}

/**
 * Setup event handlers for realtime communication.
 */
export function setupEventHandlers(io: SocketIOServer): void {
  io.on("connection", (socket: Socket) => {
    const user = getSocketUser(socket);

    // ====================================================================
    // Setup room strategy for this socket
    // ====================================================================
    setupRoomStrategy(socket);

    // ====================================================================
    // EVENT: conversation:join
    // Validate access to conversation and join room
    // ====================================================================
    socket.on("conversation:join", async (payload: any, callback: any) => {
      try {
        const { conversationID } = (payload || {}) as Partial<ConversationJoinPayload>;

        if (!conversationID || typeof conversationID !== "string") {
          return callback({
            ok: false,
            code: "BAD_REQUEST",
            error: "conversationID is required",
          });
        }

        // Check if user can access this conversation
        const canAccess = await canUserAccessConversation(user, conversationID);
        if (!canAccess) {
          console.warn(
            `[Rooms] Access denied: ${user.uid} cannot access ${conversationID}`
          );
          return callback({
            ok: false,
            code: "FORBIDDEN",
            error: "Access denied",
          });
        }

        // Privacy: ensure the joiner is a participant for future visibility (support claim / escalation join).
        const convo = await ChatRepository.getConversation(conversationID);
        if (convo) {
          const participants = Array.isArray(convo.participants) ? convo.participants : [];
          if (!participants.includes(user.uid)) {
            const parsed = ChatDataService.parseConversationID(conversationID);
            const isSupport = parsed?.type === "support";

            // Support threads are student↔admin only. SuperAdmins must never be attached.
            if (isSupport) {
              if (user.admin && !user.superAdmin) {
                const nextParticipants = Array.from(new Set([...(participants || []), user.uid]));
                const nextUpdates: Record<string, unknown> = {
                  participants: nextParticipants,
                };
                if (!convo.adminUID) {
                  nextUpdates.adminUID = user.uid;
                }
                await ChatRepository.updateConversation(conversationID, nextUpdates as any);
              }
            } else {
              await ChatRepository.updateConversation(conversationID, {
                participants: [...participants, user.uid],
              });
            }
          }
        }

        // Join conversation room
        const conversationRoom = `${ROOM_PREFIXES.CONVERSATION}${conversationID}`;
        socket.join(conversationRoom);

        console.log(
          `[Rooms] ${user.uid} joined conversation ${conversationID}`
        );

        callback({
          ok: true,
          conversationID,
          room: conversationRoom,
        });
      } catch (error: any) {
        console.error(
          `[Events] Error in conversation:join:`,
          error.message
        );
        callback({
          ok: false,
          code: "INTERNAL",
          error: error.message,
        });
      }
    });

    // ====================================================================
    // EVENT: message:send
    // Send and persist a message with realtime delivery
    // ====================================================================
    socket.on(
      "message:send",
      (payload: any, callback: any) => {
        // Check rate limit
        if (
          !checkRateLimit(
            user.uid,
            MESSAGE_CONFIG.RATE_LIMIT_MAX_MESSAGES,
            MESSAGE_CONFIG.RATE_LIMIT_WINDOW_MS,
            "message"
          )
        ) {
          console.warn(`[Message] Rate limit exceeded for user ${user.uid}`);
          return callback({
            ok: false,
            code: "RATE_LIMITED",
            error: "Rate limit exceeded. Please wait before sending more messages.",
          });
        }

        // Handle message send (async)
        handleMessageSend(io, socket, user, payload, callback);
      }
    );

    // ====================================================================
    // EVENT: user:typing
    // Typing indicator (not persisted). Broadcast to conversation excluding sender.
    // ====================================================================
    socket.on("user:typing", async (payload: any, callback: any) => {
      try {
        if (
          !checkRateLimit(
            user.uid,
            REALTIME_CONFIG.typing.rateMax,
            REALTIME_CONFIG.typing.rateWindowMs,
            "typing"
          )
        ) {
          return callback?.({
            ok: false,
            code: "RATE_LIMITED",
            error: "Typing rate limit exceeded",
          } satisfies ChatSocketAck<{}>);
        }

        const { conversationID, isTyping } = (payload || {}) as Partial<TypingPayload>;

        if (!conversationID || typeof conversationID !== "string") {
          return callback?.({ ok: false, code: "BAD_REQUEST", error: "conversationID is required" } satisfies ChatSocketAck<{}>);
        }

        if (typeof isTyping !== "boolean") {
          return callback?.({ ok: false, code: "BAD_REQUEST", error: "isTyping must be boolean" } satisfies ChatSocketAck<{}>);
        }

        if (!(await canUserAccessConversation(user, conversationID))) {
          return callback?.({ ok: false, code: "FORBIDDEN", error: "Access denied" } satisfies ChatSocketAck<{}>);
        }

        const conversationRoom = `${ROOM_PREFIXES.CONVERSATION}${conversationID}`;
        socket.to(conversationRoom).emit("user:typing", {
          conversationID,
          userUID: user.uid,
          userRole: user.superAdmin ? "superAdmin" : user.admin ? "admin" : "student",
          isTyping,
          timestamp: Date.now(),
        });

        callback?.({ ok: true } satisfies ChatSocketAck<{}>);
      } catch (error: any) {
        callback?.({ ok: false, code: "INTERNAL", error: error.message || "Typing event failed" } satisfies ChatSocketAck<{}>);
      }
    });

    // ====================================================================
    // EVENT: message:read
    // Persistent read receipt update (server-backed). Broadcast to conversation.
    // ====================================================================
    socket.on("message:read", async (payload: any, callback: any) => {
      try {
        if (
          !checkRateLimit(
            user.uid,
            REALTIME_CONFIG.read.rateMax,
            REALTIME_CONFIG.read.rateWindowMs,
            "read"
          )
        ) {
          return callback?.({
            ok: false,
            code: "RATE_LIMITED",
            error: "Read receipt rate limit exceeded",
          } satisfies ChatSocketAck<{}>);
        }

        const { conversationID, readUpToMessageID } = (payload || {}) as Partial<ReadPayload>;

        if (!conversationID || typeof conversationID !== "string") {
          return callback?.({ ok: false, code: "BAD_REQUEST", error: "conversationID is required" } satisfies ChatSocketAck<{}>);
        }

        if (!readUpToMessageID || typeof readUpToMessageID !== "string") {
          return callback?.({ ok: false, code: "BAD_REQUEST", error: "readUpToMessageID is required" } satisfies ChatSocketAck<{}>);
        }

        if (!(await canUserAccessConversation(user, conversationID))) {
          return callback?.({ ok: false, code: "FORBIDDEN", error: "Access denied" } satisfies ChatSocketAck<{}>);
        }

        await ChatDataService.markConversationAsRead(conversationID, user.uid, readUpToMessageID);

        const conversationRoom = `${ROOM_PREFIXES.CONVERSATION}${conversationID}`;
        io.to(conversationRoom).emit("message:read", {
          conversationID,
          userUID: user.uid,
          readUpToMessageID,
          timestamp: Date.now(),
        });

        callback?.({ ok: true } satisfies ChatSocketAck<{}>);
      } catch (error: any) {
        callback?.({ ok: false, code: "INTERNAL", error: error.message || "Read receipt failed" } satisfies ChatSocketAck<{}>);
      }
    });

    // ====================================================================
    // EVENT: ping
    // Simple connectivity check
    // ====================================================================
    socket.on("ping", (callback: any) => {
      console.log(`[Events] ping from ${user.uid}`);
      if (typeof callback === "function") {
        callback({ ok: true, pong: true, timestamp: Date.now() });
      }
    });

    // ====================================================================
    // Disconnect handler
    // ====================================================================
    socket.on("disconnect", () => {
      console.log(`[Disconnect] User ${user.uid} disconnected`);
    });

    // ====================================================================
    // Error handler
    // ====================================================================
    socket.on("error", (error: any) => {
      console.error(`[Socket Error] ${user.uid}:`, error);
    });
  });
}
