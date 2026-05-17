# Socket.io Realtime Communication

**Status:** Phase 2 (Server realtime foundation) ✅ Complete  
**Server Port:** Same as Express (default 4000)  
**WebSocket Transports:** `websocket`, `polling` (fallback)

---

## Overview

The chat system uses Socket.io for real-time, bidirectional communication between clients and server.

- **Server:** `server/src/realtime/` (Socket.io setup, auth, rooms, events)
- **Express Integration:** HTTP server created in `server/src/app.ts`
- **CORS:** Aligned with existing Express CORS config
- **Auth:** Firebase ID token verification on connection

---

## Client Connection

### Prerequisites

Client must have a valid Firebase ID token (obtained after user login).

### JavaScript/TypeScript Example

```typescript
import { io, Socket } from "socket.io-client";

const token = "your-firebase-id-token-here";

const socket: Socket = io("http://localhost:4000", {
  auth: {
    token: token, // Firebase ID token
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5,
});

socket.on("connect", () => {
  console.log("Connected to server");
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error.message);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});
```

### Token Options

You can provide the Firebase ID token in one of two ways:

**Option 1: `auth` handshake (recommended)**
```typescript
const socket = io("http://localhost:4000", {
  auth: { token: firebaseIdToken },
});
```

**Option 2: `Authorization` header**
```typescript
const socket = io("http://localhost:4000", {
  extraHeaders: {
    Authorization: `Bearer ${firebaseIdToken}`,
  },
});
```

---

## Events

### Server → Client

> Currently none are server-initiated. Client sends requests, server responds via ack callbacks.

### Client → Server

#### `ping`

Simple connectivity check.

**Request:**
```typescript
socket.emit("ping", (response) => {
  console.log(response);
  // { ok: true, pong: true, timestamp: 1234567890 }
});
```

#### `conversation:join`

Join a conversation room to receive/send messages.

**Validations:**
- User must have access to the conversation
  - Support (`support:<studentUID>`): Student owner OR any admin/superAdmin
  - Escalation (`escalation:<adminUID>:<escalationID>`): Owning admin OR any superAdmin

**Request:**
```typescript
socket.emit(
  "conversation:join",
  { conversationID: "support:student-123" },
  (response) => {
    if (response.ok) {
      console.log(`Joined room: ${response.room}`);
      // Now you can send/receive messages in this conversation
    } else {
      console.error(`Error: ${response.error}`);
    }
  }
);
```

**Response:**
```typescript
{
  ok: true,
  conversationID: "support:student-123",
  room: "conversation:support:student-123"
}
```

---

## Room Strategy

### User-Specific Room

Every connected user automatically joins their personal room:

```
user:<uid>
```

**Usage:** Direct messages to specific users (future: notifications)

### Role-Based Rooms

Users join role-specific rooms on connection:

```
role:admins        // All users with admin=true (excluding superAdmin)
role:superadmins   // All users with superAdmin=true
```

**Usage:** Broadcast messages to all admins/superAdmins (future: notifications)

### Conversation Rooms

Users explicitly join conversation rooms via `conversation:join` event:

```
conversation:support:<studentUID>
conversation:escalation:<adminUID>:<escalationID>
```

**Usage:** Real-time messages within a conversation

---

## Authentication Flow

1. **Client obtains Firebase ID token** (after login)
2. **Client connects with token** via `auth.token` or `Authorization` header
3. **Server verifies token** using Firebase Admin SDK
4. **Server extracts claims:**
   - `uid` (user ID)
   - `email` (optional)
   - `admin` (boolean) - true if admin OR superAdmin
   - `superAdmin` (boolean) - true if superAdmin
5. **Server attaches user to socket.data.user**
6. **Server joins user/role rooms**
7. **Connection accepted** (or rejected if token invalid)

**Failure Scenarios:**
- Missing token → Connection rejected
- Invalid token → Connection rejected
- Expired token → Connection rejected

---

## Access Control

### Conversation Access Rules

**Support Conversation** (`support:<studentUID>`)
- ✅ Student owner can read/write
- ✅ Any admin can read/write
- ✅ Any superAdmin can read/write
- ❌ Other students cannot access

**Escalation Conversation** (`escalation:<adminUID>:<escalationID>`)
- ✅ Owning admin can read/write
- ✅ Any superAdmin can read/write
- ❌ Other admins cannot access
- ❌ Students cannot access

**Implementation:** `server/src/realtime/access-control.ts`

---

## Error Handling

### Connection Errors

```typescript
socket.on("connect_error", (error) => {
  if (error.message.includes("No authentication token")) {
    // Handle missing token
  } else if (error.message.includes("Authentication failed")) {
    // Handle invalid/expired token
  }
});
```

### Event Errors

```typescript
socket.emit("conversation:join", { conversationID: "..." }, (response) => {
  if (!response.ok) {
    console.error(`Error: ${response.error}`);
    // Handle error (access denied, invalid conversation, etc.)
  }
});
```

---

## Debugging

### Enable Socket.io Logging

**Client:**
```typescript
import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  auth: { token: "..." },
  debug: true, // Enable logging
});
```

**Server:**
```bash
# Add DEBUG environment variable
DEBUG=socket.io:* npm run dev
```

### Browser DevTools

1. Open **Chrome DevTools** → **Network** tab
2. Filter by **WS** (WebSocket)
3. Click the WebSocket connection
4. View **Frames** for sent/received messages

---

## Phase 2 Limitations

This phase focuses on **realtime foundation only**. Not yet implemented:

- ❌ Message persistence (Phase 3)
- ❌ Message broadcasting to room (Phase 3)
- ❌ Unread message tracking (Phase 5)
- ❌ Typing indicators (Phase 2.5)
- ❌ Read receipts (Phase 5)
- ❌ File uploads (Phase 3+)

---

## Testing Connection Manually

### Using `socket.io-client` in Node.js

```bash
npm install socket.io-client
```

**test-socket.js:**
```javascript
const { io } = require("socket.io-client");

const token = "your-firebase-id-token";
const socket = io("http://localhost:4000", {
  auth: { token },
});

socket.on("connect", () => {
  console.log("✓ Connected");

  // Test ping
  socket.emit("ping", (res) => {
    console.log("Ping response:", res);
  });

  // Test conversation join
  socket.emit(
    "conversation:join",
    { conversationID: "support:student-123" },
    (res) => {
      console.log("Join response:", res);
    }
  );
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message);
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});
```

```bash
# Run with token
TOKEN="your-firebase-token" node test-socket.js
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Express App                           │
│  (routes, controllers, middleware)                      │
└──────────────┬──────────────────────────────────────────┘
               │ (createServer wraps)
               ▼
┌──────────────────────────────────────────────────────────┐
│              HTTP Server                                 │
│  (http module)                                           │
└──────────────┬──────────────────────────────────────────┘
               │ (listens on port)
               ▼
┌──────────────────────────────────────────────────────────┐
│           Socket.io Server                               │
│  (handles WebSocket connections)                         │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Socket Auth Middleware                             │ │
│  │ - Verify Firebase ID token                         │ │
│  │ - Extract uid, admin, superAdmin claims            │ │
│  │ - Attach user to socket.data                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Room Management                                    │ │
│  │ - user:<uid> (personal messages)                  │ │
│  │ - role:admins, role:superadmins (broadcasts)      │ │
│  │ - conversation:<convID> (chat rooms)              │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Event Handlers                                     │ │
│  │ - conversation:join (validate + join room)        │ │
│  │ - ping (connectivity check)                        │ │
│  │ - (future: send_message, typing, etc)             │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

---

## Files

### New Files Created

- `server/src/realtime/socket-server.ts` - Socket.io initialization
- `server/src/realtime/socket-auth.ts` - Authentication middleware
- `server/src/realtime/socket-events.ts` - Event handlers and room management
- `server/src/realtime/access-control.ts` - Permission checks
- `server/src/realtime/index.ts` - Module exports
- `REALTIME.md` - This documentation

### Modified Files

- `server/src/app.ts` - Added HTTP server creation and Socket.io setup

---

## Next Steps (Phase 3)

Phase 3 will add **message persistence and broadcasting:**

1. Integrate `ChatDataService` (Phase 1) with Socket.io events
2. Implement `send_message` event with Firestore writes
3. Implement message broadcasting to conversation rooms
4. Implement `conversation:list` for inbox
5. Add real-time listeners for incoming messages

---

## References

- [Socket.io Server Documentation](https://socket.io/docs/v4/server-api/)
- [Socket.io Client Documentation](https://socket.io/docs/v4/client-api/)
- Chat Data Model: [CHAT_FIRESTORE_SCHEMA.md](./CHAT_FIRESTORE_SCHEMA.md)
- Phase 0 Design: [CHAT_SYSTEM_PHASE_0.md](./CHAT_SYSTEM_PHASE_0.md)
