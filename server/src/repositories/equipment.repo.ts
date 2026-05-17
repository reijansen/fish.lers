import { getFirestore } from "../config/firebase.js";
import { Equipment, EquipmentUpdateInput, PurgedEquipment } from "../models/equipment.js";

const EQUIPMENT_COLLECTION = "equipment";
const PURGED_COLLECTION = "equipment_purged";
type ListOptions = {
  page: number;
  limit: number;
};

/**
 * Equipment Repository.
 * Handles all direct Firestore operations for equipment.
 * This is the only place where Firebase/Firestore is accessed for equipment.
 *
 * Purpose: Data access layer. Keeps database operations isolated from business logic.
 */
export class EquipmentRepository {
  /**
   * Add a new equipment document to Firestore.
   * Returns the generated document ID.
   */
  static async create(data: Omit<Equipment, "equipmentID">): Promise<string> {
    const db = getFirestore();
    const serialNumbers = this.generateSerialNumbers(data);
    
    const docRef = await db.collection(EQUIPMENT_COLLECTION).add({
      ...data,
      serialNumbers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    return docRef.id;
  }

  /**
   * Retrieve a single equipment by ID.
   */
  static async getById(equipmentID: string): Promise<Equipment | null> {
    const db = getFirestore();
    const doc = await db.collection(EQUIPMENT_COLLECTION).doc(equipmentID).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      equipmentID: doc.id,
      ...doc.data(),
    } as Equipment;
  }

  /**
   * Retrieve all equipment (including archived).
   * For filtered lists, see the service layer.
   */
  static async getAll(options: ListOptions): Promise<Equipment[]> {
    const db = getFirestore();
    const offset = (options.page - 1) * options.limit;
    let query: any = db.collection(EQUIPMENT_COLLECTION).limit(options.limit);
    if (offset > 0 && typeof query.offset === "function") {
      query = query.offset(offset);
    }
    const snapshot = await query.get();
    
    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      equipmentID: doc.id,
      ...doc.data(),
    } as Equipment));
  }

  /**
   * Update an equipment document.
   */
  static async update(equipmentID: string, data: Partial<EquipmentUpdateInput>): Promise<void> {
    const db = getFirestore();
    await db.collection(EQUIPMENT_COLLECTION).doc(equipmentID).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Soft delete: mark equipment as deleted without removing the document.
   */
  static async softDelete(equipmentID: string): Promise<void> {
    await this.update(equipmentID, {
      isDeleted: true,
      deletedAt: new Date().toISOString(),
    });
  }

  /**
   * Restore a soft-deleted equipment.
   */
  static async restore(equipmentID: string): Promise<void> {
    await this.update(equipmentID, {
      isDeleted: false,
      deletedAt: undefined,
    });
  }

  /**
   * Hard delete: permanently remove equipment and log to purged collection.
   */
  static async delete(equipmentID: string): Promise<void> {
    const db = getFirestore();
    
    // Get the equipment before deletion for logging
    const equipment = await this.getById(equipmentID);
    if (equipment) {
      // Log to purged collection
      await db.collection(PURGED_COLLECTION).doc(equipmentID).set({
        ...equipment,
        purgedAt: new Date().toISOString(),
      });
    }
    
    // Delete from main collection
    await db.collection(EQUIPMENT_COLLECTION).doc(equipmentID).delete();
  }

  /**
   * Get all purged equipment records.
   */
  static async getPurged(): Promise<PurgedEquipment[]> {
    const db = getFirestore();
    const snapshot = await db.collection(PURGED_COLLECTION).get();
    
    return snapshot.docs.map((doc) => ({
      equipmentID: doc.id,
      ...doc.data(),
    } as PurgedEquipment));
  }

  /**
   * Restore a purged equipment back to active (remove from purged, re-add to active).
   * NOTE: This is destructive and should rarely be used. Consider audit implications.
   */
  static async restorePurged(equipmentID: string): Promise<void> {
    const db = getFirestore();
    
    const purgedDoc = await db.collection(PURGED_COLLECTION).doc(equipmentID).get();
    if (!purgedDoc.exists) {
      throw new Error(`Purged equipment not found: ${equipmentID}`);
    }

    const data = purgedDoc.data();
    
    // Re-add to active equipment
    await db.collection(EQUIPMENT_COLLECTION).doc(equipmentID).set({
      ...data,
      isDeleted: false,
      deletedAt: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Remove from purged
    await db.collection(PURGED_COLLECTION).doc(equipmentID).delete();
  }

  /**
   * Generate serial numbers for non-disposable equipment.
   * Format: PREFIX-001, PREFIX-002, etc.
   * Prefix is derived from equipment name or ID, uppercase, alphanumeric only.
   */
  private static generateSerialNumbers(data: {
    name?: string;
    totalInventory?: number;
    isDisposable?: boolean;
  }): string[] {
    if (data.isDisposable || !data.totalInventory || data.totalInventory <= 0) {
      return [];
    }

    const base = (data.name || "ITEM").toString();
    const prefix = base.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "ITEM";
    
    return Array.from({ length: data.totalInventory }, (_, idx) =>
      `${prefix}-${String(idx + 1).padStart(3, "0")}`
    );
  }
}
