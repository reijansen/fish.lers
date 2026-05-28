import { Router } from "express";
import { RequestController } from "../controllers/requests.controller.js";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middleware/auth.js";

/**
 * Request Routes.
 * Defines HTTP endpoints for equipment reservation operations.
 *
 * Public read endpoints: available with requireAuth
 * Create: requireAuth (any user)
 * Approve/Reject: requireAuth + requireAdmin
 * Admin endpoints: marked with requireAuth, requireAdmin (commented out for now)
 */
const router = Router();

// List and get endpoints (require auth)
router.get("/", requireAuth, requireAdmin, RequestController.listRequests);
router.get("/pending", requireAuth, requireAdmin, RequestController.getPending);
router.get("/user/:uid", requireAuth, RequestController.getByUser);
router.get("/ongoing/summary", requireAuth, RequestController.getOngoingSummary);
router.get("/pending/summary", requireAuth, RequestController.getPendingSummary);
router.get("/availability/summary", requireAuth, RequestController.getAvailabilitySummary);
router.get("/:id", requireAuth, RequestController.getRequest);

// Batch endpoints
router.post("/batch/user-names", requireAuth, RequestController.batchGetUserNames);

// Create endpoint (require auth)
router.post("/", requireAuth, RequestController.createRequest);

// Update endpoint (require auth)
router.patch("/:id", requireAuth, RequestController.updateRequest);

// Approval endpoints (require admin)
router.post("/:id/approve", requireAuth, requireAdmin, RequestController.approveRequest);
router.post("/:id/reject", requireAuth, requireAdmin, RequestController.rejectRequest);
router.post("/:id/override-approve", requireAuth, requireSuperAdmin, RequestController.overrideApproveRequest);
router.post("/:id/override-reject", requireAuth, requireSuperAdmin, RequestController.overrideRejectRequest);

// Status transition endpoints (require auth)
router.post("/:id/ongoing", requireAuth, RequestController.markOngoing);
router.post("/:id/return", requireAuth, RequestController.markReturned);

// Delete endpoint
router.delete("/:id", requireAuth, RequestController.deleteRequest);

export default router;
