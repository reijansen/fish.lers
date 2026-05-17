/**
 * Equipment model/type definition.
 * This is the canonical domain model for equipment in the system.
 * Used by services, controllers, and API responses.
 */
export interface Equipment {
  equipmentID?: string;
  imageLink?: string;
  name: string;
  totalInventory: number;
  // category?: string;
  categoryID: string;
  isDisposable: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  serialNumbers?: string[];
}

/**
 * Defines what fields can be updated by the client.
 * Excludes sensitive fields like timestamps and IDs.
 */
export type EquipmentUpdateInput = Omit<Equipment, "equipmentID" | "createdAt" | "updatedAt">;

/**
 * Defines what the API returns to the client.
 */
export interface EquipmentResponse extends Equipment {
  equipmentID: string;
}

/**
 * Purged equipment record.
 * Logged when equipment is permanently deleted from the system.
 */
export interface PurgedEquipment extends Equipment {
  purgedAt: string;
}
