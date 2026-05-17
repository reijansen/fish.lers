import { Request, Response } from "express";
import { EquipmentService } from "../services/equipment.service.js";

/**
 * Equipment Controller.
 * Handles HTTP request/response for equipment endpoints.
 * Delegates business logic to EquipmentService.
 *
 * Purpose: HTTP layer. Converts HTTP requests to service calls and formats responses.
 * All error handling should result in appropriate HTTP status codes.
 */
export class EquipmentController {
  private static parsePagination(req: Request): { page?: number; limit?: number } {
    const pageRaw = Number(req.query.page);
    const limitRaw = Number(req.query.limit);

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : undefined;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : undefined;
    return { page, limit };
  }

  /**
   * POST /api/equipment
   * Create new equipment.
   * Body: { name, totalInventory, category, isDisposable, imageLink }
   */
  static async createEquipment(req: Request, res: Response): Promise<void> {
    try {
      const equipment = await EquipmentService.createEquipment(req.body);
      res.status(201).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/equipment
   * Retrieve all equipment (active only by default).
   * Query param: ?includeArchived=true to include deleted items.
   */
  static async listEquipment(req: Request, res: Response): Promise<void> {
    try {
      const includeArchived = req.query.includeArchived === "true";
      const pagination = EquipmentController.parsePagination(req);
      const equipment = includeArchived
        ? await EquipmentService.getAllEquipment(pagination)
        : await EquipmentService.getActiveEquipment(pagination);
      
      res.status(200).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/equipment/:id
   * Retrieve a single equipment by ID.
   */
  static async getEquipment(req: Request, res: Response): Promise<void> {
    try {
      const equipment = await EquipmentService.getEquipmentById(req.params.id);
      res.status(200).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/equipment/:id
   * Update equipment.
   * Body: partial equipment object { name?, category?, totalInventory?, ... }
   */
  static async updateEquipment(req: Request, res: Response): Promise<void> {
    try {
      const equipment = await EquipmentService.updateEquipment(req.params.id, req.body);
      res.status(200).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/equipment/:id/archive
   * Soft delete (archive) equipment.
   * Equipment can be restored later.
   */
  static async archiveEquipment(req: Request, res: Response): Promise<void> {
    try {
      await EquipmentService.archiveEquipment(req.params.id);
      res.status(200).json({ success: true, message: "Equipment archived" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/equipment/:id/restore
   * Restore archived equipment.
   */
  static async restoreEquipment(req: Request, res: Response): Promise<void> {
    try {
      const equipment = await EquipmentService.restoreEquipment(req.params.id);
      res.status(200).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * DELETE /api/equipment/:id
   * Hard delete equipment.
   * This is irreversible. Equipment is moved to purged collection.
   */
  static async deleteEquipment(req: Request, res: Response): Promise<void> {
    try {
      await EquipmentService.deleteEquipment(req.params.id);
      res.status(200).json({ success: true, message: "Equipment deleted" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/equipment/purged
   * Retrieve all purged equipment records.
   * Admin/audit purposes only.
   */
  static async getPurgedEquipment(req: Request, res: Response): Promise<void> {
    try {
      const purged = await EquipmentService.getPurgedEquipment();
      res.status(200).json({ success: true, data: purged });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PUT /api/equipment/:id/restore-purged
   * Restore equipment from purged state.
   * Dangerous operation - should be restricted to super admins.
   */
  static async restorePurgedEquipment(req: Request, res: Response): Promise<void> {
    try {
      const equipment = await EquipmentService.restorePurgedEquipment(req.params.id);
      res.status(200).json({ success: true, data: equipment });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async createCategory(req: Request, res: Response): Promise<void> {
    try {
      const category = await EquipmentService.createCategory(req.body);
      res.status(201).json({ success: true, data: category });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  static async listCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await EquipmentService.getAllCategories();
      res.status(200).json({ success: true, data: categories });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  static async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      await EquipmentService.deleteCategory(req.params.id);
      res.status(200).json({ success: true, message: "Category deleted" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
}
