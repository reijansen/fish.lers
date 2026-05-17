import { Equipment, AvailableEquipmentItem } from "../db";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

/**
 * Equipment API Client.
 * Wraps HTTP calls to the backend equipment endpoints.
 * 
 * Purpose: Centralize all equipment API communication in one place.
 * Makes it easy to see what data is being sent/received.
 * If the backend API changes, only this file needs updating.
 * 
 * Usage in components:
 *   const equipment = await equipmentApi.listEquipment();
 *   await equipmentApi.createEquipment({ name: "Microscope", ... });
 */

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface ListOptions {
  page?: number;
  limit?: number;
}

/**
 * List all equipment.
 * @param includeArchived - If true, includes soft-deleted items. Default: false.
 */
export async function listEquipment(
  includeArchived: boolean = false,
  options?: ListOptions
): Promise<Equipment[]> {
  const url = new URL(`${API_BASE}/api/equipment`);
  if (includeArchived) {
    url.searchParams.append("includeArchived", "true");
  }
  if (options?.page) {
    url.searchParams.append("page", String(options.page));
  }
  if (options?.limit) {
    url.searchParams.append("limit", String(options.limit));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to list equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to list equipment");
  }

  return result.data;
}

/**
 * Get a single equipment by ID.
 */
export async function getEquipment(equipmentID: string): Promise<Equipment> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Equipment not found: ${equipmentID}`);
  }

  const result: ApiResponse<Equipment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get equipment");
  }

  return result.data;
}

/**
 * Create new equipment.
 */
export async function createEquipment(
  equipment: Omit<Equipment, "equipmentID">
): Promise<Equipment> {
  const response = await fetch(`${API_BASE}/api/equipment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(equipment),
  });

  if (!response.ok) {
    throw new Error(`Failed to create equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to create equipment");
  }

  return result.data;
}

/**
 * Update equipment.
 */
export async function updateEquipment(
  equipmentID: string,
  updates: Partial<Omit<Equipment, "equipmentID">>
): Promise<Equipment> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error(`Failed to update equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to update equipment");
  }

  return result.data;
}

/**
 * Soft delete (archive) equipment.
 * Equipment remains in database, marked as deleted.
 */
export async function archiveEquipment(equipmentID: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}/archive`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to archive equipment: ${response.statusText}`);
  }

  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to archive equipment");
  }
}

/**
 * Restore archived equipment.
 */
export async function restoreEquipment(equipmentID: string): Promise<Equipment> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}/restore`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to restore equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to restore equipment");
  }

  return result.data;
}

/**
 * Hard delete equipment.
 * Permanently removes from database and logs to purged collection.
 */
export async function deleteEquipment(equipmentID: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete equipment: ${response.statusText}`);
  }

  const result: ApiResponse<void> = await response.json();
  if (!result.success) {
    throw new Error(result.error || "Failed to delete equipment");
  }
}

/**
 * Get all purged equipment records.
 */
export async function getPurgedEquipment(): Promise<Equipment[]> {
  const response = await fetch(`${API_BASE}/api/equipment/purged`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to get purged equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to get purged equipment");
  }

  return result.data;
}

/**
 * Restore equipment from purged state.
 * WARNING: This is a dangerous operation. Restrict to super admins only.
 */
export async function restorePurgedEquipment(equipmentID: string): Promise<Equipment> {
  const response = await fetch(`${API_BASE}/api/equipment/${equipmentID}/restore-purged`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Failed to restore purged equipment: ${response.statusText}`);
  }

  const result: ApiResponse<Equipment> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to restore purged equipment");
  }

  return result.data;
}
