/**
 * Chat Repository
 * 
 * Handles all direct Firestore operations for conversations and messages.
 * This is the only place where Firebase/Firestore is accessed for chat.
 * 
 * Purpose: Data access layer. Keeps database operations isolated from business logic.
 */

import { getFirestore } from "../config/firebase.js";
import {
  Conversation,
  ConversationUpdateInput,
  ChatMessage,
  CreateMessageInput,
  PaginatedResponse,
  PaginationCursor,
  ConversationReadState,
} from "../models/chat.js";

type FirestoreQuery = FirebaseFirestore.Query<FirebaseFirestore.DocumentData>;

const CONVERSATIONS_COLLECTION = "chat_conversations";
const MESSAGES_SUBCOLLECTION = "messages";
const READ_STATE_COLLECTION = "chat_read_state";

/**
 * Chat Repository.
 * All Firestore operations for conversations and messages.
 */
export class ChatRepository {
  /**
   * Get or create a conversation by ID.
   * Returns existing conversation if found, or null if not found.
   */
  static async getConversation(conversationID: string): Promise<Conversation | null> {
    const db = getFirestore();
    const docSnap = await db.collection(CONVERSATIONS_COLLECTION).doc(conversationID).get();

    if (!docSnap.exists) {
      return null;
    }

    return {
      conversationID: docSnap.id,
      ...(docSnap.data() || {}),
    } as Conversation;
  }

  /**
   * Create or update a conversation.
   * If conversation exists, updates only the provided fields.
   * Returns the conversation data after write.
   */
  static async upsertConversation(
    conversationID: string,
    data: Partial<Conversation>
  ): Promise<Conversation> {
    const db = getFirestore();
    const now = new Date().toISOString();

    const upsertData = {
      ...data,
      updatedAt: now,
      // Ensure these fields exist on creation
      ...(data.createdAt === undefined && { createdAt: now }),
      ...(data.messageCount === undefined && { messageCount: 0 }),
      ...(data.participants === undefined && { participants: [] }),
    };

    await db.collection(CONVERSATIONS_COLLECTION).doc(conversationID).set(upsertData, { merge: true });

    const updated = await this.getConversation(conversationID);
    if (!updated) {
      throw new Error(`Failed to upsert conversation ${conversationID}`);
    }

    return updated;
  }

  /**
   * Add a message to a conversation.
   * Auto-increments messageCount on the conversation.
   * Returns the created message.
   */
  static async addMessage(input: CreateMessageInput): Promise<ChatMessage> {
    const db = getFirestore();
    const conversationRef = db.collection(CONVERSATIONS_COLLECTION).doc(input.conversationID);
    const messagesRef = conversationRef.collection(MESSAGES_SUBCOLLECTION);

    const now = new Date().toISOString();
    const messageData = {
      senderUID: input.senderUID,
      senderRole: input.senderRole,
      content: input.content,
      idempotencyKey: input.idempotencyKey || undefined,
      createdAt: now,
      deletedAt: null,
    };

    // Use a batch to ensure atomicity
    const batch = db.batch();

    // Add the message
    const newDocRef = messagesRef.doc();
    batch.set(newDocRef, messageData);

    // Get current message count
    const conversationSnap = await conversationRef.get();
    const currentCount = (conversationSnap.data()?.messageCount || 0) as number;

    // Update conversation metadata
    batch.update(conversationRef, {
      messageCount: currentCount + 1,
      lastMessageAt: now,
      lastMessagePreview: input.content.slice(0, 100),
      updatedAt: now,
    });

    await batch.commit();

    return {
      messageID: newDocRef.id,
      conversationID: input.conversationID,
      ...messageData,
    } as ChatMessage;
  }

  /**
   * Get messages in a conversation with cursor-based pagination.
   * 
   * Query pattern: Fetch messages ordered by createdAt descending,
   * optionally starting before a timestamp (for "load earlier" pagination).
   */
  static async getMessages(
    conversationID: string,
    cursor?: PaginationCursor
  ): Promise<PaginatedResponse<ChatMessage>> {
    const db = getFirestore();
    const conversationRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationID);
    const messagesRef = conversationRef.collection(MESSAGES_SUBCOLLECTION);

    const pageLimit = cursor?.limit || 50;

    // NOTE: We intentionally do NOT filter by deletedAt at the query level.
    // Some older messages may not have deletedAt set (undefined), and Firestore
    // can't easily query for "null OR missing". We'll filter in-memory instead.
    let query: FirestoreQuery = messagesRef.orderBy("createdAt", "desc").limit(pageLimit + 25);

    if (cursor?.beforeTimestamp) {
      // Fetch messages before a specific timestamp (for pagination)
      query = messagesRef
        .where("createdAt", "<", cursor.beforeTimestamp)
        .orderBy("createdAt", "desc")
        .limit(pageLimit + 25);
    }

    const querySnap = await query.get();

    // Filter out deleted messages (deletedAt is set to an ISO string when deleted)
    const filteredDocs = querySnap.docs.filter((docSnap) => {
      const data = docSnap.data() || {};
      return !data.deletedAt;
    });

    const hasMore = filteredDocs.length > pageLimit;
    const docs = hasMore ? filteredDocs.slice(0, pageLimit) : filteredDocs;

    const messages: ChatMessage[] = docs.map((docSnap) => ({
      messageID: docSnap.id,
      conversationID,
      ...(docSnap.data() || {}),
    } as ChatMessage));

    // Reverse to return in chronological order (oldest first)
    messages.reverse();

    let nextCursor: PaginationCursor | undefined;
    if (hasMore && messages.length > 0) {
      const lastMessage = messages[0];
      nextCursor = {
        beforeTimestamp: lastMessage.createdAt,
        limit: pageLimit,
      };
    }

    return {
      items: messages,
      hasMore,
      nextCursor,
    };
  }

  /**
   * List recent conversations for an inbox.
   * Returns conversations ordered by most recent message.
   */
  static async listConversations(buildQuery: (ref: FirebaseFirestore.CollectionReference) => FirestoreQuery): Promise<Conversation[]> {
    const db = getFirestore();
    const conversationsRef = db.collection(CONVERSATIONS_COLLECTION);

    const q = buildQuery(conversationsRef);
    const querySnap = await q.get();

    return querySnap.docs.map((docSnap) => ({
      conversationID: docSnap.id,
      ...(docSnap.data() || {}),
    } as Conversation));
  }

  /**
   * List conversations for a student (their support conversation only).
   */
  static async getStudentConversations(studentUID: string): Promise<Conversation[]> {
    const db = getFirestore();
    const conversationsRef = db.collection(CONVERSATIONS_COLLECTION);

    const query = conversationsRef
      .where("participants", "array-contains", studentUID)
      .where("type", "==", "support")
      .limit(50);

    const querySnap = await query.get();

    const conversations = querySnap.docs.map((docSnap) => ({
      conversationID: docSnap.id,
      ...(docSnap.data() || {}),
    } as Conversation));

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return conversations;
  }

  /**
   * List conversations for an admin (all student support + their escalations).
   */
  static async getAdminConversations(adminUID: string): Promise<Conversation[]> {
    const db = getFirestore();
    const conversationsRef = db.collection(CONVERSATIONS_COLLECTION);

    // Privacy: admins see conversations they participate in.
    // Backward-compat: also include support/escalation conversations where adminUID==adminUID,
    // and backfill participants membership to avoid disappearing after reload.

    const participantsQuery = conversationsRef
      .where("participants", "array-contains", adminUID)
      .limit(50);

    const supportClaimQuery = conversationsRef
      .where("type", "==", "support")
      .where("adminUID", "==", adminUID)
      .limit(50);

    const escalationOwnerQuery = conversationsRef
      .where("type", "==", "escalation")
      .where("adminUID", "==", adminUID)
      .limit(50);

    const [pSnap, sSnap, eSnap] = await Promise.all([
      participantsQuery.get(),
      supportClaimQuery.get(),
      escalationOwnerQuery.get(),
    ]);

    const byId = new Map<string, Conversation>();
    for (const snap of [pSnap, sSnap, eSnap]) {
      snap.forEach((docSnap) => {
        byId.set(docSnap.id, {
          conversationID: docSnap.id,
          ...(docSnap.data() || {}),
        } as Conversation);
      });
    }

    const conversations = Array.from(byId.values());

    // Backfill: ensure admin is in participants for all returned conversations.
    await Promise.all(
      conversations.map(async (conv) => {
        const participants = Array.isArray(conv.participants) ? conv.participants : [];
        if (!participants.includes(adminUID)) {
          await this.updateConversation(conv.conversationID, {
            participants: [...participants, adminUID],
          });
          conv.participants = [...participants, adminUID];
        }
      })
    );

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return conversations.slice(0, 50);
  }

  /**
   * List conversations for a superAdmin (all conversations).
   */
  static async getSuperAdminConversations(superAdminUID: string): Promise<Conversation[]> {
    const db = getFirestore();
    const conversationsRef = db.collection(CONVERSATIONS_COLLECTION);

    // SuperAdmins should see escalation conversations (their inbox).
    // Backward-compat: older escalation conversations may not have participants populated for superAdmins.
    // We list escalations and backfill participants membership so they remain visible after reload.

    const escalationsQuery = conversationsRef
      .where("type", "==", "escalation")
      .limit(50);

    const querySnap = await escalationsQuery.get();

    const conversations = querySnap.docs.map((docSnap) => ({
      conversationID: docSnap.id,
      ...(docSnap.data() || {}),
    } as Conversation));

    await Promise.all(
      conversations.map(async (conv) => {
        const participants = Array.isArray(conv.participants) ? conv.participants : [];
        if (!participants.includes(superAdminUID)) {
          await this.updateConversation(conv.conversationID, {
            participants: [...participants, superAdminUID],
          });
          conv.participants = [...participants, superAdminUID];
        }
      })
    );

    conversations.sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );

    return conversations;
  }

  /**
   * Soft-delete a message (marks as deletedAt).
   */
  static async deleteMessage(
    conversationID: string,
    messageID: string
  ): Promise<void> {
    const db = getFirestore();
    const messageRef = db
      .collection(CONVERSATIONS_COLLECTION)
      .doc(conversationID)
      .collection(MESSAGES_SUBCOLLECTION)
      .doc(messageID);

    await messageRef.update({
      deletedAt: new Date().toISOString(),
    });
  }

  /**
   * Update conversation metadata (status, participants, etc.).
   */
  static async updateConversation(
    conversationID: string,
    updates: ConversationUpdateInput
  ): Promise<void> {
    const db = getFirestore();

    await db.collection(CONVERSATIONS_COLLECTION).doc(conversationID).update({
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Check if a message with idempotency key already exists.
   * Used to prevent duplicate messages on retry.
   */
  static async messageExistsByIdempotencyKey(
    conversationID: string,
    idempotencyKey: string
  ): Promise<ChatMessage | null> {
    const db = getFirestore();
    const conversationRef = db.collection(CONVERSATIONS_COLLECTION).doc(conversationID);
    const messagesRef = conversationRef.collection(MESSAGES_SUBCOLLECTION);

    const query = messagesRef
      .where("idempotencyKey", "==", idempotencyKey)
      .limit(1);

    const querySnap = await query.get();
    if (querySnap.empty) {
      return null;
    }

    const docSnap = querySnap.docs[0];
    return {
      messageID: docSnap.id,
      conversationID,
      ...(docSnap.data() || {}),
    } as ChatMessage;
  }

  /**
   * Get a specific message by ID.
   * Used for Phase 5 read receipts (to map messageID -> createdAt timestamp).
   */
  static async getMessageById(
    conversationID: string,
    messageID: string
  ): Promise<ChatMessage | null> {
    const db = getFirestore();
    const docSnap = await db
      .collection(CONVERSATIONS_COLLECTION)
      .doc(conversationID)
      .collection(MESSAGES_SUBCOLLECTION)
      .doc(messageID)
      .get();

    if (!docSnap.exists) return null;

    return {
      messageID: docSnap.id,
      conversationID,
      ...(docSnap.data() || {}),
    } as ChatMessage;
  }

  /**
   * Get read state for a user in a conversation.
   * Returns null if not found.
   */
  static async getReadState(
    conversationID: string,
    userUID: string
  ): Promise<ConversationReadState | null> {
    const db = getFirestore();
    const readStateID = `${conversationID}:${userUID}`;
    const docSnap = await db.collection(READ_STATE_COLLECTION).doc(readStateID).get();

    return docSnap.exists ? (docSnap.data() as ConversationReadState) : null;
  }

  /**
   * Update read state for a user in a conversation.
   * Phase 5: persistent read receipts backing server-side unread counts.
   */
  static async updateReadState(
    conversationID: string,
    userUID: string,
    readUpToMessageID: string,
    readUpToTimestamp: string
  ): Promise<void> {
    const db = getFirestore();
    const readStateID = `${conversationID}:${userUID}`;

    await db.collection(READ_STATE_COLLECTION).doc(readStateID).set(
      {
        conversationID,
        userUID,
        readUpToMessageID,
        readUpToTimestamp,
        unreadCount: 0,
        lastUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  /**
   * Count unread messages after a given timestamp.
   * Used to compute server-backed unreadCount for inbox lists.
   */
  static async countUnreadMessagesAfter(
    conversationID: string,
    afterTimestamp: string,
    maxCount = 999
  ): Promise<number> {
    const db = getFirestore();
    const messagesRef = db
      .collection(CONVERSATIONS_COLLECTION)
      .doc(conversationID)
      .collection(MESSAGES_SUBCOLLECTION);

    const query = messagesRef
      .where("createdAt", ">", afterTimestamp)
      .orderBy("createdAt", "asc")
      .limit(maxCount + 25);

    const snap = await query.get();
    const count = snap.docs.filter((d) => !(d.data() as any)?.deletedAt).length;
    return Math.min(count, maxCount);
  }
}
