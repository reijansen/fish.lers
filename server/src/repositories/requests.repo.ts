import { getFirestore } from "../config/firebase.js";
import { Request, RequestCreateInput, RequestUpdateInput, RequestApprovalPayload } from "../models/request.js";

const REQUESTS_COLLECTION = "requests";
type ListOptions = {
  page: number;
  limit: number;
};

/**
 * Request Repository.
 * Handles all Firestore operations for equipment requests.
 *
 * Purpose: Data access layer for request data.
 */
export class RequestRepository {
  /**
   * Create a new request.
   */
  static async create(data: RequestCreateInput): Promise<string> {
    const db = getFirestore();

    const docRef = await db.collection(REQUESTS_COLLECTION).add({
      ...data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return docRef.id;
  }

  /**
   * Get a request by ID.
   */
  static async getById(requestID: string): Promise<Request | null> {
    const db = getFirestore();
    const doc = await db.collection(REQUESTS_COLLECTION).doc(requestID).get();

    if (!doc.exists) {
      return null;
    }

    return {
      requestID: doc.id,
      ...doc.data(),
    } as Request;
  }

  /**
   * Get all requests (optionally filtered by status).
   */
  static async getAll(status: string | undefined, options: ListOptions): Promise<Request[]> {
    const db = getFirestore();
    let query: any = db.collection(REQUESTS_COLLECTION);

    if (status) {
      query = query.where("status", "==", status);
    }

    const offset = (options.page - 1) * options.limit;
    query = query.limit(options.limit);
    if (offset > 0 && typeof query.offset === "function") {
      query = query.offset(offset);
    }

    const snapshot = await query.get();

    return snapshot.docs.map((doc: any) => ({
      requestID: doc.id,
      ...doc.data(),
    } as Request));
  }

  /**
   * Get all requests by a specific user.
   */
  static async getByUserId(userID: string, options: ListOptions): Promise<Request[]> {
    const db = getFirestore();
    const offset = (options.page - 1) * options.limit;
    let query: any = db
      .collection(REQUESTS_COLLECTION)
      .where("userID", "==", userID)
      .orderBy("createdAt", "desc")
      .limit(options.limit);
    if (offset > 0 && typeof query.offset === "function") {
      query = query.offset(offset);
    }
    const snapshot = await query.get();

    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      requestID: doc.id,
      ...doc.data(),
    } as Request));
  }

  /**
   * Get pending requests (awaiting approval).
   */
  static async getPending(options: ListOptions): Promise<Request[]> {
    const db = getFirestore();
    const offset = (options.page - 1) * options.limit;
    let query: any = db
      .collection(REQUESTS_COLLECTION)
      .where("status", "==", "pending")
      .orderBy("createdAt", "asc")
      .limit(options.limit);
    if (offset > 0 && typeof query.offset === "function") {
      query = query.offset(offset);
    }
    const snapshot = await query.get();

    return snapshot.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData>) => ({
      requestID: doc.id,
      ...doc.data(),
    } as Request));
  }

  /**
   * Update a request.
   */
  static async update(requestID: string, data: Partial<RequestUpdateInput>): Promise<void> {
    const db = getFirestore();
    await db.collection(REQUESTS_COLLECTION).doc(requestID).update({
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Approve a request.
   */
  static async approve(requestID: string, approvedBy: string): Promise<void> {
    await this.update(requestID, {
      status: "approved",
      approvedBy,
      approvedAt: new Date().toISOString(),
    } as any);
  }

  /**
   * Reject a request.
   */
  static async reject(requestID: string, reason: string): Promise<void> {
    await this.update(requestID, {
      status: "rejected",
      rejectionReason: reason,
      rejectedBy: null,
      rejectedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
    } as any);
  }

  /**
   * Reject a request and capture actor metadata.
   */
  static async rejectByAdmin(requestID: string, reason: string, rejectedBy: string): Promise<void> {
    await this.update(requestID, {
      status: "rejected",
      rejectionReason: reason,
      rejectedBy,
      rejectedAt: new Date().toISOString(),
      approvedBy: null,
      approvedAt: null,
    } as any);
  }

  /**
   * Mark request as ongoing (equipment borrowed).
   */
  static async markOngoing(requestID: string): Promise<void> {
    await this.update(requestID, {
      status: "ongoing",
    });
  }

  /**
   * Mark request as returned.
   */
  static async markReturned(requestID: string): Promise<void> {
    await this.update(requestID, {
      status: "returned",
      returnedAt: new Date().toISOString(),
    } as any);
  }

  /**
   * Override a previous admin decision (super admin only).
   */
  static async overrideDecision(
    requestID: string,
    payload: {
      newStatus: "approved" | "rejected";
      superAdminUid: string;
      previousStatus: "approved" | "rejected";
      reason?: string;
    }
  ): Promise<void> {
    const now = new Date().toISOString();
    const isApprove = payload.newStatus === "approved";

    await this.update(requestID, {
      status: payload.newStatus,
      approvedBy: isApprove ? payload.superAdminUid : null,
      approvedAt: isApprove ? now : null,
      rejectedBy: isApprove ? null : payload.superAdminUid,
      rejectedAt: isApprove ? null : now,
      rejectionReason: isApprove ? null : payload.reason || "Overridden by super admin",
      overriddenBy: payload.superAdminUid,
      overriddenAt: now,
      overrideReason: payload.reason || null,
      overrideFromStatus: payload.previousStatus,
    } as any);
  }

  /**
   * Delete a request.
   */
  static async delete(requestID: string): Promise<void> {
    const db = getFirestore();
    await db.collection(REQUESTS_COLLECTION).doc(requestID).delete();
  }
}
