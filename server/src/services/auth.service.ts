import { getAuth } from "../config/firebase.js";
import { User, UserUpdateInput, AuthPayload } from "../models/user.js";
import { UserRepository } from "../repositories/users.repo.js";
import { getUserFromMongo } from "./authFallback.js";

/**
 * Auth Service.
 * Handles user authentication, authorization, and account management.
 *
 * Purpose: Business logic layer for auth operations.
 */
export class AuthService {
  /**
   * Sign up a new user.
   * Creates both a Firebase Auth user and a Firestore user document.
   */
  static async signup(payload: AuthPayload): Promise<User> {
    const { email, password, displayName } = payload;

    this.validateAuthPayload(email, password);

    try {
      // Create Firebase Auth user
      const authUser = await getAuth().createUser({
        email,
        password,
        displayName: displayName || email.split("@")[0],
      });

      // Create Firestore user document
      const user = await UserRepository.create(authUser.uid, {
        email,
        displayName: authUser.displayName || "User",
        role: "student", // Default role is student
        isActive: true,
      });

      return user;
    } catch (error: any) {
      if (error.code === "auth/email-already-exists") {
        throw new Error("Email already registered");
      }
      if (error.code === "auth/weak-password") {
        throw new Error("Password must be at least 6 characters");
      }
      throw error;
    }
  }

  /**
   * Verify a user's authentication token.
   * Returns user data if token is valid.
   */
  static async verifyToken(token: string): Promise<User> {
    let decodedToken: any;

    try {
      decodedToken = await getAuth().verifyIdToken(token);
    } catch (error: any) {
      console.warn("⚠️ Firebase auth failed, trying MongoDB fallback...");

      // Decode JWT manually
      try {
        const payload = JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString('utf-8')
        );

        const uid = payload.uid || payload.user_id || payload.sub;
        if (!uid) throw new Error("Invalid token payload");

        // Check expiry
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp < now) {
          throw new Error("Token has expired");
        }

        const user = await getUserFromMongo(uid);
        if (!user) throw new Error("User not found in backup");

        return user;
      } catch (err: any) {
        throw new Error(err.message || 'Invalid authentication token');
      }
  }

    let user = await UserRepository.getById(decodedToken.uid);

    // Auto-bootstrap Firestore user record if auth exists but profile doc is missing.
    if (!user) {
      const authUser = await getAuth().getUser(decodedToken.uid);
      const isSuperAdmin = !!decodedToken.superAdmin;
      const isAdmin = !!decodedToken.admin || isSuperAdmin;

      user = await UserRepository.create(decodedToken.uid, {
        email: authUser.email || decodedToken.email || "",
        displayName:
          authUser.displayName ||
          (authUser.email ? authUser.email.split("@")[0] : "User"),
        role: isAdmin ? "admin" : "student",
        isSuperAdmin,
        isActive: true,
      });
    }

    return user;
  }

  /**
   * Get user by ID.
   * Falls back to MongoDB if Firebase/Firestore is down.
   */
  static async getUserById(uid: string): Promise<User> {
    
    try {
      const user = await UserRepository.getById(uid);
      if (user) return user;
    } catch (firestoreError: any) {
      console.warn("⚠️ Firestore down — trying MongoDB fallback...");
    }

    // Fallback to MongoDB
    const user = await getUserFromMongo(uid);
    if (!user) {
      throw new Error(`User not found: ${uid}`);
    }

    return user;
  }

  /**
   * Update user profile (name, etc.)
   * Does NOT allow changing email or role via this method.
   */
  static async updateProfile(uid: string, updates: Partial<Pick<User, "displayName">>): Promise<User> {
    const user = await UserRepository.getById(uid);
    if (!user) {
      throw new Error("User not found");
    }

    await UserRepository.update(uid, updates);

    const updated = await UserRepository.getById(uid);
    if (!updated) {
      throw new Error("Failed to update user");
    }

    return updated;
  }

  /**
   * Set user role (admin only operation).
   * Should be used with requireAdmin middleware.
   */
  static async setUserRole(uid: string, role: "student" | "admin"): Promise<void> {
    const user = await UserRepository.getById(uid);
    if (!user) {
      throw new Error("User not found");
    }

    const authUser = await getAuth().getUser(uid);
    const existingClaims = authUser.customClaims || {};
    const isSuperAdmin = role === "admin" ? !!existingClaims.superAdmin : false;

    // Set custom claim in Firebase Auth
    await getAuth().setCustomUserClaims(uid, {
      ...existingClaims,
      admin: role === "admin" || isSuperAdmin,
      superAdmin: isSuperAdmin,
    });

    // Update Firestore document
    await UserRepository.update(uid, { role, isSuperAdmin, requestedAdmin: false });
  }

  /**
   * Promote/demote a user to/from super admin.
   * Super admin always implies admin role + admin claim.
   */
  static async setSuperAdmin(uid: string, isSuperAdmin: boolean): Promise<void> {
    const user = await UserRepository.getById(uid);
    if (!user) {
      throw new Error("User not found");
    }

    const authUser = await getAuth().getUser(uid);
    const existingClaims = authUser.customClaims || {};

    const nextRole: "student" | "admin" = isSuperAdmin ? "admin" : user.role;
    const nextAdminClaim = isSuperAdmin || nextRole === "admin";

    await getAuth().setCustomUserClaims(uid, {
      ...existingClaims,
      admin: nextAdminClaim,
      superAdmin: isSuperAdmin,
    });

    await UserRepository.update(uid, {
      role: nextRole,
      isSuperAdmin,
      requestedAdmin: false,
    });
  }

  /**
   * Deactivate a user account.
   */
  static async deactivateUser(uid: string): Promise<void> {
    const user = await UserRepository.getById(uid);
    if (!user) {
      throw new Error("User not found");
    }

    await UserRepository.update(uid, { isActive: false });
  }

  /**
   * Validate auth payload (email, password format).
   */
  private static validateAuthPayload(email: string, password: string): void {
    if (!email || !email.includes("@")) {
      throw new Error("Invalid email format");
    }

    if (!password || password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
  }
}
