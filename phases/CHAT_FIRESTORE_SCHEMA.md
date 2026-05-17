# Chat System Firestore Schema (Phase 1)

**Status:** Phase 1 data model  
**Last Updated:** May 5, 2026

---

## Overview

This document describes the Firestore database structure for the chat system. The schema supports:
- **Support conversations**: One per student (`support:<studentUID>`)
- **Escalation conversations**: Multiple per admin (`escalation:<adminUID>:<escalationID>`)
- **Real-time message delivery** via Firestore listeners
- **Role-based access control** via Firestore security rules

---

## Collections

### 1. `chat_conversations`

Top-level collection containing all conversations (support + escalation).

**Document ID:** Conversation ID
- Support: `support:<studentUID>`
- Escalation: `escalation:<adminUID>:<escalationID>`

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `conversationID` | string | Yes | Mirrors document ID |
| `type` | string | Yes | `"support"` or `"escalation"` |
| `status` | string | Yes | `"active"` or `"closed"` |
| `studentUID` | string | No | Present only for support conversations |
| `adminUID` | string | No | Present only for escalation conversations |
| `escalationID` | string | No | Present only for escalation conversations |
| `escalationReason` | string | No | Why admin escalated (max 500 chars) |
| `participants` | array | Yes | Array of user UIDs who participate |
| `messageCount` | number | Yes | Total messages (for quick metadata) |
| `lastMessageAt` | string | Yes | ISO timestamp of last message |
| `lastMessagePreview` | string | No | First 100 chars of last message |
| `closedAt` | string | No | ISO timestamp when conversation closed |
| `createdAt` | string | Yes | ISO timestamp |
| `updatedAt` | string | Yes | ISO timestamp |

**Example (Support):**
```json
{
  "conversationID": "support:student-123",
  "type": "support",
  "status": "active",
  "studentUID": "student-123",
  "adminUID": null,
  "participants": ["student-123"],
  "messageCount": 5,
  "lastMessageAt": "2026-05-05T14:30:00Z",
  "lastMessagePreview": "Can I get a helium tank by tomorrow?",
  "createdAt": "2026-04-28T09:15:00Z",
  "updatedAt": "2026-05-05T14:30:00Z"
}
```

**Example (Escalation):**
```json
{
  "conversationID": "escalation:admin-456:abc123",
  "type": "escalation",
  "status": "active",
  "studentUID": null,
  "adminUID": "admin-456",
  "escalationID": "abc123",
  "escalationReason": "Student requires special approval for expensive equipment",
  "participants": ["admin-456"],
  "messageCount": 2,
  "lastMessageAt": "2026-05-05T16:45:00Z",
  "lastMessagePreview": "I can approve this request.",
  "createdAt": "2026-05-05T16:20:00Z",
  "updatedAt": "2026-05-05T16:45:00Z"
}
```

---

### 2. `chat_conversations/{conversationID}/messages`

Subcollection of messages within each conversation.

**Document ID:** Auto-generated (Firebase document ID)

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `conversationID` | string | Yes | Parent conversation ID |
| `messageID` | string | No | (Mirrors document ID, populated on read) |
| `senderUID` | string | Yes | User who sent the message |
| `senderRole` | string | Yes | `"student"`, `"admin"`, or `"superAdmin"` |
| `content` | string | Yes | Message text (1-5000 chars) |
| `idempotencyKey` | string | No | Prevents duplicate sends on retry |
| `createdAt` | string | Yes | ISO timestamp |
| `updatedAt` | string | No | ISO timestamp if edited (Phase 2) |
| `deletedAt` | string | No | ISO timestamp for soft-deleted messages |

**Example:**
```json
{
  "senderUID": "student-123",
  "senderRole": "student",
  "content": "Can I get a helium tank by tomorrow?",
  "idempotencyKey": "msg-uuid-1",
  "createdAt": "2026-05-05T14:30:00Z",
  "deletedAt": null
}
```

**Soft Delete Pattern:**
- Messages are NOT hard-deleted; instead `deletedAt` is set
- Queries filter WHERE `deletedAt == null` to exclude deleted messages
- Allows audit trails and recovery (Phase 2+)

---

### 3. `chat_read_state`

Tracks per-user read position in conversations (Phase 5 placeholder).

**Document ID:** `{conversationID}:{userUID}`

**Fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `conversationID` | string | Yes | Reference to conversation |
| `userUID` | string | Yes | User who read |
| `readUpToMessageID` | string | No | Last message read by this user |
| `readUpToTimestamp` | string | No | ISO timestamp of last read message |
| `unreadCount` | number | No | Count of unread messages (denormalized) |
| `lastUpdatedAt` | string | Yes | When this read state was updated |

**Example:**
```json
{
  "conversationID": "support:student-123",
  "userUID": "admin-456",
  "readUpToMessageID": "msg-doc-5",
  "readUpToTimestamp": "2026-05-05T14:30:00Z",
  "unreadCount": 0,
  "lastUpdatedAt": "2026-05-05T14:35:00Z"
}
```

**Note:** This collection is placeholder for Phase 5. Not used in Phase 1.

---

## Required Firestore Indexes

Firestore auto-creates single-field indexes, but composite indexes are required for multi-field queries.

### Composite Indexes

| Collection | Fields | Order | Status | Notes |
|-----------|--------|-------|--------|-------|
| `chat_conversations` | `(type, lastMessageAt)` | `type: ASC, lastMessageAt: DESC` | **REQUIRED** | For listing conversations by type |
| `chat_conversations/{convID}/messages` | `(deletedAt, createdAt)` | `deletedAt: ASC, createdAt: DESC` | **REQUIRED** | For paginating messages excluding soft-deletes |
| `chat_conversations` | `(type, status, lastMessageAt)` | `type: ASC, status: ASC, lastMessageAt: DESC` | **OPTIONAL** | For filtering by status (future optimization) |

### How to Create Indexes

**Option 1: Firebase Console (Easiest)**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Firestore Database
3. Go to **Indexes** tab
4. Click **Create Index**
5. Fill in collection, fields, and ordering
6. Click **Create Index**

**Option 2: Firebase CLI**
```bash
firebase firestore:indexes
```

**Option 3: Automatic (on first query)**
- When you run a query that needs an index, Firestore shows an error with a link
- Click the link to auto-create the index

---

## Query Patterns

### Query 1: Get Support Conversations (for Admin Queue)

```typescript
const supportQuery = query(
  collection(db, "chat_conversations"),
  where("type", "==", "support"),
  orderBy("lastMessageAt", "desc"),
  limit(50)
);
```

**Index Required:** `(type, lastMessageAt)`

---

### Query 2: Get Messages in a Conversation

```typescript
const messagesQuery = query(
  collection(conversationRef, "messages"),
  where("deletedAt", "==", null),
  orderBy("createdAt", "desc"),
  limit(50)
);
```

**Index Required:** `(deletedAt, createdAt)`

---

### Query 3: Get Conversations for Admin (Support + Escalations)

```typescript
// Query 1: All support conversations
const supportQuery = query(
  collection(db, "chat_conversations"),
  where("type", "==", "support"),
  orderBy("lastMessageAt", "desc"),
  limit(25)
);

// Query 2: Admin's own escalations
const escalationQuery = query(
  collection(db, "chat_conversations"),
  where("type", "==", "escalation"),
  where("adminUID", "==", adminUID),
  orderBy("lastMessageAt", "desc"),
  limit(25)
);
```

**Indexes Required:** `(type, lastMessageAt)` and `(type, adminUID, lastMessageAt)`

---

### Query 4: Get Conversations for Student (Support Only)

```typescript
const studentQuery = query(
  collection(db, "chat_conversations"),
  where("studentUID", "==", studentUID),
  where("type", "==", "support"),
  limit(1) // Should be exactly one per student
);
```

**Indexes Required:** `(studentUID, type)`

---

### Query 5: Cursor-Based Pagination (Load Older Messages)

```typescript
const paginationQuery = query(
  collection(conversationRef, "messages"),
  where("deletedAt", "==", null),
  where("createdAt", "<", beforeTimestamp), // Cursor
  orderBy("createdAt", "desc"),
  limit(50)
);
```

**Index Required:** `(deletedAt, createdAt)`

---

### Query 6: Idempotency Check (Dedup Messages)

```typescript
const dedupQuery = query(
  collection(conversationRef, "messages"),
  where("idempotencyKey", "==", idempotencyKey),
  limit(1)
);
```

**Index Required:** Single field index on `idempotencyKey` (auto-created)

---

## Access Control (Security Rules)

See `firebase/firestore_chat_rules.rules` for full rule definitions.

**High-level rules:**
- **Students:** Can read own support conversation only
- **Admins:** Can read all support conversations + their own escalations
- **SuperAdmins:** Can read all conversations
- **Client Writes:** Blocked (server-only via Cloud Functions or Admin SDK)

---

## Data Retention & Cleanup

### Message Retention

- **Active messages:** Retained indefinitely
- **Deleted messages:** Soft-delete via `deletedAt` field (kept for audit)
- **Auto-purge:** Phase 1.5 will implement scheduled Cloud Function to hard-delete messages after 90 days

### Conversation Retention

- **Active conversations:** Retained indefinitely
- **Closed conversations:** Retained indefinitely (mark as `status: "closed"`)
- **Auto-close:** Phase 1.5 will implement scheduled Cloud Function to auto-close conversations after 30 days of inactivity

### Archival (MongoDB Backup)

- Phase 1.5 will implement nightly Cloud Function to archive conversations/messages to MongoDB
- MongoDB is backup only; Firestore is source of truth for Phase 1

---

## Performance Considerations

### Read Operations

- **List conversations:** 50 docs/query (configurable) - typically <500 ms
- **Get conversation:** 1 doc read - typically <100 ms
- **List messages:** 50 messages/query - typically <300 ms

### Write Operations

- **Add message:** 2 writes (message doc + update conversation) - typically <500 ms
- **Create conversation:** 1 write - typically <200 ms

### Scaling

- **Concurrent users target:** <100 (Phase 1 MVP)
- **Estimated daily reads:** ~10,000 - well within free tier
- **Estimated daily writes:** ~1,000 - well within free tier
- **Cost:** Negligible for MVP scale

---

## Migration Notes (from Phase 0)

Phase 0 had a complete Socket.io skeleton with in-memory types. Phase 1 formalizes the data model:

**Changes:**
1. ✅ `Conversation` type formalized with all fields
2. ✅ `ChatMessage` type formalized
3. ✅ `ConversationReadState` placeholder added (Phase 5)
4. ✅ Repository layer created (data access)
5. ✅ Service layer created (business logic)
6. ✅ Permission checks moved to service
7. ✅ Validation moved to service
8. ✅ Deterministic conversation ID helpers formalized

**What stays the same:**
- Socket.io event contract (Phase 0 spec)
- UI components (Phase 0 React code)
- Security rules (Phase 0 Firestore rules)

**Next phase (Phase 2):**
- Integrate service layer into Socket.io handlers
- Implement real-time listeners in React context
- Add HTTP endpoints (optional fallback)

---

## Development Checklist

### Before Phase 2:
- [ ] Understand Firestore document structure
- [ ] Create required composite indexes in Firebase Console
- [ ] Test queries locally with Firebase Emulator
- [ ] Review security rules (`firestore_chat_rules.rules`)
- [ ] Test role-based access control

### Testing Patterns

**Unit test example (Chat Data Service):**
```typescript
it("should generate deterministic support conversation ID", () => {
  const id = ChatDataService.generateSupportConversationID("student-123");
  expect(id).toBe("support:student-123");
  
  // Same input = same output (deterministic)
  const id2 = ChatDataService.generateSupportConversationID("student-123");
  expect(id).toBe(id2);
});

it("should validate message content", () => {
  const result = ChatDataService.validateMessageContent("Hello");
  expect(result.valid).toBe(true);
  
  const tooLong = ChatDataService.validateMessageContent("x".repeat(5001));
  expect(tooLong.valid).toBe(false);
});

it("should check permission for student to access own conversation", () => {
  const user = { uid: "student-123", isAdmin: false, isSuperAdmin: false };
  const conversation = { type: "support", studentUID: "student-123" };
  
  expect(ChatDataService.canUserAccessConversation(user, conversation)).toBe(true);
});
```

---

## Common Issues & Troubleshooting

### Issue: "Missing index" error on query

**Cause:** Query uses compound fields without corresponding index

**Solution:**
1. Firestore shows error with link to create index
2. Click link or manually create in Firebase Console
3. Wait 1-2 minutes for index build
4. Retry query

### Issue: Permission denied when querying conversations

**Cause:** Firestore security rules blocking read

**Solution:**
1. Check user's role (admin/superAdmin/student)
2. Verify conversation type matches user's access level
3. Check `firestore_chat_rules.rules` for rule logic

### Issue: Messages not in chronological order

**Cause:** Client reversed order for UI but didn't store correctly

**Solution:**
- Repository orders by `createdAt DESC` (newest first)
- Reverse in client before display if needed
- See `ChatRepository.getMessages()` for pattern

---

## References

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firestore Indexes](https://firebase.google.com/docs/firestore/query-data/index-overview)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- Phase 0 Spec: `CHAT_SYSTEM_PHASE_0.md`
- Chat Models: `server/src/models/chat.ts`
- Chat Repository: `server/src/repositories/chat.repo.ts`
- Chat Service: `server/src/services/chat-data.service.ts`
