# FishLERS FERN-MVC Refactor - Phase 2-3 Implementation Guide

## Overview

This guide walks you through setting up the minimal Express backend scaffold and migrating the equipment feature end-to-end.

**For context on Phase 1 (Repository Restructuring):** See [PHASE_1_REPOSITORY_RESTRUCTURING.md](PHASE_1_REPOSITORY_RESTRUCTURING.md)

**Status:**
- ✅ Phase 2: Express server scaffold created
- ✅ Phase 3: Equipment feature backend created (routes, controller, service, repository, models)
- ✅ Phase 3.5: Client API wrapper created
- ⏳ Phase 4: Remaining - Frontend migration (next steps)

---

## What Was Created

### Server Structure
```
server/
├── src/
│   ├── config/
│   │   ├── env.ts                (Load and validate environment variables)
│   │   └── firebase.ts            (Initialize Firebase Admin SDK)
│   ├── middleware/
│   │   └── auth.ts                (Auth & error handling middleware)
│   ├── models/
│   │   └── equipment.ts           (Equipment type definitions)
│   ├── repositories/
│   │   └── equipment.repo.ts      (Direct Firestore operations)
│   ├── services/
│   │   └── equipment.service.ts   (Business logic)
│   ├── controllers/
│   │   └── equipment.controller.ts (HTTP request/response handling)
│   ├── routes/
│   │   └── equipment.routes.ts    (API endpoint definitions)
│   ├── app.ts                     (Express app setup)
│   └── index.ts                   (Entry point)
├── package.json
├── tsconfig.json
└── .env.example
```

### Client Structure
```
client/
├── src/
│   ├── api/
│   │   └── equipment.api.ts       (NEW: HTTP calls to backend)
│   └── ... (existing files)
```

---

## Phase 2: Server Setup

### Step 1: Install Dependencies

```bash
cd server
npm install
```

### Step 2: Configure Environment

1. **Copy `.env.example` to `.env`:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your Firebase credentials:**
   ```
   PORT=5000
   NODE_ENV=development
   FIREBASE_PROJECT_ID=your-firebase-project-id
   FIREBASE_PRIVATE_KEY=your-service-account-private-key-with-\n
   FIREBASE_CLIENT_EMAIL=your-service-account@your-project-id.iam.gserviceaccount.com
   CLIENT_URL=http://localhost:5173
   ```

   **Where to get these:**
   - Go to Firebase Console → Project Settings → Service Accounts
   - Generate new private key (JSON)
   - Copy the values from the JSON file

   **IMPORTANT:** The private key has newlines. When pasting, either:
   - Keep literal newlines (paste the whole key with line breaks)
   - Or replace newlines with `\n` (our code handles both)

### Step 3: Test the Server

```bash
npm run dev
```

Expected output:
```
🚀 Starting FishLERS Server (development mode)
✓ Firebase Admin SDK initialized
✓ Server running on http://localhost:5000
✓ CORS enabled for: http://localhost:5173
```

Test the health endpoint:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{ "status": "OK", "timestamp": "..." }
```

---

## Phase 3: Equipment Feature Backend

The backend is **complete** and ready to use. No changes needed.

### Endpoint Reference

**List equipment:**
```
GET /api/equipment
GET /api/equipment?includeArchived=true
```

**Get single equipment:**
```
GET /api/equipment/:id
```

**Create equipment:**
```
POST /api/equipment
Body: { name, totalInventory, isDisposable, category?, imageLink? }
```

**Update equipment:**
```
PATCH /api/equipment/:id
Body: { name?, category?, totalInventory?, ... }
```

**Archive (soft delete):**
```
PUT /api/equipment/:id/archive
```

**Restore archived:**
```
PUT /api/equipment/:id/restore
```

**Delete (permanent):**
```
DELETE /api/equipment/:id
```

**Get purged records:**
```
GET /api/equipment/purged
```

### Test with cURL

```bash
# List all equipment
curl http://localhost:5000/api/equipment

# Create equipment
curl -X POST http://localhost:5000/api/equipment \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Microscope",
    "totalInventory": 5,
    "isDisposable": false,
    "category": "Optical"
  }'

# Try the response:
# {"success": true, "data": {"equipmentID": "...", "name": "Microscope", ...}}
```

---

## Phase 4: Equipment Feature Frontend Migration

### Step 1: Configure Client for Backend API

1. **Update `client/.env` or `.env.local`:**
   ```
   VITE_API_URL=http://localhost:5000
   ```

   If the env var is not set, the client defaults to `http://localhost:5000` (see `equipment.api.ts`).

2. **Verify Vite knows about it:**
   - Environment variables in Vite must start with `VITE_` to be exposed to the client.
   - They're loaded from `.env`, `.env.local`, `.env.[mode]`, etc.

### Step 2: Update `logicEquipment.ts`

**Current code:**
- Import from `query.ts` (direct Firestore)
- Uses Firestore listeners (`onSnapshot`)
- Direct Firebase operations

**New code:**
- Import from `equipment.api.ts` (HTTP calls)
- Use `useEffect` to fetch, then poll or setup SSE if needed
- Replace direct operations with API calls

**Example migration:**

**Before:**
```typescript
import { addEquipment, listenerEquipment, updateEquipment } from "./query";

function logicEquipment() {
  useEffect(() => {
    const unsubscribe = listenerEquipment((items) => {
      setEquipmentList(items);
    });
    return () => unsubscribe();
  }, []);

  const handleAdd = async (equipment) => {
    await addEquipment(equipment);
  };
}
```

**After:**
```typescript
import * as equipmentApi from "../../api/equipment.api";

function logicEquipment() {
  useEffect(() => {
    let isMounted = true;

    const fetchEquipment = async () => {
      try {
        const items = await equipmentApi.listEquipment();
        if (isMounted) setEquipmentList(items);
      } catch (error) {
        console.error("Failed to fetch equipment:", error);
      }
    };

    fetchEquipment();

    // Poll every 5 seconds (replace with WebSocket/SSE later if needed)
    const interval = setInterval(fetchEquipment, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleAdd = async (equipment) => {
    await equipmentApi.createEquipment(equipment);
    // Refetch list
    const items = await equipmentApi.listEquipment();
    setEquipmentList(items);
  };
}
```

### Step 3: Remove Firestore Imports

**Remove from `logicEquipment.ts`:**
```typescript
// OLD - DELETE THESE:
import { onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "../../firebase";
```

**Keep using the API wrapper instead:**
```typescript
import * as equipmentApi from "../../api/equipment.api";
```

### Step 4: Update Other Equipment Components

**`Dashboard.tsx`:**
- Remove direct Firestore `onSnapshot` calls for purged equipment
- Use `equipmentApi.getPurgedEquipment()` in a `useEffect` instead

**`AddEquipmentDialog.tsx`:**
- Already calls `handleAdd` (which you updated)
- No changes needed

**`EditEquipmentDialog.tsx`:**
- Already calls `handleEdit` (which you updated)
- No changes needed

---

## Important: Real-time Updates

### Current Limitation
The API wrapper uses **polling** (refetch every 5 seconds) instead of Firestore listeners.

**This is fine for Phase 4**, but for a better UX, consider:
1. **Polling** (simpler, what we have now)
2. **WebSocket** (real-time, more complex)
3. **Server-Sent Events (SSE)** (real-time, simpler than WebSocket)

For now, polling is acceptable. Upgrade later if needed.

---

## Critical Risks & Mitigation

### 1. **CORS Issues**
**Risk:** Client requests fail with CORS error.

**Solution:**
- Ensure `CLIENT_URL` in `server/.env` matches your frontend URL
  - Dev: `http://localhost:5173` (Vite default)
  - Production: `https://yourdomain.com`
- The server's `app.ts` configures CORS to allow requests from this URL

**Debug:** Check browser console → Network tab. Look for `Access-Control-Allow-Origin` headers.

### 2. **Firebase Admin Auth Failures**
**Risk:** Server can't initialize Firebase, tests fail.

**Solution:**
- Verify `.env` values are correct
- `FIREBASE_PRIVATE_KEY` must include literal newlines (our code handles both formats)
- Test: `curl http://localhost:5000/health` should return 200 OK

**Debug:** Server logs will show `❌ Failed to initialize Firebase: ...`

### 3. **Import Path Conflicts**
**Risk:** Client still imports from old `query.ts`, mixing old and new code.

**Solution:**
- In `logicEquipment.ts`, completely replace imports:
  ```typescript
  // ❌ OLD:
  import { addEquipment, updateEquipment } from "./query";
  
  // ✅ NEW:
  import * as equipmentApi from "../../api/equipment.api";
  ```
- Remove the `query.ts` file once fully migrated (after thorough testing)
- Search codebase for remaining `from "firebase/firestore"` imports in equipment files

### 4. **Firestore Rules**
**Risk:** Backend can't read/write to Firestore.

**Solution:**
- Ensure your `firestore.rules` allow the service account to access collections
- Example rule:
  ```
  function isSignedIn() {
    return request.auth.uid != null;
  }

  match /equipment/{document=**} {
    allow read: if isSignedIn();
    allow write: if false; // Only backend via Admin SDK
  }
  ```
  The Admin SDK bypasses rules, so this is safe.

### 5. **Version Mismatches**
**Risk:** `firebase-admin` 13.6.0 has different API than expected.

**Solution:**  
- We're using the latest stable `firebase-admin@^13.6.0`
- All methods used (`initializeApp`, `firestore()`, etc.) are standard and stable
- No breaking changes in our code

---

## Next Steps (Phase 5+)

1. **Complete equipment frontend migration** → Test end-to-end
2. **Migrate authentication** → Move auth logic to backend
3. **Migrate requests feature** → Apply same pattern
4. **Add WebSocket/SSE** → Replace polling with real-time updates
5. **Enforce admin middleware** → Uncomment `requireAdmin` in routes once auth is working

---

## Quick Reference: File Purposes

| File | Purpose |
|------|---------|
| `env.ts` | Load `.env` and validate required vars |
| `firebase.ts` | Initialize Firebase Admin SDK once at startup |
| `auth.ts` | Middleware for OAuth and error handling |
| `equipment.ts` (models) | Equipment interface definitions |
| `equipment.repo.ts` | Direct Firestore CRUD operations |
| `equipment.service.ts` | Business logic (validation, filtering, etc.) |
| `equipment.controller.ts` | HTTP request handling, call service, format response |
| `equipment.routes.ts` | Define HTTP verb + path → controller method |
| `app.ts` | Express app creation, middleware setup, CORS config |
| `index.ts` | Entry point, loads config, starts server |
| `equipment.api.ts` | Client-side wrapper around HTTP calls |

---

## Troubleshooting

**Q: Server won't start, "Missing env var: FIREBASE_PROJECT_ID"**
A: Copy `.env.example` to `.env` and fill in your Firebase credentials.

**Q: CORS error in browser**
A: Make sure `CLIENT_URL=http://localhost:5173` is correct in `.env`.

**Q: API returns 500 error**
A: Check server logs. Look for Firebase initialization errors.

**Q: Equipment list is empty after migration**
A: You might be hitting a different backend. Verify `VITE_API_URL` in client `.env` is correct.

**Q: Changes don't appear in real-time**
A: Polling takes 5 seconds, or you might need to refresh. WebSocket/SSE coming in Phase 5.

---

## You're All Set! 🎉

1. ✅ Server scaffold ready
2. ✅ Equipment backend done
3. ✅ Client API wrapper ready
4. ⏳ Next: Update `logicEquipment.ts` to use `equipment.api.ts` instead of direct Firestore
