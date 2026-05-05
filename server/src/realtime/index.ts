/**
 * Real-time Communication Module
 * 
 * Exports socket.io setup and configuration.
 */

export { createSocketIOServer } from "./socket-server.js";
export { setupSocketAuth, getSocketUser } from "./socket-auth.js";
export type { SocketUser } from "./socket-auth.js";
export { setupEventHandlers, ROOM_PREFIXES } from "./socket-events.js";
export { canUserAccessConversation, canUserWriteToConversation } from "./access-control.js";
