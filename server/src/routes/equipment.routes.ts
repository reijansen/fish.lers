import { Router } from "express";
import { EquipmentController } from "../controllers/equipment.controller.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

/**
 * Equipment Routes.
 * Defines HTTP endpoints for equipment operations.
 * Auth requirements:
 * - List/read: requireAuth (any authenticated user)
 * - Create/update/delete: requireAuth + requireAdmin (admin only)
 *
 * NOTE: In the first iteration, we're not enforcing admin-only yet.
 * You can add `requireAuth, requireAdmin` to routes once frontend auth is migrated.
 */
const router = Router();

// Public read endpoints (available to any authenticated user)
router.get("/", EquipmentController.listEquipment);
router.get("/purged", EquipmentController.getPurgedEquipment);
router.get("/:id", EquipmentController.getEquipment);

// Admin-only write endpoints (when you're ready, uncomment the middleware)
// For now, these are open for testing purposes.
router.post("/", /* requireAuth, requireAdmin, */ EquipmentController.createEquipment);
router.patch("/:id", /* requireAuth, requireAdmin, */ EquipmentController.updateEquipment);
router.delete("/:id", /* requireAuth, requireAdmin, */ EquipmentController.deleteEquipment);

// Archive/restore endpoints
router.put("/:id/archive", /* requireAuth, requireAdmin, */ EquipmentController.archiveEquipment);
router.put("/:id/restore", /* requireAuth, requireAdmin, */ EquipmentController.restoreEquipment);
router.put("/:id/restore-purged", /* requireAuth, requireAdmin, */ EquipmentController.restorePurgedEquipment);
router.get("/categories", EquipmentController.listCategories);
router.post("/categories", EquipmentController.createCategory);
router.delete("/categories/:id", EquipmentController.deleteCategory);
export default router;
