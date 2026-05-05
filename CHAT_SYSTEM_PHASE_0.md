# Chat System – Phase 0 Design Specification

**Date:** May 5, 2026  
**Status:** Design Phase  
**Scope:** Architecture, schema, and API contract for real-time chat system

---

## 1. Executive Summary

This spec defines a **two-tier support chat system** for the Fishlers equipment management app:

1. **Student Support Chat** – Students ↔ Any Admin (shared queue model)
2. **Admin Escalation Chat** – Admins ↔ SuperAdmins (group channel)

**Technology Stack:**
- Real-time: Socket.io (WebSocket)
- Primary DB: Firestore
- Backup DB: MongoDB (for audit trail only; not used for live chat)
- Auth: Firebase ID tokens + custom claims

**MVP Scope:**
- Text-only messages
- No typing indicators, read receipts, message editing
- 90-day message retention
- 30-day conversation auto-close
- Max 5–10 KB message length

---

## 2. Conversation ID Strategy

### 2.1 Student Support Chat

**Format:** `support__{studentUID}`

- **Components:**
  - Prefix: `support__` (indicates student support type)
  - StudentUID: Firebase UID of the student
  
- **Invariant:** One conversation per student, regardless of how many requests they have.
- **Creation:** Auto-created when student sends first message; alternatively, created by admin when initiating outreach.
- **Namespace:** Isolates student support from escalation chats.

**Example:** `support__abc123def456`

### 2.2 Admin Escalation Chat

**Format:** `escalation__{adminUID}_{escalationID}`

- **Components:**
  - Prefix: `escalation__` (indicates admin escalation type)
  - AdminUID: Firebase UID of the admin who initiated escalation
  - EscalationID: Unique ID (UUID v4 or Firestore doc ID)

- **Invariant:** Multiple escalations per admin are separate conversations.
- **Visibility:** All superAdmins can see and respond to any escalation.
- **Creation:** Admin explicitly initiates escalation from student support chat.

**Example:** `escalation__admin789__esc-uuid-12345`

---

## 3. Permission Matrix

| Action | Student | Admin | SuperAdmin | Notes |
|--------|---------|-------|-----------|-------|
| **View own support chat** | ✅ | – | – | Read/write their student support thread |
| **View any student support chat** | ❌ | ✅ | ✅ | Admins can see all student support convs (shared queue) |
| **Send message to student support** | ✅ | ✅ | ✅ | Student sends → their own; Admin/SuperAdmin sends → all student chats |
| **View own escalation chat** | ❌ | ✅ (if creator) | ✅ | Admin sees their escalations; all superAdmins see all escalations |
| **Send message to escalation chat** | ❌ | ✅ (only creator) | ✅ | Only initiating admin or any superAdmin can respond |
| **Close student chat** | ❌ | ✅ | ✅ | Admin/SuperAdmin can manually close a student conv |
| **Create escalation** | ❌ | ✅ | – | Only admins escalate to superAdmins |
| **Search/export chat history** | ❌ | ✅ (own only initially) | ✅ (any) | Phase 2+ feature |

---

## 4. Firestore Schema

### 4.1 Collections Overview

```
firestore/
├── chats/                        # Root: all conversation threads
│   ├── {conversationID}/
│   │   ├── metadata             # Conversation metadata document
│   │   ├── messages/            # Subcollection of all messages
│   │   │   └── {messageID}/     # Individual message
│   │   └── participants/        # Subcollection of participants
│   │       └── {userUID}/       # Quick permission check
│   │
│   └── {conversationID2}/
│       └── ...
│
└── chat_metadata/               # For indexing/analytics (optional Phase 1)
    └── {conversationID}/        # Denormalized metadata
```

### 4.2 `chats/{conversationID}/metadata`

**Purpose:** Core conversation data  
**Ownership:** Auto-created; read/write by system

```json
{
  "conversationID": "support__abc123def456",
  "type": "student_support",             // OR "admin_escalation"
  "studentUID": "abc123def456",          // For student_support only
  "createdBy": "abc123def456",           // UID of creator (student or admin)
  "createdAt": 2026-05-05T10:30:00Z,     // Server timestamp
  "updatedAt": 2026-05-05T14:45:00Z,     // Last message sent
  "isClosed": false,
  "closedAt": null,                      // Timestamp if manually closed
  "closedBy": null,                      // UID of closer
  "lastMessageID": "msg_uuid_7",         // For sorting/pagination
  "lastMessageText": "Thanks for the help!", // Preview
  "messageCount": 42,
  "status": "active",                    // "active" | "closed" | "archived"
  "autoCloseDate": 2026-06-04,           // 30 days from last activity
  "deletionScheduledDate": 2026-08-04,   // 90 days from creation
  "escalationID": null,                  // For escalations: UUID
  "escalationInitiatedBy": null,         // For escalations: admin UID
  "escalationReason": null,              // For escalations: brief text
  "escalationCreatedAt": null,           // For escalations: timestamp
  
  // Participant summary (for quick access)
  "participantUIDs": ["abc123def456", "admin789ghi012", "super123jkl456"],
  "adminParticipants": ["admin789ghi012", "super123jkl456"],
  "studentParticipant": "abc123def456"   // For student_support type only
}
```

### 4.3 `chats/{conversationID}/messages/{messageID}`

**Purpose:** Individual chat messages  
**Ownership:** Auto-created on message send; immutable

```json
{
  "messageID": "msg_uuid_42",
  "conversationID": "support__abc123def456",
  "senderUID": "abc123def456",
  "senderRole": "student",               // "student" | "admin" | "superAdmin"
  "senderName": "Alice Johnson",         // Cached for display
  "senderEmail": "alice@university.edu", // Cached for support context
  "content": "Can I return this equipment?",
  "contentLength": 32,
  "createdAt": 2026-05-05T10:32:45Z,    // Server timestamp
  "updatedAt": 2026-05-05T10:32:45Z,    // Same as createdAt (no edits in V1)
  "isEdited": false,                     // For V2+ support
  "deletionScheduledAt": 2026-08-04,    // Scheduled deletion (90 days)
  
  // Read receipt (Phase 2+)
  "readBy": {},                          // Phase 2: { "admin789": timestamp, ... }
  
  // Attachments (Phase 2+)
  "attachments": []                      // Phase 2: { "type": "image", "url": "...", ... }
}
```

### 4.4 `chats/{conversationID}/participants/{userUID}`

**Purpose:** Lightweight permission tracking  
**Ownership:** System-managed; updated on message send

```json
{
  "userUID": "admin789ghi012",
  "role": "admin",                       // "student" | "admin" | "superAdmin"
  "joinedAt": 2026-05-05T10:31:00Z,     // First time in conversation
  "lastSeenAt": 2026-05-05T14:00:00Z,   // Last activity (for analytics)
  "lastSeenMessageID": "msg_uuid_40",
  "isActive": true                       // For detecting who's "in" the chat
}
```

### 4.5 Firestore Indexes (for querying)

**Required Indexes:**

1. **Student Support Listing (for Admin Dashboard)**
   - Collection: `chats`
   - Filters:
     - `type` == `student_support`
     - `status` == `active`
   - Sort: `updatedAt DESC`
   - Composite Index: `(type, status, updatedAt DESC)`

2. **Escalation Listing (for SuperAdmin Dashboard)**
   - Collection: `chats`
   - Filters:
     - `type` == `admin_escalation`
     - `isClosed` == `false`
   - Sort: `createdAt DESC`
   - Composite Index: `(type, isClosed, createdAt DESC)`

3. **Message Listing (within a conversation)**
   - Collection: `chats/{conversationID}/messages`
   - Sort: `createdAt ASC`
   - Simple Index (auto-created by Firestore)

---

## 5. API & Socket.io Contract

### 5.1 Socket.io Events

**Namespace:** `/chat`

#### **Client → Server**

##### `send_message`
Send a chat message.

```json
{
  "conversationID": "support__abc123def456",
  "content": "What's the replacement policy?",
  "idempotencyKey": "client_uuid_123"  // For deduplication
}
```

**Response:** `message_sent` event with full message object.

**Validation:**
- User must be in conversation (permission check)
- Content: 1–5000 chars (5–10 KB max)
- Rate limit: 10 messages/min per user

---

##### `create_student_support_conversation`
Student initiates support chat (or admin initiates on behalf of student).

```json
{
  "studentUID": "abc123def456"  // Optional; defaults to self if student
}
```

**Response:** `conversation_created` with conversation metadata.

**Validation:**
- Student can only create for self
- Admin/SuperAdmin can create for any student
- Idempotent: returns existing conversation if already exists

---

##### `escalate_to_superadmin`
Admin escalates student support issue to superAdmins.

```json
{
  "studentSupportConversationID": "support__abc123def456",
  "reason": "Equipment damage claim - requires approval",
  "idempotencyKey": "client_uuid_456"
}
```

**Response:** `escalation_created` with new escalation conversation ID.

**Validation:**
- Only admins can escalate
- Must reference existing student support conversation
- Reason: 1–500 chars

---

##### `close_conversation`
Admin/SuperAdmin closes a conversation.

```json
{
  "conversationID": "support__abc123def456"
}
```

**Response:** `conversation_closed` with updated metadata.

**Validation:**
- Admin/SuperAdmin only
- Sets `isClosed = true`, `closedAt = now`, `closedBy = userUID`

---

##### `load_conversation`
Load a conversation and its recent messages (pagination support).

```json
{
  "conversationID": "support__abc123def456",
  "limit": 50,
  "beforeMessageID": "msg_uuid_30"  // For pagination
}
```

**Response:** `conversation_loaded` with messages array (newest last).

---

##### `list_conversations`
List conversations accessible to the user.

```json
{
  "type": "student_support",  // Optional filter: "student_support" or "admin_escalation"
  "status": "active",         // Optional: "active" | "closed" | "archived"
  "limit": 20,
  "offset": 0
}
```

**Response:** `conversations_listed` with array of conversation metadata.

---

#### **Server → Client (Broadcasts)**

##### `message_received`
New message in a conversation the client is viewing.

```json
{
  "conversationID": "support__abc123def456",
  "messageID": "msg_uuid_42",
  "senderUID": "admin789ghi012",
  "senderRole": "admin",
  "senderName": "Bob Admin",
  "content": "Sure! Send photos of the damage.",
  "createdAt": 2026-05-05T14:50:00Z
}
```

**Broadcast to:** All users in the conversation.

---

##### `conversation_created`
New conversation created (e.g., admin initiated support chat).

```json
{
  "conversationID": "support__xyz789abc123",
  "type": "student_support",
  "createdBy": "admin789ghi012",
  "createdAt": 2026-05-05T10:00:00Z,
  "studentUID": "xyz789abc123",
  "studentName": "Carol Student"
}
```

**Broadcast to:** Relevant admins (all, for shared queue).

---

##### `escalation_created`
New escalation created.

```json
{
  "conversationID": "escalation__admin789__esc-uuid-1",
  "escalationID": "esc-uuid-1",
  "studentSupportConversationID": "support__abc123def456",
  "escalatedBy": "admin789ghi012",
  "escalationReason": "Equipment damage claim",
  "createdAt": 2026-05-05T15:10:00Z
}
```

**Broadcast to:** All superAdmins + initiating admin.

---

##### `conversation_closed`
Conversation closed by admin.

```json
{
  "conversationID": "support__abc123def456",
  "closedBy": "admin789ghi012",
  "closedAt": 2026-05-05T16:00:00Z,
  "reason": "Issue resolved"  // Optional
}
```

**Broadcast to:** All conversation participants.

---

### 5.2 HTTP REST Endpoints (Optional, for non-real-time operations)

#### `GET /api/chat/conversations`
List conversations with optional filters.

**Query Params:**
- `type`: `student_support` | `admin_escalation`
- `status`: `active` | `closed` | `archived`
- `limit`: 1–100 (default 20)
- `offset`: 0+

**Response:**
```json
{
  "data": [
    { "conversationID": "...", "type": "...", ... },
    ...
  ],
  "total": 42,
  "hasMore": true
}
```

---

#### `GET /api/chat/conversations/{conversationID}`
Fetch a single conversation metadata + recent messages.

**Query Params:**
- `limit`: 1–100 (default 50)
- `beforeMessageID`: (optional, for pagination)

**Response:**
```json
{
  "metadata": { ... },
  "messages": [ ... ],
  "participants": [ ... ]
}
```

---

#### `POST /api/chat/conversations/{conversationID}/messages`
Send a message (alternative to Socket.io, for reliability).

**Request:**
```json
{
  "content": "Message text",
  "idempotencyKey": "uuid"  // Prevents duplicates
}
```

**Response:**
```json
{
  "messageID": "msg_uuid_42",
  "status": "sent"
}
```

---

#### `POST /api/chat/conversations/{conversationID}/close`
Close a conversation.

**Request:**
```json
{
  "reason": "Optional reason"
}
```

**Response:**
```json
{
  "conversationID": "...",
  "status": "closed",
  "closedAt": "..."
}
```

---

## 6. UI Screens & Flows

### 6.1 Student View

#### **Screen: "Support Chat"**
- **Route:** `/support-chat`
- **Layout:**
  - Header: "Equipment Support"
  - Main area: Conversation thread (messages, newest at bottom)
  - Input: Text field + Send button
  - Status indicator: "Chat active" | "Chat closed by admin"

**Actions:**
- View conversation history (scroll up to load older messages)
- Send message
- See when admin is typing (Phase 2)
- Notification when conversation closed

**Behavior:**
- Student enters chat; if `support__{studentUID}` doesn't exist, create it
- Messages load lazily (50 at a time)
- Conversation auto-closes 30 days after last message (warn student if approaching close date)

---

### 6.2 Admin View

#### **Screen 1: "Support Queue Dashboard"**
- **Route:** `/admin/support-queue`
- **Layout:**
  - Header: "Student Support Requests" + quick stats
  - List: Active student support conversations
    - Each row: Student name, last message preview, time since last message, unread indicator
  - Filter options: Active | Closed | (Search by student name)
  - **Sorting:** Most recent first

**Actions:**
- Click conversation to open chat
- Mark as read (Phase 2)
- Manually close conversation

---

#### **Screen 2: "Support Chat Thread"**
- **Route:** `/admin/support-queue/{conversationID}`
- **Layout:**
  - Header: Student name + status
  - Sidebar (right): Student info card
    - Name, email, studentNumber, requests count
    - Last 3 request previews (links to request details)
  - Main area: Conversation thread
  - Input: Text field + Send + "Escalate" button
  - Status: Open | Closed

**Actions:**
- Send message to student
- Escalate to superAdmin (button opens modal with reason)
- View student's equipment requests (sidebar)
- Close conversation

---

### 6.3 SuperAdmin View

#### **Screen 1: "Escalation Queue Dashboard"**
- **Route:** `/admin/escalations`
- **Layout:**
  - Header: "Admin Escalations" + stats (pending, overdue)
  - List: Active escalations
    - Each row: Escalated by (admin name), reason, time since created, high-priority flag
  - Filter options: Pending | Closed | (Search by admin name or reason)
  - **Sorting:** Oldest first (SLA-driven)

**Actions:**
- Click escalation to open chat
- See which superAdmins are already in the conversation

---

#### **Screen 2: "Escalation Chat Thread"**
- **Route:** `/admin/escalations/{conversationID}`
- **Layout:**
  - Header: Escalation reason + admin who escalated
  - Sidebar (right): Escalation info
    - Admin name, reason, created date
    - Link to original student support conversation
    - Suggested actions (e.g., "Approve refund", "Schedule inspection")
  - Main area: Conversation thread (all superAdmins in one view)
  - Input: Text field + Send button
  - Status: Open | Closed

**Actions:**
- Send message to escalating admin (and other superAdmins)
- Close escalation
- Link to original student conversation

---

## 7. Non-Functional Requirements

### 7.1 Performance

| Requirement | Target | Notes |
|-------------|--------|-------|
| **Message send latency** | < 500 ms | E2E: client send → message appears for others |
| **Conversation list load** | < 1 s | Load first 20 conversations |
| **Message history load** | < 800 ms | Load 50 messages |
| **WebSocket connection** | < 2 s | Socket.io initial handshake |
| **Concurrent connections** | 100+ (target), 50+ (guaranteed) | Per Node.js instance |

### 7.2 Rate Limiting

| Resource | Limit | Window | Action |
|----------|-------|--------|--------|
| **Message send** | 10 msgs/user | 1 min | Drop excess; respond with `rate_limit` event |
| **Conversation list** | 10 reqs/user | 1 min | HTTP 429 |
| **Escalation create** | 20 escalations/admin | 1 day | HTTP 429 |

### 7.3 Data Validation

| Field | Rule |
|-------|------|
| **Message content** | 1–5000 chars; no null bytes; UTF-8 valid |
| **Conversation ID** | Alphanumeric + underscore + UUID; max 100 chars |
| **Reason (escalation)** | 1–500 chars; no HTML/scripts |
| **Names (cached)** | Synced from Firebase Auth at send time |

### 7.4 Data Retention & Compliance

| Data | Retention | Action | Notes |
|------|-----------|--------|-------|
| **Messages** | 90 days | Auto-delete (scheduled job) | Soft-delete first; hard-delete after 7 days |
| **Conversations** | Archive after 30 days inactive | Auto-archive | Can reopen if student messages again |
| **Escalations** | 1 year | Audit log only | Firestore document archived to MongoDB |
| **Read receipts** (Phase 2) | 7 days | Auto-delete | Not critical |

### 7.5 Abuse Prevention (MVP)

| Issue | Mitigation |
|-------|-----------|
| **Spam messages** | Rate limit (10 msgs/min per user) |
| **Long messages** | Max 5000 chars enforced |
| **Xss/injection** | Sanitize on display (React escapes by default) |
| **Deleted message visibility** | Soft-delete: show "[Message deleted]" instead of removal |
| **Impersonation** | Auth token + Firebase custom claims enforce identity |

### 7.6 Scalability

- **Firestore:** Leverage real-time listeners; pagination for history
- **Socket.io:** Use Redis adapter for multi-instance deployment (future phase)
- **Message archive:** MongoDB backup for audit trail (scheduled batch job, Phase 1)
- **Storage:** Cloud Storage for attachments (Phase 2)

### 7.7 Monitoring & Alerting

| Metric | Alert Threshold | Action |
|--------|-----------------|--------|
| **WebSocket disconnect rate** | > 5% | Page alert in admin console |
| **Message send latency P95** | > 2s | Log warning |
| **Escalation response time** | > 4 hours avg | Report to superAdmins |
| **Firestore quota usage** | > 80% | Notify ops |

---

## 8. Implementation Roadmap

### Phase 0 (Current)
- [x] Design specification
- [ ] Database schema validation
- [ ] API contract finalization

### Phase 1 (MVP Release)
- [ ] Firestore collections + rules + indexes
- [ ] Socket.io server setup (Node.js + Express)
- [ ] Message send/receive core events
- [ ] Authentication middleware (Firebase ID token)
- [ ] Student UI: Support chat screen
- [ ] Admin UI: Support queue + chat thread
- [ ] SuperAdmin UI: Escalation queue + chat thread
- [ ] Auto-close + scheduled deletion jobs
- [ ] Basic rate limiting
- [ ] Error logging + monitoring

### Phase 1.5 (Polish)
- [ ] Conversation list UI (pagination, search, filter)
- [ ] Message history pagination
- [ ] Archive old conversations
- [ ] Notification on new escalation (email?)
- [ ] Integration with equipment request detail pages

### Phase 2 (Enhancements)
- [ ] Typing indicators
- [ ] Read receipts
- [ ] Message edit/delete with audit trail
- [ ] Image uploads (S3 + preview)
- [ ] Conversation search
- [ ] Admin assignment feature (optional)
- [ ] Multi-language support (if needed)

### Phase 3+ (Advanced)
- [ ] Chatbot integration (FAQ responses)
- [ ] Sentiment analysis (for escalation priority)
- [ ] Analytics dashboard (response time, satisfaction)
- [ ] Canned responses library

---

## 9. MongoDB Backup Strategy (Non-Critical for V1)

**Purpose:** Audit trail + long-term retention  
**Collection:** `chat_archive`

**Document:**
```json
{
  "_id": ObjectId,
  "conversationID": "support__abc123def456",
  "messageID": "msg_uuid_42",
  "messageContent": "...",
  "senderUID": "...",
  "createdAt": "2026-05-05T...",
  "archivedAt": "2026-08-05T...",  // Timestamp of archive operation
  "status": "archived"               // For compliance holds
}
```

**Job:** Runs nightly; archives messages older than 85 days from Firestore to MongoDB.

---

## 10. Configuration & Environment Variables

```env
# Socket.io
SOCKET_IO_PORT=4000
SOCKET_IO_CORS_ORIGIN=http://localhost:5173

# Firestore
FIRESTORE_PROJECT_ID=fishlers-project
FIRESTORE_DATABASE_ID=default

# Message settings
CHAT_MAX_MESSAGE_LENGTH=5000
CHAT_RATE_LIMIT=10:60  # 10 messages per 60 seconds
CHAT_CONVERSATION_AUTO_CLOSE_DAYS=30
CHAT_MESSAGE_RETENTION_DAYS=90

# Monitoring
SENTRY_DSN=https://...
LOG_LEVEL=info
```

---

## 11. Testing Strategy (For Development)

### Unit Tests
- Message validation (length, content)
- Permission checks (who can send/view)
- Conversation ID generation

### Integration Tests
- Socket.io event flow (send → receive)
- Firestore writes + reads
- Rate limiting enforcement

### End-to-End Tests
- Student creates support → Admin responds → Close conversation
- Admin escalates → SuperAdmin sees in queue → Responds
- Auto-close after 30 days (mocked time)

---

## 12. Known Constraints & Future Considerations

1. **No Private/1-1 Admin Chat (MVP):** All admin-superAdmin escalations are visible to all superAdmins. If privacy needed later, add escalation to specific superAdmin field.

2. **No Conversation Transfer:** If admin A starts helping student, admin B can't "take over." Could add in Phase 2 if needed.

3. **No Message Editing (MVP):** Simplifies Firestore writes and audit trail. Add Phase 2.

4. **No Attachment Support (MVP):** Defer to Phase 2 with Cloud Storage integration.

5. **No Bot Integration (MVP):** FAQ routing handled manually by admins.

6. **Firestore Reads Costs:** At <100 concurrent users with 20 admin screens and 50 students, estimate ~1000 reads/hour. Monitor closely.

---

## Summary Table

| Aspect | Decision |
|--------|----------|
| **Chat Framework** | Socket.io + HTTP fallback |
| **Primary DB** | Firestore (real-time listeners) |
| **Backup DB** | MongoDB (audit archive only) |
| **Auth** | Firebase ID tokens + custom claims |
| **Conversation Model** | Per-student support + per-escalation escalation |
| **Escalation Model** | Group channel (all superAdmins see all) |
| **Message Retention** | 90 days auto-delete |
| **Conversation Auto-Close** | 30 days inactivity |
| **MVP Features** | Text-only send/receive, no typing/read receipts/edit |
| **Rate Limit** | 10 msgs/min per user |
| **Max Message Length** | 5–10 KB (5000 chars) |
| **Target Concurrent Users** | <100 |

---

**Next Steps:**
1. Validate schema with Firestore security rules review
2. Set up Socket.io server in Node.js + Redis adapter (if scaling needed)
3. Create Firestore security rules (authorization)
4. Implement server-side message validation + rate limiting
5. Build client UI components (React)
6. Integration testing with Firebase emulator
