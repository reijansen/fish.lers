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
    socket.on("conversation:join", (payload: any, callback: any) => {
      try {
        const { conversationID } = payload || {};

        if (!conversationID || typeof conversationID !== "string") {
          return callback({
            ok: false,
            error: "conversationID is required",
          });
        }

        // Check if user can access this conversation
        if (!canUserAccessConversation(user, conversationID)) {
          console.warn(
            `[Rooms] Access denied: ${user.uid} cannot access ${conversationID}`
          );
          return callback({
            ok: false,
            error: "Access denied",
          });
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
        if (!checkRateLimit(user.uid, MESSAGE_CONFIG.RATE_LIMIT_MAX_MESSAGES, MESSAGE_CONFIG.RATE_LIMIT_WINDOW_MS)) {
          console.warn(`[Message] Rate limit exceeded for user ${user.uid}`);
          return callback({
            ok: false,
            error: "Rate limit exceeded. Please wait before sending more messages.",
          });
        }

        // Handle message send (async)
        handleMessageSend(io, socket, user, payload, callback);
      }
    );

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
