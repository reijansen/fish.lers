import { db } from "../../firebase";
import { Equipment } from "../../db";
import {
  doc,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  serverTimestamp
} from "firebase/firestore";

const COLLECTION = "equipment";

/**
 * Generates formatted serial numbers for durable equipment.
 * If the item is disposable or has no inventory, returns an empty array.
 */
function generateSerialNumbers(
  equipmentID: string | undefined,
  name: string | undefined,
  totalInventory: number | undefined,
  isDisposable: boolean | undefined
) {
  if (isDisposable || !totalInventory || totalInventory <= 0) return [];
  const base = (equipmentID || name || "ITEM").toString();
  const prefix = base.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ITEM";
  return Array.from(
    { length: totalInventory },
    (_, idx) => `${prefix}-${String(idx + 1).padStart(3, "0")}`
  );
}

// Create equipment
export function createEquipment(equipment: Omit<Equipment, "equipmentID">) {
  return addDoc(collection(db, COLLECTION), {
    ...equipment,
    isDeleted: false,
    createdAt: serverTimestamp(),
  });
}

// Update equipment info
export function updateEquipment(
  equipmentID: string,
  info: Partial<Omit<Equipment, "equipmentID">>
) {
  const equipmentRef = doc(db, COLLECTION, equipmentID);
  return updateDoc(equipmentRef, {
    ...info,
    updatedAt: serverTimestamp(),
  });
}

// Soft delete (Archive)
export function archiveEquipment(equipmentID: string) {
  const equipmentRef = doc(db, COLLECTION, equipmentID);
  return updateDoc(equipmentRef, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });
}

// Restore archived equipment
export function restoreEquipment(equipmentID: string) {
  const equipmentRef = doc(db, COLLECTION, equipmentID);
  return updateDoc(equipmentRef, {
    isDeleted: false,
    deletedAt: null,
  });
}

// Hard delete (Purge)
export function deleteEquipment(equipmentID: string) {
  return deleteDoc(doc(db, COLLECTION, equipmentID));
}

/**
 * Fetch all equipment once (used by polling in logicEquipment).
 */
export async function listEquipment(): Promise<Equipment[]> {
  const querySnapshot = await getDocs(collection(db, COLLECTION));
  return querySnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      equipmentID: doc.id,
      name: data.name,
      totalInventory: data.totalInventory,
      categoryID: data.categoryID, // Updated to use categoryID as per your Dialog component
      imageLink: data.imageLink,
      isDisposable: data.isDisposable,
      isDeleted: data.isDeleted,
      deletedAt: data.deletedAt,
      // Priority: use existing serial numbers from DB, otherwise generate them
      serialNumbers: data.serialNumbers || generateSerialNumbers(
        doc.id,
        data.name,
        data.totalInventory,
        data.isDisposable
      ),
    } as Equipment;
  });
}

/**
 * REPLACEMENT/LEGACY: Equipment listener.
 * Useful if you still need real-time updates in specific views without polling.
 */
export function listenerEquipment(callback: (items: Equipment[]) => void) {
  return onSnapshot(collection(db, COLLECTION), (snapshot) => {
    const items: Equipment[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        equipmentID: doc.id,
        name: data.name as string,
        totalInventory: data.totalInventory as number,
        categoryID: data.categoryID as string | undefined,
        imageLink: data.imageLink as string | undefined,
        isDisposable: data.isDisposable as boolean,
        isDeleted: data.isDeleted as boolean | undefined,
        deletedAt: data.deletedAt as string | undefined,
        serialNumbers: data.serialNumbers || generateSerialNumbers(
          doc.id,
          data.name as string | undefined,
          data.totalInventory as number | undefined,
          data.isDisposable as boolean | undefined
        ),
      };
    });
    callback(items);
  });
}