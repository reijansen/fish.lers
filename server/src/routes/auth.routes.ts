import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";
import { requireAuth, requireAdmin, requireSuperAdmin } from "../middleware/auth.js";

/**
 * Auth Routes.
 * Defines HTTP endpoints for authentication operations.
 *
 * Public endpoints: signup, verify
 * Protected endpoints: getCurrentUser, updateProfile, setRole (with requireAdmin)
 */
const router = Router();

// Public endpoints
router.post("/signup", AuthController.signup);
router.post("/verify", AuthController.verifyToken);

// Protected endpoints (require auth)
router.get("/me", requireAuth, AuthController.getCurrentUser);
router.patch("/profile", requireAuth, AuthController.updateProfile);

// Admin-only endpoints
router.get("/admin/users", requireAuth, requireAdmin, AuthController.getAdminAndPendingUsers);
router.post("/:uid/set-role", requireAuth, requireSuperAdmin, AuthController.setUserRole);
router.post("/:uid/set-super-admin", requireAuth, requireSuperAdmin, AuthController.setSuperAdmin);
router.post("/:uid/deactivate", requireAuth, requireAdmin, AuthController.deactivateUser);

export default router;
