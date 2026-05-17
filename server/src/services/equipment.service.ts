import { Equipment, EquipmentUpdateInput, EquipmentResponse } from "../models/equipment.js";
import { EquipmentRepository } from "../repositories/equipment.repo.js";
import { Category, CategoryResponse } from "../models/category.js";
import { CategoryRepository } from "../repositories/category.repo.js";
/**
 * Equipment Service.
 * Contains business logic related to equipment.
 * Does NOT directly access Firestore; uses EquipmentRepository instead.
 *
 * Purpose: Business logic layer. Centralize equipment rules, validation, and transformations here.
 * Example: If you later need approval workflows, audit trails, or cascading deletes, implement them here.
 */
export class EquipmentService {
  private static readonly DEFAULT_LIST_LIMIT = 100;
  private static readonly MAX_LIST_LIMIT = 200;
  private static readonly LIST_CACHE_TTL_MS = 10_000;
  private static readonly listCache = new Map<string, { expiresAt: number; data: EquipmentResponse[] }>();

  private static getCachedList(key: string): EquipmentResponse[] | null {
    const cached = this.listCache.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.listCache.delete(key);
      return null;
    }
    return cached.data;
  }

  private static setCachedList(key: string, data: EquipmentResponse[]): void {
    this.listCache.set(key, {
      data,
      expiresAt: Date.now() + this.LIST_CACHE_TTL_MS,
    });
  }

  private static invalidateListCache(): void {
    this.listCache.clear();
  }

  private static normalizeListOptions(options?: { page?: number; limit?: number }) {
    const rawPage = Number(options?.page || 1);
    const rawLimit = Number(options?.limit || this.DEFAULT_LIST_LIMIT);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), this.MAX_LIST_LIMIT)
      : this.DEFAULT_LIST_LIMIT;
    return { page, limit };
  }

  /**
   * Create new equipment.
   * Validates input and stores in database via repository.
   */
  static async createEquipment(data: Omit<Equipment, "equipmentID">): Promise<EquipmentResponse> {
    this.validateEquipmentInput(data);
    
    const equipmentID = await EquipmentRepository.create(data);
    const equipment = await EquipmentRepository.getById(equipmentID);
    
    if (!equipment) {
      throw new Error("Failed to retrieve created equipment");
    }

    this.invalidateListCache();
    return {
      ...equipment,
      equipmentID: equipment.equipmentID!,
    } as EquipmentResponse;
  }

  /**
   * Get all active (non-deleted) equipment.
   * Filters out soft-deleted items.
   */
  static async getActiveEquipment(options?: { page?: number; limit?: number }): Promise<EquipmentResponse[]> {
    const normalized = this.normalizeListOptions(options);
    const cacheKey = `active:p${normalized.page}:l${normalized.limit}`;
    const cached = this.getCachedList(cacheKey);
    if (cached) return cached;

    const all = await EquipmentRepository.getAll(normalized);
    const data = all
      .filter((e) => !e.isDeleted)
      .map((e) => ({
        ...e,
        equipmentID: e.equipmentID!,
      } as EquipmentResponse));
    this.setCachedList(cacheKey, data);
    return data;
  }

  /**
   * Get all equipment including archived.
   * For admin dashboards that need full visibility.
   */
  static async getAllEquipment(options?: { page?: number; limit?: number }): Promise<EquipmentResponse[]> {
    const normalized = this.normalizeListOptions(options);
    const cacheKey = `all:p${normalized.page}:l${normalized.limit}`;
    const cached = this.getCachedList(cacheKey);
    if (cached) return cached;

    const all = await EquipmentRepository.getAll(normalized);
    const data = all.map((e) => ({
      ...e,
      equipmentID: e.equipmentID!,
    } as EquipmentResponse));
    this.setCachedList(cacheKey, data);
    return data;
  }

  /**
   * Get a single equipment by ID.
   */
  static async getEquipmentById(equipmentID: string): Promise<EquipmentResponse> {
    const equipment = await EquipmentRepository.getById(equipmentID);
    
    if (!equipment) {
      throw new Error(`Equipment not found: ${equipmentID}`);
    }

    return {
      ...equipment,
      equipmentID: equipment.equipmentID!,
    } as EquipmentResponse;
  }

  /**
   * Update equipment.
   * Validates input before updating.
   */
  static async updateEquipment(
    equipmentID: string,
    data: Partial<EquipmentUpdateInput>
  ): Promise<EquipmentResponse> {
    // Verify it exists
    const existing = await EquipmentRepository.getById(equipmentID);
    if (!existing) {
      throw new Error(`Equipment not found: ${equipmentID}`);
    }

    // Validate what we're updating
    this.validateEquipmentUpdate(data);

    await EquipmentRepository.update(equipmentID, data);
    
    const updated = await EquipmentRepository.getById(equipmentID);
    if (!updated) {
      throw new Error("Failed to retrieve updated equipment");
    }

    this.invalidateListCache();
    return {
      ...updated,
      equipmentID: updated.equipmentID!,
    } as EquipmentResponse;
  }

  /**
   * Soft delete equipment (archive).
   * Equipment remains in database, marked as deleted.
   * Can be restored later.
   */
  static async archiveEquipment(equipmentID: string): Promise<void> {
    const exists = await EquipmentRepository.getById(equipmentID);
    if (!exists) {
      throw new Error(`Equipment not found: ${equipmentID}`);
    }

    await EquipmentRepository.softDelete(equipmentID);
    this.invalidateListCache();
  }

  /**
   * Restore archived equipment.
   */
  static async restoreEquipment(equipmentID: string): Promise<EquipmentResponse> {
    const exists = await EquipmentRepository.getById(equipmentID);
    if (!exists) {
      throw new Error(`Equipment not found: ${equipmentID}`);
    }

    await EquipmentRepository.restore(equipmentID);
    
    const restored = await EquipmentRepository.getById(equipmentID);
    if (!restored) {
      throw new Error("Failed to retrieve restored equipment");
    }

    this.invalidateListCache();
    return {
      ...restored,
      equipmentID: restored.equipmentID!,
    } as EquipmentResponse;
  }

  /**
   * Hard delete equipment.
   * Permanently removes from database and logs to purged collection.
   * This is irreversible.
   */
  static async deleteEquipment(equipmentID: string): Promise<void> {
    const exists = await EquipmentRepository.getById(equipmentID);
    if (!exists) {
      throw new Error(`Equipment not found: ${equipmentID}`);
    }

    await EquipmentRepository.delete(equipmentID);
    this.invalidateListCache();
  }

  /**
   * Get all purged (permanently deleted) equipment records.
   */
  static async getPurgedEquipment() {
    return await EquipmentRepository.getPurged();
  }

  /**
   * Restore equipment from purged state.
   * Should be restricted to authorized admins only.
   */
  static async restorePurgedEquipment(equipmentID: string): Promise<EquipmentResponse> {
    await EquipmentRepository.restorePurged(equipmentID);
    
    const restored = await EquipmentRepository.getById(equipmentID);
    if (!restored) {
      throw new Error("Failed to retrieve restored equipment");
    }

    this.invalidateListCache();
    return {
      ...restored,
      equipmentID: restored.equipmentID!,
    } as EquipmentResponse;
  }

  /**
   * Validate equipment creation input.
   * Throws if required fields are missing or invalid.
   */
  private static validateEquipmentInput(data: any): void {
    if (!data.name || typeof data.name !== "string" || data.name.trim().length === 0) {
      throw new Error("Invalid input: name is required and must be a non-empty string");
    }

    if (typeof data.totalInventory !== "number" || data.totalInventory < 0) {
      throw new Error("Invalid input: totalInventory must be a non-negative number");
    }

    if (typeof data.isDisposable !== "boolean") {
      throw new Error("Invalid input: isDisposable must be a boolean");
    }
    
    if (!data.categoryID) {
      throw new Error("Invalid input: categoryID is required");
    }
  }

  /**
   * Validate equipment update input.
   * Throws if any field is invalid.
   */
  private static validateEquipmentUpdate(data: any): void {
    if (data.name !== undefined) {
      if (typeof data.name !== "string" || data.name.trim().length === 0) {
        throw new Error("Invalid input: name must be a non-empty string");
      }
    }

    if (data.totalInventory !== undefined) {
      if (typeof data.totalInventory !== "number" || data.totalInventory < 0) {
        throw new Error("Invalid input: totalInventory must be a non-negative number");
      }
    }

    if (data.isDisposable !== undefined) {
      if (typeof data.isDisposable !== "boolean") {
        throw new Error("Invalid input: isDisposable must be a boolean");
      }
    }
  }
  
  static async createCategory(data: Omit<Category, "categoryID">): Promise<CategoryResponse> {
    if (!data.name) throw new Error("Category name is required");
    const id = await CategoryRepository.create(data);
    return { ...data, categoryID: id };
  }

  static async getAllCategories(): Promise<CategoryResponse[]> {
    const categories = await CategoryRepository.getAll();
    return categories.map(c => ({ ...c, categoryID: c.categoryID! }));
  }

  static async deleteCategory(id: string): Promise<void> {
    // Optional: Check if any equipment is still using this category before deleting
    await CategoryRepository.delete(id);
  }
}
