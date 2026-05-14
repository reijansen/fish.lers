# Before & After Comparison - Equipment Feature

This document shows exactly what's changing in the codebase during the FERN-MVC refactor.

---

## Component: Equipment Dashboard

### BEFORE (Direct Firestore)
```typescript
// client/src/pages/equipment/Dashboard.tsx
import { logicEquipment } from "./logicEquipment";
import { collection, onSnapshot } from "firebase/firestore";  // ❌ Direct Firestore import
import { db } from "../../firebase";                          // ❌ Client Firebase instance

export default function Dashboard() {
  const { equipmentList, handleAdd, handleEdit } = logicEquipment();
  const [purgedEquipment, setPurgedEquipment] = useState([]);

  // ❌ Direct Firestore listener in component
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "equipment_purged"), (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        equipmentID: doc.id,
        ...doc.data(),
      }));
      setPurgedEquipment(list);
    });
    return () => unsub();
  }, []);

  // Rest of component...
}
```

### AFTER (API-Based)
```typescript
// client/src/pages/equipment/Dashboard.tsx - SAME FILE, MINIMAL CHANGES
import { logicEquipment } from "./logicEquipment";
// ✅ No Firebase imports!
// ✅ No direct Firestore calls!
// ✅ Already handled by logicEquipment hook

export default function Dashboard() {
  const { equipmentList, handleAdd, handleEdit } = logicEquipment();
  const [purgedEquipment, setPurgedEquipment] = useState([]);

  // ✅ Fetch from API instead
  useEffect(() => {
    const fetchPurged = async () => {
      try {
        const items = await equipmentApi.getPurgedEquipment();
        setPurgedEquipment(items);
      } catch (error) {
        console.error("Failed to fetch purged:", error);
      }
    };

    fetchPurged();
    // Poll every 5 seconds (or setup WebSocket later)
    const interval = setInterval(fetchPurged, 5000);

    return () => clearInterval(interval);
  }, []);

  // Rest of component... (unchanged)
}
```

**Key Changes:**
- Remove `import { collection, onSnapshot } from "firebase/firestore"`
- Remove `import { db } from "../../firebase"`
- Replace `onSnapshot` with async function + polling
- Use API wrapper (imported from logicEquipment)

---

## Hook: logicEquipment

### BEFORE (Direct Firestore)
```typescript
// client/src/pages/equipment/logicEquipment.ts
import { useEffect, useState } from "react"
import { collection, onSnapshot, addDoc } from "firebase/firestore"  // ❌ Firestore SDK
import { Equipment } from "../../db"
import { db } from "../../firebase"                                  // ❌ Client instance
import { addEquipment, listenerEquipment, updateEquipment, deleteEquipment } from "./query"  // ❌ Query layer

export function logicEquipment() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // ❌ Using Firestore listener directly in hook
    const unsubscribe = listenerEquipment((items) => {
      setEquipmentList(items)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const handleAdd = async (equipment: Omit<Equipment, "equipmentID">) => {
    // ❌ Calling Firestore operation
    await addEquipment(equipment)
  }

  const handleEdit = async (equipmentID: string, info: Partial<Equipment>) => {
    // ❌ Calling Firestore operation
    await updateEquipment(equipmentID, info)
  }

  // ... more operations

  return { equipmentList, handleAdd, handleEdit, isLoading }
}
```

### AFTER (API-Based)
```typescript
// client/src/pages/equipment/logicEquipment.ts
import { useEffect, useState } from "react"
import { Equipment } from "../../db"
import * as equipmentApi from "../../api/equipment.api"  // ✅ API wrapper instead

export function logicEquipment() {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ✅ Fetch function (replaces listener)
  const fetchEquipment = async () => {
    try {
      const items = await equipmentApi.listEquipment()  // ✅ API call
      setEquipmentList(items)
      setError(null)
    } catch (err: any) {
      console.error("Failed to fetch:", err)
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // ✅ Polling instead of listener
  useEffect(() => {
    let isMounted = true
    
    fetchEquipment()  // Fetch immediately
    
    const interval = setInterval(() => {
      if (isMounted) fetchEquipment()
    }, 5000)  // Every 5 seconds

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const handleAdd = async (equipment: Omit<Equipment, "equipmentID">) => {
    await equipmentApi.createEquipment(equipment)  // ✅ API call
    await fetchEquipment()  // Refetch
  }

  const handleEdit = async (equipmentID: string, info: Partial<Equipment>) => {
    await equipmentApi.updateEquipment(equipmentID, info)  // ✅ API call
    await fetchEquipment()  // Refetch
  }

  // ... more operations (all using API)

  return { equipmentList, handleAdd, handleEdit, isLoading, error }
}
```

**Key Changes:**
- Replace Firestore imports with API wrapper import
- Replace `listenerEquipment()` with `fetchEquipment()` function
- Replace `onSnapshot()` (listener) with polling (fetch + interval)
- All handlers now call API wrapper functions
- Handlers refetch after modifications (instead of relying on listener)

---

## Query Layer (To Be Deleted)

### BEFORE (Still Exists)
```typescript
// client/src/pages/equipment/query.ts - ❌ TO BE DELETED
import { db } from "../../firebase"
import { doc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"

const COLLECTION = "equipment"

export function addEquipment(equipment) {
  return addDoc(collection(db, COLLECTION), equipment)
}

export function updateEquipment(equipmentID, info) {
  const equipmentData = doc(db, COLLECTION, equipmentID)
  return updateDoc(equipmentData, info)
}

export function deleteEquipment(equipmentID) {
  return deleteDoc(doc(db, COLLECTION, equipmentID))
}

export function listenerEquipment(callback) {
  return onSnapshot(collection(db, COLLECTION), (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      equipmentID: doc.id,
      ...doc.data(),
    }))
    callback(items)
  })
}
```

### AFTER (Replaced by API Wrapper)
```typescript
// ❌ FILE DELETED - Replaced by:
// client/src/api/equipment.api.ts ✅

import { Equipment } from "../db"

export async function listEquipment(): Promise<Equipment[]> {
  const response = await fetch("http://localhost:5000/api/equipment", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  })
  const result = await response.json()
  return result.data
}

export async function createEquipment(equipment): Promise<Equipment> {
  const response = await fetch("http://localhost:5000/api/equipment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(equipment),
  })
  const result = await response.json()
  return result.data
}

export async function updateEquipment(equipmentID, updates): Promise<Equipment> {
  const response = await fetch(`http://localhost:5000/api/equipment/${equipmentID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  })
  const result = await response.json()
  return result.data
}

export async function deleteEquipment(equipmentID): Promise<void> {
  const response = await fetch(`http://localhost:5000/api/equipment/${equipmentID}`, {
    method: "DELETE",
  })
  // Handle error if needed
}
```

**Changes:**
- ❌ `query.ts` is deleted (no longer needed)
- ✅ `api/equipment.api.ts` replaces it
- Direct Firestore calls → HTTP fetch calls
- Same interface (same function names), different implementation

---

## Server: What's New

### ROUTES
```typescript
// server/src/routes/equipment.routes.ts - NEW
// Maps HTTP verbs + paths to controller methods

router.get("/", EquipmentController.listEquipment)
router.post("/", EquipmentController.createEquipment)
router.patch("/:id", EquipmentController.updateEquipment)
router.delete("/:id", EquipmentController.deleteEquipment)
```

### CONTROLLER  
```typescript
// server/src/controllers/equipment.controller.ts - NEW
// Handles HTTP requests, delegates to service

static async listEquipment(req, res) {
  const equipment = await EquipmentService.getActiveEquipment()
  res.json({ success: true, data: equipment })
}

static async createEquipment(req, res) {
  const equipment = await EquipmentService.createEquipment(req.body)
  res.status(201).json({ success: true, data: equipment })
}
```

### SERVICE
```typescript
// server/src/services/equipment.service.ts - NEW
// Business logic, validation, rules

static async createEquipment(data) {
  this.validateEquipmentInput(data)  // Validate first
  const equipmentID = await EquipmentRepository.create(data)
  const equipment = await EquipmentRepository.getById(equipmentID)
  return equipment
}
```

### REPOSITORY
```typescript
// server/src/repositories/equipment.repo.ts - NEW
// Direct Firestore operations using Admin SDK

static async create(data) {
  const docRef = await db.collection(EQUIPMENT_COLLECTION).add({
    ...data,
    serialNumbers: this.generateSerialNumbers(data),
    createdAt: new Date().toISOString(),
  })
  return docRef.id
}
```

---

## Data Flow Comparison

### BEFORE
```
Dashboard.tsx
    ↓
logicEquipment.ts (handles add, edit, delete)
    ↓
query.ts (addDoc, updateDoc, etc.)
    ↓
Firebase Client SDK
    ↓
Firestore
    ↓
[No validation, no logging, scattered business logic]
```

### AFTER
```
Dashboard.tsx
    ↓
logicEquipment.ts (calls API wrapper)
    ↓
equipment.api.ts (makes HTTP requests)
    ↓ HTTP POST /api/equipment
Express Server
    ↓
equipment.routes.ts (route matching)
    ↓
equipment.controller.ts (request parsing)
    ↓
equipment.service.ts (validation, business logic)
    ↓
equipment.repo.ts (Firestore operations)
    ↓
Firebase Admin SDK
    ↓
Firestore
    ↓
[Centralized validation, logging, auditing possible]
```

---

## Summary of Changes per File

| File | Before | After | Change Type |
|------|--------|-------|-------------|
| `dashboard.tsx` | Direct Firebase imports | Uses logicEquipment hook | Update |
| `logicEquipment.ts` | Firestore listeners | API calls + polling | Update |
| `query.ts` | Direct Firestore ops | DELETE | Delete |
| `addEquipment.tsx` | No change (uses handlers) | No change | None |
| `equipment.api.ts` | Doesn't exist | HTTP wrappers | Create |
| `server/*` | Doesn't exist | New backend layers | Create |

---

## Migration Checklist

```
[ ] Read this document to understand changes
[ ] Backup current client/src/pages/equipment/
[ ] Update logicEquipment.ts (copy from PHASE_4_MIGRATION_EXAMPLE.ts)
[ ] Update Dashboard.tsx (remove direct Firestore imports)
[ ] Test in browser (equipment CRUD should still work)
[ ] Delete query.ts (after confirming everything works)
[ ] Search codebase for remaining "from firebase/firestore" in equipment files
[ ] Verify all equipment operations work as before
[ ] Commit changes
```

---

## Important Notes

✅ **UI Components DON'T CHANGE** - They still use `handleAdd`, `handleEdit`, etc.
✅ **Props DON'T CHANGE** - Components receive same data
✅ **User Experience DON'T CHANGE** - Should feel identical
✅ **Business Logic MOVES** - From scattered hooks to centralized service layer

❌ **Data fetching changes** - From real-time listeners to polling
❌ **Where data comes from changes** - From client SDK to server API
❌ **Error handling changes** - Network errors + server validation errors

---

For complete migration code, see: `PHASE_4_MIGRATION_EXAMPLE.ts`
For setup instructions, see: `REFACTOR_GUIDE.md`
