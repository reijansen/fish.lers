# Chat System Phase 0 – Implementation Starter Kit

**Status:** Design complete + skeleton code provided  
**Last Updated:** May 5, 2026

---

## What's Included

This Phase 0 deliverable includes:

### 1. **Complete Design Specification** (`CHAT_SYSTEM_PHASE_0.md`)
- Conversation ID strategy
- Permission matrix (student/admin/superAdmin)
- Firestore schema with all collections
- Socket.io event contract (client ↔ server)
- Optional HTTP endpoints
- UI screens for all roles
- Non-functional requirements (rate limiting, retention, data validation)
- Implementation roadmap through Phase 3

### 2. **Firestore Security Rules** (`firebase/firestore_chat_rules.rules`)
- Read permissions: students access own chats, admins access all student support, superAdmins access everything
- Write restrictions: client-side writes blocked; server-only via Admin SDK or Cloud Functions
- Optimized for the three conversation types

### 3. **Server-Side Skeleton** (`server/src/services/chat.service.ts`)
- Socket.io server setup with CORS configuration
- Complete event handlers:
  - `send_message`: Validate, rate limit, store, broadcast
  - `load_conversation`: Fetch messages with pagination
  - `list_conversations`: Filter by type/status/user role
  - `create_student_support_conversation`: Auto-create or return existing
  - `escalate_to_superadmin`: Create escalation group channel
  - `close_conversation`: Mark as closed
- Rate limiting (10 msgs/min per user)
- Message validation (length, XSS prevention)
- Permission checks for all actions
- Error handling with proper error codes

### 4. **Client-Side Context & Hooks** (`client/src/context/ChatContext.tsx`)
- React Context for global chat state management
- Socket.io connection management with Firebase auth
- Idempotency key generation for message deduplication
- All action handlers (send, load, escalate, etc.)
- Proper disconnect/cleanup
- TypeScript interfaces for all data types

### 5. **UI Components**

#### Student Screen (`client/src/pages/StudentSupportChat.tsx`)
- Support chat thread view
- Auto-initialize conversation on first visit
- Message sending with length indicator
- Connection status indicator
- Auto-scroll to newest messages
- Read-only mode when conversation closed

#### Admin Dashboard (`client/src/pages/admin/AdminSupportQueue.tsx`)
- List all active student support conversations
- Filter by status (active/closed)
- Search by student UID or message content
- Quick navigation to conversation detail
- Message count and last message preview
- Last updated timestamp

---

## Quick Start: Next Steps for Phase 1

### Step 1: Install Dependencies

```bash
# Server
cd server
npm install socket.io uuid

# Client
cd ../client
npm install socket.io-client
```

### Step 2: Update Environment Variables

**Server** (`.env`):
```env
SOCKET_IO_PORT=4000
SOCKET_IO_CORS_ORIGIN=http://localhost:5173
FIRESTORE_PROJECT_ID=your-project-id
CHAT_MAX_MESSAGE_LENGTH=5000
CHAT_RATE_LIMIT=10:60
CHAT_CONVERSATION_AUTO_CLOSE_DAYS=30
CHAT_MESSAGE_RETENTION_DAYS=90
```

**Client** (`.env.local`):
```env
REACT_APP_SOCKET_IO_URL=http://localhost:4000
```

### Step 3: Set Up Firestore Security Rules

1. Open [Firebase Console](https://console.firebase.google.com)
2. Navigate to **Firestore Database** → **Rules**
3. Append the rules from `firebase/firestore_chat_rules.rules` to your existing rules
4. Deploy

### Step 4: Initialize Socket.io Server

In `server/src/index.ts`:

```typescript
import { ChatService } from './services/chat.service';
import http from 'http';

const httpServer = http.createServer(app);
const chatService = new ChatService(httpServer);

httpServer.listen(process.env.SOCKET_IO_PORT || 4000, () => {
  console.log(`Server running on port ${process.env.SOCKET_IO_PORT || 4000}`);
});

export { chatService };
```

### Step 5: Integrate Firebase Auth Verification (Critical!)

In `server/src/services/chat.service.ts`, replace the token verification middleware:

```typescript
private setupMiddleware() {
  this.io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("No token provided"));
      }

      // Use your Firebase Admin SDK import
      import admin from 'firebase-admin';
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      socket.data.uid = decodedToken.uid;
      socket.data.claims = {
        admin: decodedToken.admin === true,
        superAdmin: decodedToken.superAdmin === true,
      };

      next();
    } catch (error) {
      next(new Error("Authentication failed"));
    }
  });
}
```

### Step 6: Wrap App with ChatProvider

In `client/src/main.tsx`:

```typescript
import { ChatProvider } from './context/ChatContext';

root.render(
  <React.StrictMode>
    <ChatProvider>
      <App />
    </ChatProvider>
  </React.StrictMode>
);
```

### Step 7: Add Routes

In `client/src/App.tsx`:

```typescript
import StudentSupportChat from './pages/StudentSupportChat';
import AdminSupportQueue from './pages/admin/AdminSupportQueue';

<Routes>
  {/* Student routes */}
  <Route path="/support-chat" element={<StudentSupportChat />} />

  {/* Admin routes */}
  <Route path="/admin/support-queue" element={<AdminSupportQueue />} />
</Routes>
```

### Step 8: Testing

**Manual Testing Checklist:**
- [ ] Student opens chat → creates `support__{studentUID}` conversation
- [ ] Admin opens queue → sees all student conversations
- [ ] Student sends message → appears for all admins in real-time
- [ ] Admin responds → appears for student in real-time
- [ ] Admin escalates → creates `escalation__` conversation visible to all superAdmins
- [ ] SuperAdmin responds to escalation → appears for all
- [ ] Admin closes conversation → students see "closed" state
- [ ] Rate limit: send 11 messages in 60 sec → 11th rejected
- [ ] Message length: try 5001+ chars → rejected
- [ ] Permission: student tries to access other student's chat → rejected

### Step 9: Monitoring & Logging

Add to server startup:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

// Monitor Socket.io connections
chatService.getIO().on('connection', (socket) => {
  console.log(`[CHAT] User ${socket.data.uid} (${socket.data.claims.role}) connected`);
  
  socket.on('disconnect', () => {
    console.log(`[CHAT] User ${socket.data.uid} disconnected`);
  });
});
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  StudentSupportChat.tsx / AdminSupportQueue.tsx        │ │
│  │  (UI Components)                                       │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────▼─────────────────────────────────┐ │
│  │  ChatContext.tsx                                       │ │
│  │  (State management, Socket.io listeners)               │ │
│  └──────────────────────┬─────────────────────────────────┘ │
│                         │ (Socket.io WebSocket)              │
└─────────────────────────┼──────────────────────────────────┘
                          │
                  ┌───────▼────────┐
                  │  Socket.io     │
                  │  Server        │
                  └───────┬────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
   ┌────▼────┐      ┌────▼────┐     ┌─────▼──────┐
   │ Validate │      │ Rate    │     │ Firestore  │
   │ Message  │      │ Limit   │     │ Write      │
   └────┬────┘      └────┬────┘     └─────┬──────┘
        │                │                │
        └────────────────┼────────────────┘
                         │
                    ┌────▼─────┐
                    │ Firestore │
                    │ Database  │
                    └───────────┘
```

---

## Key Files to Review

1. **`CHAT_SYSTEM_PHASE_0.md`** – Read the full spec first
2. **`server/src/services/chat.service.ts`** – Understand Socket.io flow
3. **`client/src/context/ChatContext.tsx`** – Understand client state management
4. **`firebase/firestore_chat_rules.rules`** – Security rules

---

## Testing the Chat Locally

### Use Firebase Emulator Suite

```bash
# Start emulator
firebase emulators:start

# In another terminal, run your server
cd server && npm run dev

# In another, run your client
cd client && npm run dev
```

### Use Postman/Socket.io Client for API Testing

```javascript
// Test Socket.io connection in browser console
const socket = io('http://localhost:4000', {
  auth: { token: 'your-firebase-id-token' }
});

socket.on('connect', () => console.log('Connected'));

socket.emit('send_message', {
  conversationID: 'support__student-uid',
  content: 'Test message',
  idempotencyKey: 'unique-key'
});

socket.on('message_received', (msg) => console.log('Message:', msg));
```

---

## Known Limitations & Gotchas

1. **Firestore Composite Index Required**
   - For listing conversations with `(type, status, updatedAt)` sorting
   - Firestore will prompt you to create on first query
   - Click the link in the error message to auto-create

2. **Firebase Admin SDK in Backend**
   - Socket.io middleware uses `admin.auth().verifyIdToken()`
   - Ensure `GOOGLE_APPLICATION_CREDENTIALS` env var is set
   - Or initialize Admin SDK with your service account JSON

3. **Idempotency Keys**
   - Client generates unique keys to prevent duplicate messages
   - Server should deduplicate on retry; implement in Phase 1.5

4. **MongoDB Backup** (Not needed for MVP)
   - Archive job runs nightly; implement in Phase 1.5
   - For now, Firestore is the single source of truth

5. **Read Receipts** (Deferred to Phase 2)
   - Participant tracking is set up, but read status not fully implemented yet

---

## Common Integration Points

### Linking Chat to Equipment Requests

To allow students to chat about a specific request:

```typescript
// In AdminRequestHistory.tsx
<button onClick={() => navigate('/support-chat')}>
  Chat with admin about this request
</button>
```

### Notification Integration (Future)

```typescript
// On escalation_created event
socket.on('escalation_created', async (data) => {
  // Send email to superAdmins
  // Send push notification if logged in
});
```

### User Profile Integration

Cache user info when creating messages:

```typescript
// In message creation, fetch from Firebase Auth or users collection
const userDoc = await admin.firestore().collection('users').doc(userUID).get();
const senderName = userDoc.data()?.displayName || 'Unknown';
```

---

## Performance Targets (for Phase 1)

| Metric | Target | How to Monitor |
|--------|--------|----------------|
| Message send latency | < 500 ms | Chrome DevTools Network tab |
| Conversation list load | < 1 s | Measure getDocs() time |
| WebSocket connect | < 2 s | Socket.io debug logs |
| Firestore reads/hour | < 1000 | Firebase Console Metrics |

---

## Support & Escalation Flow (Reminder)

```
1. Student sends message
   ↓
2. Any admin sees in queue, responds
   ↓
3. If complex: Admin escalates to superAdmins
   ↓
4. All superAdmins see escalation group chat
   ↓
5. SuperAdmin responds/resolves
   ↓
6. Admin closes conversation (30-day auto-close backup)
   ↓
7. Messages soft-deleted after 90 days
```

---

## Deployment Checklist (Phase 1 → Production)

- [ ] Enable Firestore backup
- [ ] Set up Cloud Monitoring alerts
- [ ] Configure CORS properly for production domain
- [ ] Enable rate limiting with Redis (multi-instance)
- [ ] Set up log aggregation (Cloud Logging / Datadog)
- [ ] Run security audit on Firestore rules
- [ ] Load test with k6 or Artillery
- [ ] Set up auto-scaling for Node.js instances
- [ ] Document runbooks for common issues

---

## Questions or Issues?

Refer back to sections in `CHAT_SYSTEM_PHASE_0.md`:
- **Architecture questions** → Section 2–4
- **API questions** → Section 5
- **Security questions** → Section 4 (Firestore Schema)
- **Performance questions** → Section 7 (Non-Functional Requirements)
- **UI/UX questions** → Section 6 (UI Screens)

Good luck with Phase 1! 🚀
