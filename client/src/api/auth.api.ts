/**
 * Auth API.
 * HTTP wrapper for authentication endpoints.
 *
 * This module wraps all auth API calls, replacing Firebase Auth client methods.
 */

import { apiPost, apiGet, apiPatch } from "./http";
import { measureActionLatency, trackSuperAdminApiFailure } from "../utils/telemetry";

/**
 * User type (from server models).
 */
export interface User {
  uid: string;
  email: string;
  displayName?: string;
  role: "student" | "admin" | "admin-pending";
  isSuperAdmin?: boolean;
  requestedAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

/**
 * Auth response type.
 */
export interface AuthResponse {
  user: User;
  token: string;
}

/**
 * Sign up a new user.
 * POST /api/auth/signup
 * Body: { email, password, displayName? }
 */
export async function signup(
  email: string,
  password: string,
  displayName?: string
): Promise<User> {
  const data = await apiPost<User>("/api/auth/signup", {
    email,
    password,
    displayName,
  });
  return data;
}

/**
 * Verify an ID token.
 * POST /api/auth/verify
 * Body: { token }
 * Returns: user data if valid
 */
export async function verifyToken(token: string): Promise<User> {
  const data = await apiPost<User>("/api/auth/verify", { token });
  return data;
}

/**
 * Get current user data.
 * GET /api/auth/me
 * Requires: Authorization header with token
 */
export async function getCurrentUser(): Promise<User> {
  const data = await apiGet<User>("/api/auth/me");
  return data;
}

/**
 * Update current user profile.
 * PATCH /api/auth/profile
 * Body: { displayName? }
 */
export async function updateProfile(displayName: string): Promise<User> {
  const data = await apiPatch<User>("/api/auth/profile", { displayName });
  return data;
}

/**
 * Set a user's role (admin only).
 * POST /api/auth/:uid/set-role
 * Body: { role: "student" | "admin" }
 */
export async function setUserRole(
  uid: string,
  role: "student" | "admin"
): Promise<void> {
  await apiPost(`/api/auth/${uid}/set-role`, { role });
}

/**
 * Set/remove super-admin access (super-admin only).
 * POST /api/auth/:uid/set-super-admin
 * Body: { isSuperAdmin: boolean }
 */
export async function setSuperAdmin(uid: string, isSuperAdmin: boolean): Promise<void> {
  const endpoint = `/api/auth/${uid}/set-super-admin`;
  try {
    await measureActionLatency(
      "super_admin.set_super_admin",
      () => apiPost(endpoint, { isSuperAdmin }),
      { uid, isSuperAdmin }
    );
  } catch (error: any) {
    trackSuperAdminApiFailure({
      endpoint,
      action: "set_super_admin",
      error,
      context: { uid, isSuperAdmin },
    });
    throw error;
  }
}

/**
 * Deactivate a user account (admin only).
 * POST /api/auth/:uid/deactivate
 */
export async function deactivateUser(uid: string): Promise<void> {
  await apiPost(`/api/auth/${uid}/deactivate`, {});
}

/**
 * Get all users with admin role or pending admin requests (admin only).
 * GET /api/auth/admin/users
 * Returns: array of User objects
 */
export async function getAdminAndPendingUsers(): Promise<User[]> {
  try {
    console.log(`[Auth API] Fetching admin and pending users...`);
    const data = await apiGet<User[]>("/api/auth/admin/users");
    console.log(`[Auth API] ✅ Received ${data.length} admin/pending users`);
    if (data.length > 0) {
      console.log(`[Auth API] Sample users:`, data.slice(0, 2).map(u => ({
        uid: u.uid.substring(0, 8),
        role: u.role,
        requestedAdmin: u.requestedAdmin,
        email: u.email
      })));
    }
    return data;
  } catch (error: any) {
    console.error(`[Auth API] ❌ Error fetching admin users:`, error.message);
    throw error;
  }
}

export default {
  signup,
  verifyToken,
  getCurrentUser,
  updateProfile,
  setUserRole,
  setSuperAdmin,
  deactivateUser,
  getAdminAndPendingUsers,
};
