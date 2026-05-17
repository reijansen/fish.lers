import { Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";

/**
 * Auth Controller.
 * Handles HTTP requests for authentication operations.
 *
 * Purpose: HTTP layer for auth endpoints.
 */
export class AuthController {
  /**
   * POST /api/auth/signup
   * Create a new user account.
   * Body: { email, password, displayName? }
   */
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const user = await AuthService.signup(req.body);
      res.status(201).json({ success: true, data: user });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/verify
   * Verify an ID token and get user data.
   * Body: { token }
   */
  static async verifyToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ success: false, error: "Token required" });
        return;
      }

      const user = await AuthService.verifyToken(token);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      res.status(401).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/auth/me
   * Get current user data (requires auth middleware).
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const user = await AuthService.getUserById(req.user.uid);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  /**
   * PATCH /api/auth/profile
   * Update user profile (requires auth).
   * Body: { displayName? }
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: "Not authenticated" });
        return;
      }

      const user = await AuthService.updateProfile(req.user.uid, req.body);
      res.status(200).json({ success: true, data: user });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/set-role/:uid
   * Set user role (admin only).
   * Body: { role: "student" | "admin" }
   */
  static async setUserRole(req: Request, res: Response): Promise<void> {
    try {
      const { uid } = req.params;
      const { role } = req.body;

      if (!role || !["student", "admin"].includes(role)) {
        res.status(400).json({ success: false, error: "Invalid role" });
        return;
      }

      await AuthService.setUserRole(uid, role);
      res.status(200).json({ success: true, message: "User role updated" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/deactivate/:uid
   * Deactivate a user account (admin only).
   */
  static async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { uid } = req.params;
      await AuthService.deactivateUser(uid);
      res.status(200).json({ success: true, message: "User deactivated" });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * POST /api/auth/:uid/set-super-admin
   * Set super-admin access (super admin only).
   * Body: { isSuperAdmin: boolean }
   */
  static async setSuperAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { uid } = req.params;
      const { isSuperAdmin } = req.body;

      if (typeof isSuperAdmin !== "boolean") {
        res.status(400).json({ success: false, error: "isSuperAdmin must be boolean" });
        return;
      }

      await AuthService.setSuperAdmin(uid, isSuperAdmin);
      res.status(200).json({
        success: true,
        message: isSuperAdmin
          ? "User promoted to super admin"
          : "User demoted from super admin",
      });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  }

  /**
   * GET /api/auth/admin/users
   * Get all users with admin role or pending admin requests (admin only).
   */
  static async getAdminAndPendingUsers(req: Request, res: Response): Promise<void> {
    try {
      console.log(`[AuthController] Getting admin and pending users...`);
      const users = await AuthService.getAllAdminAndPending();
      console.log(`[AuthController] ✅ Returning ${users.length} admin/pending users`);
      res.status(200).json({ success: true, data: users });
    } catch (error: any) {
      console.error(`[AuthController] ❌ Error getting admin users:`, error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}