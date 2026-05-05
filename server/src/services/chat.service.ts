/**
 * Chat System Server Setup (Phase 0 Starter)
 * 
 * This file demonstrates the Socket.io setup and basic event handlers
 * for the chat system. It's a skeleton for Phase 1 implementation.
 * 
 * File: server/src/services/chat.service.ts
 */

import { Server as HTTPServer } from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { db } from "../config/firebase";
import {
  collection,
  addDoc,
  getDoc,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// TYPES
// ============================================================================

interface MessagePayload {
  conversationID: string;
  content: string;
  idempotencyKey: string;
}

interface EscalationPayload {
  studentSupportConversationID: string;
  reason: string;
  idempotencyKey: string;
}

interface CloseConversationPayload {
  conversationID: string;
}

interface ListConversationsPayload {
  type?: "student_support" | "admin_escalation";
  status?: "active" | "closed" | "archived";
  limit?: number;
  offset?: number;
}

interface UserClaims {
  admin?: boolean;
  superAdmin?: boolean;
}

// ============================================================================
// RATE LIMITING (Simple in-memory, for MVP)
// ============================================================================

const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();

function checkRateLimit(
  userId: string,
  limit: number = 10,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || entry.resetAt < now) {
    // Window expired, reset
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count < limit) {
    entry.count++;
    return true;
  }

  return false;
}

// ============================================================================
// VALIDATION
// ============================================================================

function validateMessageContent(content: string): {
  valid: boolean;
  error?: string;
} {
  if (!content || typeof content !== "string") {
    return { valid: false, error: "Content must be a non-empty string" };
  }

  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > 5000) {
    return { valid: false, error: "Message length must be 1-5000 chars" };
  }

  // Check for null bytes (XSS prevention)
  if (trimmed.includes("\0")) {
    return { valid: false, error: "Message contains invalid characters" };
  }

  return { valid: true };
}

function validateEscalationReason(reason: string): {
  valid: boolean;
  error?: string;
} {
  if (!reason || typeof reason !== "string") {
    return { valid: false, error: "Reason must be a non-empty string" };
  }

  const trimmed = reason.trim();
  if (trimmed.length === 0 || trimmed.length > 500) {
    return { valid: false, error: "Reason length must be 1-500 chars" };
  }

  return { valid: true };
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

async function canUserAccessConversation(
  userId: string,
  conversationID: string,
  userRole: "student" | "admin" | "superAdmin"
): Promise<boolean> {
  try {
    const convDoc = await getDoc(doc(db, "chats", conversationID, "metadata", "metadata"));
    if (!convDoc.exists()) {
      return false;
    }

    const convData = convDoc.data();

    if (convData.type === "student_support") {
      // Student can access own conversation
      // Admin/SuperAdmin can access any student support conversation
      return (
        userId === convData.studentUID ||
        userRole === "admin" ||
        userRole === "superAdmin"
      );
    }

    if (convData.type === "admin_escalation") {
      // Only Admin/SuperAdmin can access escalations
      return userRole === "admin" || userRole === "superAdmin";
    }

    return false;
  } catch (error) {
    console.error("Permission check error:", error);
    return false;
  }
}

// ============================================================================
// CHAT SERVICE
// ============================================================================

export class ChatService {
  private io: SocketIOServer;

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.SOCKET_IO_CORS_ORIGIN || "http://localhost:5173",
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Middleware: Verify Firebase ID token
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error("No token provided"));
        }

        // TODO: Verify token with Firebase Admin SDK
        // const decodedToken = await admin.auth().verifyIdToken(token);
        // socket.data.uid = decodedToken.uid;
        // socket.data.claims = decodedToken;

        // For now, mock the data:
        socket.data.uid = "test_user_123"; // TODO: Remove after integration
        socket.data.claims = {};

        next();
      } catch (error) {
        next(new Error("Authentication error"));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket: Socket) => {
      console.log(`User ${socket.data.uid} connected`);

      // EVENT: send_message
      socket.on("send_message", this.handleSendMessage.bind(this, socket));

      // EVENT: load_conversation
      socket.on(
        "load_conversation",
        this.handleLoadConversation.bind(this, socket)
      );

      // EVENT: list_conversations
      socket.on(
        "list_conversations",
        this.handleListConversations.bind(this, socket)
      );

      // EVENT: create_student_support_conversation
      socket.on(
        "create_student_support_conversation",
        this.handleCreateStudentSupport.bind(this, socket)
      );

      // EVENT: escalate_to_superadmin
      socket.on(
        "escalate_to_superadmin",
        this.handleEscalate.bind(this, socket)
      );

      // EVENT: close_conversation
      socket.on(
        "close_conversation",
        this.handleCloseConversation.bind(this, socket)
      );

      // Cleanup on disconnect
      socket.on("disconnect", () => {
        console.log(`User ${socket.data.uid} disconnected`);
      });
    });
  }

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  private async handleSendMessage(
    socket: Socket,
    payload: MessagePayload
  ) {
    try {
      const { conversationID, content, idempotencyKey } = payload;
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);

      // 1. Rate limit check
      if (!checkRateLimit(userId, 10, 60000)) {
        return socket.emit("error", {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many messages. Wait a minute.",
        });
      }

      // 2. Validate content
      const validation = validateMessageContent(content);
      if (!validation.valid) {
        return socket.emit("error", {
          code: "INVALID_MESSAGE",
          message: validation.error,
        });
      }

      // 3. Permission check
      const canAccess = await canUserAccessConversation(
        userId,
        conversationID,
        userRole
      );
      if (!canAccess) {
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "You cannot access this conversation",
        });
      }

      // 4. Get user info (cached display name)
      // TODO: Fetch from Firebase Auth or users collection
      const senderName = "User"; // TODO: Populate from auth

      // 5. Create message in Firestore
      const messageRef = await addDoc(
        collection(db, "chats", conversationID, "messages"),
        {
          conversationID,
          senderUID: userId,
          senderRole: userRole,
          senderName,
          content: content.trim(),
          contentLength: content.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isEdited: false,
          readBy: {},
        }
      );

      const messageID = messageRef.id;

      // 6. Update conversation metadata
      await updateDoc(doc(db, "chats", conversationID, "metadata", "metadata"), {
        lastMessageID: messageID,
        lastMessageText: content.substring(0, 50),
        messageCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // 7. Ensure participant entry
      await setDoc(
        doc(db, "chats", conversationID, "participants", userId),
        {
          userUID: userId,
          role: userRole,
          joinedAt: serverTimestamp(),
          lastSeenAt: serverTimestamp(),
          lastSeenMessageID: messageID,
          isActive: true,
        },
        { merge: true }
      );

      // 8. Broadcast to all in conversation
      this.io.to(conversationID).emit("message_received", {
        conversationID,
        messageID,
        senderUID: userId,
        senderRole: userRole,
        senderName,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      });

      // 9. Acknowledge to sender
      socket.emit("message_sent", {
        messageID,
        status: "sent",
        idempotencyKey,
      });
    } catch (error) {
      console.error("Send message error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to send message",
      });
    }
  }

  private async handleLoadConversation(
    socket: Socket,
    payload: { conversationID: string; limit?: number; beforeMessageID?: string }
  ) {
    try {
      const { conversationID, limit = 50 } = payload;
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);

      // Permission check
      const canAccess = await canUserAccessConversation(
        userId,
        conversationID,
        userRole
      );
      if (!canAccess) {
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "Cannot access this conversation",
        });
      }

      // Fetch messages
      const q = query(
        collection(db, "chats", conversationID, "messages"),
        orderBy("createdAt", "asc"),
        limit(Math.min(limit, 100))
      );

      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map((doc) => ({
        messageID: doc.id,
        ...doc.data(),
      }));

      // Fetch metadata
      const metaDoc = await getDoc(
        doc(db, "chats", conversationID, "metadata", "metadata")
      );
      const metadata = metaDoc.data() || {};

      socket.emit("conversation_loaded", {
        conversationID,
        metadata,
        messages,
      });

      // Join room for real-time updates
      socket.join(conversationID);
    } catch (error) {
      console.error("Load conversation error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to load conversation",
      });
    }
  }

  private async handleListConversations(
    socket: Socket,
    payload: ListConversationsPayload
  ) {
    try {
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);
      const { type, status = "active", limit = 20, offset = 0 } = payload;

      let q;

      if (userRole === "student") {
        // Students only see their own support conversation
        q = query(
          collection(db, "chats"),
          where("type", "==", "student_support"),
          where("studentUID", "==", userId),
          where("status", "==", status),
          orderBy("updatedAt", "desc"),
          limit(Math.min(limit, 100))
        );
      } else if (userRole === "admin") {
        // Admins see all student support conversations
        q = query(
          collection(db, "chats"),
          where("type", "==", "student_support"),
          where("status", "==", status),
          orderBy("updatedAt", "desc"),
          limit(Math.min(limit, 100))
        );
      } else {
        // SuperAdmins see both student support + escalations
        if (type) {
          q = query(
            collection(db, "chats"),
            where("type", "==", type),
            where("status", "==", status),
            orderBy("updatedAt", "desc"),
            limit(Math.min(limit, 100))
          );
        } else {
          // Fetch both types separately (Firestore limitation)
          q = query(
            collection(db, "chats"),
            where("status", "==", status),
            orderBy("updatedAt", "desc"),
            limit(Math.min(limit, 100))
          );
        }
      }

      const snapshot = await getDocs(q);
      const conversations = snapshot.docs.map((doc) => ({
        conversationID: doc.id,
        ...doc.data(),
      }));

      socket.emit("conversations_listed", {
        conversations,
        total: conversations.length,
        hasMore: conversations.length === limit,
      });
    } catch (error) {
      console.error("List conversations error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to load conversations",
      });
    }
  }

  private async handleCreateStudentSupport(
    socket: Socket,
    payload: { studentUID?: string }
  ) {
    try {
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);
      const targetStudentUID = payload.studentUID || userId;

      // Validation: students can only create for themselves
      if (userRole === "student" && targetStudentUID !== userId) {
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "Students can only create conversations for themselves",
        });
      }

      const conversationID = `support__${targetStudentUID}`;

      // Check if already exists
      const existingDoc = await getDoc(
        doc(db, "chats", conversationID, "metadata", "metadata")
      );
      if (existingDoc.exists()) {
        return socket.emit("conversation_created", {
          conversationID,
          status: "existing",
          ...existingDoc.data(),
        });
      }

      // Create new conversation
      await setDoc(
        doc(db, "chats", conversationID, "metadata", "metadata"),
        {
          conversationID,
          type: "student_support",
          studentUID: targetStudentUID,
          createdBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isClosed: false,
          closedAt: null,
          closedBy: null,
          lastMessageID: null,
          lastMessageText: null,
          messageCount: 0,
          status: "active",
          autoCloseDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          deletionScheduledDate: new Date(
            Date.now() + 90 * 24 * 60 * 60 * 1000
          ).toISOString(),
          participantUIDs: [targetStudentUID, userId],
          studentParticipant: targetStudentUID,
        }
      );

      // Broadcast to admins
      this.io.emit("conversation_created", {
        conversationID,
        type: "student_support",
        createdBy: userId,
        studentUID: targetStudentUID,
        createdAt: new Date().toISOString(),
      });

      socket.emit("conversation_created", {
        conversationID,
        status: "created",
      });
    } catch (error) {
      console.error("Create conversation error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to create conversation",
      });
    }
  }

  private async handleEscalate(
    socket: Socket,
    payload: EscalationPayload
  ) {
    try {
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);

      // Only admins can escalate
      if (userRole !== "admin" && userRole !== "superAdmin") {
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "Only admins can escalate",
        });
      }

      const { studentSupportConversationID, reason } = payload;

      // Validate reason
      const reasonValidation = validateEscalationReason(reason);
      if (!reasonValidation.valid) {
        return socket.emit("error", {
          code: "INVALID_REASON",
          message: reasonValidation.error,
        });
      }

      // Check if support conversation exists
      const supportConv = await getDoc(
        doc(db, "chats", studentSupportConversationID, "metadata", "metadata")
      );
      if (!supportConv.exists() || supportConv.data().type !== "student_support") {
        return socket.emit("error", {
          code: "INVALID_CONVERSATION",
          message: "Support conversation not found",
        });
      }

      // Create escalation conversation
      const escalationID = uuidv4();
      const escalationConversationID = `escalation__${userId}_${escalationID}`;

      await setDoc(
        doc(db, "chats", escalationConversationID, "metadata", "metadata"),
        {
          conversationID: escalationConversationID,
          type: "admin_escalation",
          escalationID,
          escalationInitiatedBy: userId,
          escalationReason: reason.trim(),
          escalationCreatedAt: serverTimestamp(),
          studentSupportConversationID,
          createdBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isClosed: false,
          status: "active",
          autoCloseDate: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
          participantUIDs: [userId], // Will add superAdmins as they join
        }
      );

      // Broadcast to superAdmins
      this.io.emit("escalation_created", {
        conversationID: escalationConversationID,
        escalationID,
        studentSupportConversationID,
        escalatedBy: userId,
        escalationReason: reason,
        createdAt: new Date().toISOString(),
      });

      socket.emit("escalation_created", {
        conversationID: escalationConversationID,
        status: "created",
      });
    } catch (error) {
      console.error("Escalate error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to escalate",
      });
    }
  }

  private async handleCloseConversation(
    socket: Socket,
    payload: CloseConversationPayload
  ) {
    try {
      const userId = socket.data.uid;
      const userRole = this.getUserRole(socket.data.claims);

      // Only admins/superAdmins can close
      if (userRole !== "admin" && userRole !== "superAdmin") {
        return socket.emit("error", {
          code: "FORBIDDEN",
          message: "Only admins can close conversations",
        });
      }

      const { conversationID } = payload;

      // Update metadata
      await updateDoc(doc(db, "chats", conversationID, "metadata", "metadata"), {
        isClosed: true,
        closedAt: serverTimestamp(),
        closedBy: userId,
        status: "closed",
      });

      // Broadcast closure
      this.io.to(conversationID).emit("conversation_closed", {
        conversationID,
        closedBy: userId,
        closedAt: new Date().toISOString(),
      });

      socket.emit("conversation_closed", {
        conversationID,
        status: "closed",
      });
    } catch (error) {
      console.error("Close conversation error:", error);
      socket.emit("error", {
        code: "INTERNAL_ERROR",
        message: "Failed to close conversation",
      });
    }
  }

  // ========================================================================
  // HELPERS
  // ========================================================================

  private getUserRole(
    claims: UserClaims
  ): "student" | "admin" | "superAdmin" {
    if (claims.superAdmin) {
      return "superAdmin";
    }
    if (claims.admin) {
      return "admin";
    }
    return "student";
  }

  public getIO(): SocketIOServer {
    return this.io;
  }
}
