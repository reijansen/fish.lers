import { getFirestore } from "../config/firebase.js";
import { User, UserUpdateInput } from "../models/user.js";

const USERS_COLLECTION = "users";

/**
 * User Repository.
 * Handles all Firestore operations for user accounts.
 *
 * Purpose: Data access layer for user data.
 */
export class UserRepository {
  /**
   * Create a new user document in Firestore.
   * This is called after Firebase Auth user is created.
   */
  static async create(uid: string, data: Omit<User, "uid">): Promise<User> {
    const db = getFirestore();
    const user: User = {
      uid,
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.collection(USERS_COLLECTION).doc(uid).set(user);
    return user;
  }

  /**
   * Retrieve a user by UID.
   */
  static async getById(uid: string): Promise<User | null> {
    const db = getFirestore();
    const doc = await db.collection(USERS_COLLECTION).doc(uid).get();

    if (!doc.exists) {
      return null;
    }

    return doc.data() as User;
  }

  /**
   * Retrieve a user by email.
   */
  static async getByEmail(email: string): Promise<User | null> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("email", "==", email)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as User;
  }

  /**
   * Get all users.
   */
  static async getAll(): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * List all users with admin role.
   * Prefer this over getAll()+filter to avoid reading the entire collection.
   */
  static async listAdmins(): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("role", "==", "admin")
      .get();
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * List all users in admin-pending role.
   */
  static async listAdminPending(): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("role", "==", "admin-pending")
      .get();
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * List all users requesting admin access (pending approval).
   * Prefer this over getAll()+filter to avoid reading the entire collection.
   */
  static async listPendingAdminRequests(): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("requestedAdmin", "==", true)
      .get();
    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * List users by role with a limit.
   */
  static async listByRole(role: User["role"], limit = 50): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("role", "==", role)
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * List super admins.
   */
  static async listSuperAdmins(limit = 50): Promise<User[]> {
    const db = getFirestore();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where("isSuperAdmin", "==", true)
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => doc.data() as User);
  }

  /**
   * Update a user.
   */
  static async update(uid: string, data: UserUpdateInput): Promise<void> {
    const db = getFirestore();
    await db.collection(USERS_COLLECTION).doc(uid).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Delete a user.
   */
  static async delete(uid: string): Promise<void> {
    const db = getFirestore();
    await db.collection(USERS_COLLECTION).doc(uid).delete();
  }
}
