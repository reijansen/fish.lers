/**
 * Socket.io Authentication Middleware
 * 
 * Verifies Firebase ID tokens on socket connection.
 * Derives user role from custom claims.
 */

import { Server as SocketIOServer, Socket } from "socket.io";
import { getAuth } from "../config/firebase.js";

/**
 * Socket user data attached to socket.data
 */
export interface SocketUser {
  uid: string;
  email?: string;
  admin: boolean;
  superAdmin: boolean;
}

/**
 * Setup socket authentication middleware.
 * Validates Firebase ID token on connection.
 */
export function setupSocketAuth(io: SocketIOServer): void {
  io.use(async (socket, next) => {
    try {
      // Get token from handshake.auth or Authorization header
      let token: string | undefined =
        (socket.handshake.auth?.token as string) ||
        socket.handshake.headers.authorization?.replace("Bearer ", "");

      if (!token) {
        return next(new Error("No authentication token provided"));
      }

      // Verify token with Firebase
      const decodedToken = await getAuth().verifyIdToken(token);

      // Extract role from custom claims
      const user: SocketUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        admin: !!decodedToken.admin || !!decodedToken.superAdmin,
        superAdmin: !!decodedToken.superAdmin,
      };

      // Attach user to socket
      socket.data.user = user;

      console.log(
        `[Socket Auth] User ${user.uid} (${user.superAdmin ? "superAdmin" : user.admin ? "admin" : "student"}) connected`
      );

      next();
    } catch (error: any) {
      console.error(`[Socket Auth] Authentication failed:`, error.message);
      next(new Error(`Authentication failed: ${error.message}`));
    }
  });
}

/**
 * Get socket user (with safety check).
 * Throws if socket is not authenticated.
 */
export function getSocketUser(socket: Socket): SocketUser {
  const user = socket.data.user as SocketUser | undefined;
  if (!user) {
    throw new Error("Socket not authenticated");
  }
  return user;
}
